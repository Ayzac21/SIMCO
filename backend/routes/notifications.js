import express from "express";
import { pool } from "../db/connection.js";
import { ensureNotificationsTable } from "../services/notifications.js";

const router = express.Router();

const parseUserId = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

router.get("/", async (req, res) => {
  try {
    const userId = parseUserId(req.user?.id);
    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });
    await ensureNotificationsTable();

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
      ORDER BY created_at DESC, id DESC
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

export default router;
