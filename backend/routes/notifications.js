import express from "express";
import { pool } from "../db/connection.js";
import { ensureNotificationsTable } from "../services/notifications.js";

const router = express.Router();

const parseUserId = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

const isActionableForStatus = (actionPath, statusId) => {
  const path = String(actionPath || "").trim();
  const st = Number(statusId || 0);
  if (!path || !Number.isFinite(st)) return true;

  // Las notificaciones con detalle explícito son avisos de seguimiento; no se
  // autoleen solo porque el flujo ya avanzó.
  if (path.includes("openReq=")) {
    return true;
  }

  // Ajustes para URE: solo si sigue en borrador.
  if (path.startsWith("/unidad/requisiciones/editar/")) {
    return st === 7;
  }

  // Revisión por URE deshabilitada: ahora es interna de Compras.
  if (path.startsWith("/unidad/revision/")) {
    return false;
  }

  // Bandejas operativas por rol.
  if (path.startsWith("/coordinador/requisiciones")) {
    return st === 8;
  }
  if (path.startsWith("/secretaria/recibidas")) {
    return st === 9;
  }
  if (path.startsWith("/compras/dashboard")) {
    return [12, 13, 14, 16].includes(st);
  }
  if (path.startsWith("/finanzas/recibidas")) {
    return st === 15;
  }
  if (path.startsWith("/compras/revision/")) {
    return st === 14;
  }

  // Para rutas históricas/detalle no forzamos limpieza.
  return true;
};

const markStaleRequisitionNotificationsAsRead = async (userId) => {
  const [notifRows] = await pool.query(
    `
    SELECT id, action_path, entity_id
    FROM notifications
    WHERE recipient_user_id = ?
      AND is_read = 0
      AND entity_type = 'requisition'
      AND entity_id IS NOT NULL
    `,
    [userId]
  );

  if (!notifRows.length) return;

  const reqIds = Array.from(
    new Set(
      notifRows
        .map((n) => Number(n.entity_id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );
  if (!reqIds.length) return;

  const [reqRows] = await pool.query(
    `SELECT id, statuses_id FROM requisition WHERE id IN (${reqIds.map(() => "?").join(",")})`,
    reqIds
  );
  const statusMap = new Map(reqRows.map((r) => [Number(r.id), Number(r.statuses_id)]));

  const staleNotifIds = notifRows
    .filter((n) => {
      const reqId = Number(n.entity_id || 0);
      const st = statusMap.get(reqId);
      if (!Number.isFinite(st)) return false;
      return !isActionableForStatus(n.action_path, st);
    })
    .map((n) => Number(n.id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (!staleNotifIds.length) return;

  await pool.query(
    `
    UPDATE notifications
    SET is_read = 1, read_at = COALESCE(read_at, NOW())
    WHERE id IN (${staleNotifIds.map(() => "?").join(",")})
    `,
    staleNotifIds
  );
};

const purgeExpiredReadNotifications = async (userId) => {
  await pool.query(
    `
    DELETE FROM notifications
    WHERE recipient_user_id = ?
      AND is_read = 1
      AND COALESCE(read_at, created_at) < (NOW() - INTERVAL 10 DAY)
    `,
    [userId]
  );
};

router.get("/", async (req, res) => {
  try {
    const userId = parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });
    await ensureNotificationsTable();
    await markStaleRequisitionNotificationsAsRead(userId);
    await purgeExpiredReadNotifications(userId);

    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 15)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    const [rows] = await pool.query(
      `
      SELECT
        id,
        title,
        message,
        entity_type,
        entity_id,
        action_path,
        is_read,
        created_at
      FROM notifications
      WHERE recipient_user_id = ?
      ORDER BY id DESC, created_at DESC
      LIMIT ? OFFSET ?
      `,
      [userId, limit, offset]
    );

    const [[unreadRow]] = await pool.query(
      `
      SELECT COUNT(*) AS unread
      FROM notifications
      WHERE recipient_user_id = ? AND is_read = 0
      `,
      [userId]
    );

    return res.json({
      ok: true,
      unread: Number(unreadRow?.unread || 0),
      rows,
    });
  } catch (err) {
    console.error("ERROR notifications list:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
});

router.patch("/read-all", async (req, res) => {
  try {
    const userId = parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });
    await ensureNotificationsTable();

    await pool.query(
      `
      UPDATE notifications
      SET is_read = 1, read_at = NOW()
      WHERE recipient_user_id = ? AND is_read = 0
      `,
      [userId]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("ERROR notifications read-all:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
});

router.patch("/:id/read", async (req, res) => {
  try {
    const userId = parseUserId(req.user?.id);
    const id = Number(req.params.id);
    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: "id inválido" });
    }
    await ensureNotificationsTable();

    const [result] = await pool.query(
      `
      UPDATE notifications
      SET is_read = 1, read_at = COALESCE(read_at, NOW())
      WHERE id = ? AND recipient_user_id = ?
      `,
      [id, userId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ ok: false, message: "Notificación no encontrada" });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("ERROR notifications read:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
});

router.delete("/clear", async (req, res) => {
  try {
    const userId = parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });
    await ensureNotificationsTable();

    await pool.query(
      `
      DELETE FROM notifications
      WHERE recipient_user_id = ?
      `,
      [userId]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("ERROR notifications clear:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
});

export default router;
