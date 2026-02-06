import express from "express";
import { pool } from "../db/connection.js";

const router = express.Router();

/* Crear requisición */
async function createRequisitionHandler(req, res) {
  const conn = await pool.getConnection();
  try {
    const {
      users_id,
      categoria,
      articulos,
      notes = "",
      request_name = "",
      justification = "",
      observation = "",
    } = req.body;

    if (!users_id || !Array.isArray(articulos) || articulos.length === 0) {
      return res.status(400).json({ ok: false, message: "Datos incompletos" });
    }

    await conn.beginTransaction();

    const now = new Date();
    const folioCorto = `AF-${Math.floor(1000 + Math.random() * 9000)}`;

    const [result] = await conn.query(
      `
      INSERT INTO requisition
      (
        folio,
        area_folio,
        notes,
        users_id,
        statuses_id,
        signatures,
        created_at,
        sent_on,
        categories_id,
        request_name,
        justification,
        observation
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        null,
        folioCorto,
        notes,
        users_id,
        7,
        "",
        now,
        null,
        categoria || 1,
        request_name,
        justification,
        observation,
      ]
    );

    const requisitionId = result.insertId;

    for (const art of articulos) {
      await conn.query(
        `
        INSERT INTO line_items
          (product_name, description, quantity, units_id, requisition_id)
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          art.producto || "",
          art.especificaciones || "",
          Number(art.cantidad || 0),
          art.units_id || 1,
          requisitionId,
        ]
      );
    }

    await conn.commit();
    return res.json({
      ok: true,
      id: requisitionId,
      folio: folioCorto,
      status: "En borrador",
    });
  } catch (err) {
    await conn.rollback();
    console.error("ERROR crear requisición:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  } finally {
    conn.release();
  }
}

/* Revisión: data */
router.get("/revision/:id/data", async (req, res) => {
  try {
    const { id } = req.params;

    const [reqRows] = await pool.query(
      `
      SELECT 
        r.id,
        r.request_name,
        r.users_id,
        r.statuses_id,
        r.quotation_closed_at,
        r.quotation_closed_by,
        r.quotation_close_note,
        c.id as category_id,
        c.name as category_name
      FROM requisition r
      LEFT JOIN categories c ON r.categories_id = c.id
      WHERE r.id = ?
      `,
      [id]
    );

    if (reqRows.length === 0) {
      return res.status(404).json({ message: "Requisición no encontrada" });
    }

    const requisition = reqRows[0];

    if (Number(requisition.statuses_id) !== 14) {
      return res.status(400).json({
        message: "La requisición no está en revisión",
        current_status: requisition.statuses_id,
      });
    }

    const [items] = await pool.query(
      `
      SELECT 
        li.id,
        li.quantity,
        li.description,
        un.name AS unidad_medida
      FROM line_items li
      LEFT JOIN units un ON li.units_id = un.id
      WHERE li.requisition_id = ?
      ORDER BY li.id ASC
      `,
      [id]
    );

    const [invitedProviders] = await pool.query(
      `
      SELECT 
        p.id, p.name, p.email, p.rfc,
        qr.status, qr.invited_at, qr.responded_at, qr.deadline_at
      FROM quotation_requests qr
      INNER JOIN provider p ON p.id = qr.provider_id
      WHERE qr.requisition_id = ?
      ORDER BY 
        FIELD(qr.status, 'responded', 'invited', 'expired', 'declined') ASC,
        qr.invited_at DESC
      `,
      [id]
    );

    const [savedPrices] = await pool.query(
      `
      SELECT 
        line_item_id,
        provider_id,
        unit_price,
        offered_description,
        notes,
        is_winner
      FROM quotation_prices
      WHERE requisition_id = ?
      `,
      [id]
    );

    const [selections] = await pool.query(
      `
      SELECT line_item_id, provider_id, selected_unit_price, selected_description
      FROM quotation_selections
      WHERE requisition_id = ?
      `,
      [id]
    );

    return res.json({
      requisition,
      items,
      invitedProviders,
      savedPrices,
      selections,
    });
  } catch (error) {
    console.error("Error /revision/:id/data:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
});

/* Revisión: guardar selección */
router.post("/revision/:id/select", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { selections } = req.body;

    if (!Array.isArray(selections) || selections.length === 0) {
      return res.status(400).json({ message: "selections es requerido" });
    }

    await conn.beginTransaction();

    const [reqRows] = await conn.query(
      `SELECT id, statuses_id FROM requisition WHERE id = ? FOR UPDATE`,
      [id]
    );

    if (reqRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: "Requisición no encontrada" });
    }

    if (Number(reqRows[0].statuses_id) !== 14) {
      await conn.rollback();
      return res.status(400).json({
        message: "La requisición no está en revisión",
        current_status: reqRows[0].statuses_id,
      });
    }

    const [validItems] = await conn.query(
      `SELECT id FROM line_items WHERE requisition_id = ?`,
      [id]
    );
    const validItemSet = new Set(validItems.map((x) => Number(x.id)));
    if (validItemSet.size === 0) {
      await conn.rollback();
      return res.status(400).json({ message: "La requisición no tiene partidas" });
    }

    const [validProviders] = await conn.query(
      `SELECT provider_id FROM quotation_requests WHERE requisition_id = ?`,
      [id]
    );
    const validProviderSet = new Set(validProviders.map((x) => Number(x.provider_id)));
    if (validProviderSet.size === 0) {
      await conn.rollback();
      return res.status(400).json({ message: "No hay proveedores invitados a esta requisición" });
    }

    for (const s of selections) {
      const line_item_id = Number(s.line_item_id);
      const provider_id = Number(s.provider_id);

      if (!line_item_id || !provider_id) {
        await conn.rollback();
        return res.status(400).json({ message: "line_item_id y provider_id son requeridos" });
      }
      if (!validItemSet.has(line_item_id)) {
        await conn.rollback();
        return res.status(400).json({ message: `Partida inválida: ${line_item_id}` });
      }
      if (!validProviderSet.has(provider_id)) {
        await conn.rollback();
        return res.status(400).json({ message: `Proveedor inválido/no invitado: ${provider_id}` });
      }

      const selected_unit_price =
        s.selected_unit_price === "" || s.selected_unit_price == null
          ? null
          : Number(s.selected_unit_price);

      const selected_description = (s.selected_description ?? "").toString();

      await conn.query(
        `
        INSERT INTO quotation_selections
          (requisition_id, line_item_id, provider_id, selected_unit_price, selected_description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          provider_id = VALUES(provider_id),
          selected_unit_price = VALUES(selected_unit_price),
          selected_description = VALUES(selected_description),
          updated_at = NOW()
        `,
        [id, line_item_id, provider_id, selected_unit_price, selected_description]
      );
    }

    const [[tot]] = await conn.query(
      `SELECT COUNT(*) AS total FROM line_items WHERE requisition_id = ?`,
      [id]
    );

    const [[sel]] = await conn.query(
      `
      SELECT COUNT(DISTINCT line_item_id) AS selected
      FROM quotation_selections
      WHERE requisition_id = ?
      `,
      [id]
    );

    const total = Number(tot.total || 0);
    const selected = Number(sel.selected || 0);
    const missing = Math.max(0, total - selected);

    let sent_to_purchase = false;

    if (total > 0 && selected === total) {
      await conn.query(`UPDATE requisition SET statuses_id = 13 WHERE id = ?`, [id]);
      sent_to_purchase = true;
    }

    await conn.commit();

    return res.json({
      ok: true,
      sent_to_purchase,
      total,
      selected,
      missing,
      message: sent_to_purchase
        ? "Selección completa. Enviada a compras (proceso de compra)."
        : `Selección guardada. Faltan ${missing} partida(s) por seleccionar.`,
    });
  } catch (error) {
    await conn.rollback();
    console.error("Error /revision/:id/select:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  } finally {
    conn.release();
  }
});

/* Dashboard stats simple */
router.get("/dashboard/:users_id/stats", async (req, res) => {
  try {
    const { users_id } = req.params;

    const [rows] = await pool.query(
      `
      SELECT
        SUM(CASE WHEN r.statuses_id = 10 THEN 1 ELSE 0 END) AS rechazadas,
        SUM(CASE WHEN r.statuses_id IN (11, 13) THEN 1 ELSE 0 END) AS aprobadas,
        SUM(CASE WHEN r.statuses_id NOT IN (10, 11, 13) THEN 1 ELSE 0 END) AS pendientes,
        COUNT(*) AS total
      FROM requisition r
      WHERE r.users_id = ?
      `,
      [users_id]
    );

    const stats = rows?.[0] || {};
    return res.json({
      ok: true,
      pendientes: Number(stats.pendientes || 0),
      aprobadas: Number(stats.aprobadas || 0),
      rechazadas: Number(stats.rechazadas || 0),
      total: Number(stats.total || 0),
    });
  } catch (err) {
    console.error("ERROR dashboard stats:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
});

/* Crear */
router.post("/", createRequisitionHandler);

/* Mis requisiciones */
router.get("/mis-requisiciones/:users_id", async (req, res) => {
  try {
    const { users_id } = req.params;
    const [rows] = await pool.query(
      `
      SELECT
        r.id,
        r.area_folio,
        r.created_at,
        c.name AS categoria,
        s.id AS statuses_id,
        s.name AS estatus
      FROM requisition r
      JOIN categories c ON r.categories_id = c.id
      JOIN statuses s ON r.statuses_id = s.id
      WHERE r.users_id = ?
      ORDER BY r.created_at DESC
      `,
      [users_id]
    );
    return res.json(rows);
  } catch (err) {
    console.error("ERROR mis-requisiciones:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

/* Enviar (solo borrador -> coordinación) */
router.patch("/:id/enviar", async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      `
      UPDATE requisition
      SET statuses_id = 8
      WHERE id = ? AND statuses_id = 7
      `,
      [id]
    );

    if (!result.affectedRows) {
      return res.status(400).json({ ok: false, message: "No se puede enviar" });
    }

    return res.json({ ok: true, statuses_id: 8, status: "En coordinación" });
  } catch (err) {
    console.error("ERROR enviar:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
});

/* Obtener requisición + partidas */
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [[requisicion]] = await pool.query(
      `
      SELECT
        r.id,
        r.notes,
        r.request_name,
        r.justification,
        r.observation,
        r.statuses_id,
        s.name AS estatus,
        u.name AS solicitante,
        u.ure AS ure
      FROM requisition r
      JOIN statuses s ON r.statuses_id = s.id
      JOIN users u ON r.users_id = u.id
      WHERE r.id = ?
      `,
      [id]
    );

    if (!requisicion) return res.status(404).json({ ok: false, message: "No encontrada" });

    const [partidas] = await pool.query(
      `
      SELECT
        id,
        product_name,
        description,
        quantity,
        units_id
      FROM line_items
      WHERE requisition_id = ?
      `,
      [id]
    );

    return res.json({ ...requisicion, partidas });
  } catch (err) {
    console.error("ERROR get requisicion:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
});

/* Editar requisición + partidas (solo borrador) */
router.put("/:id", async (req, res) => {
  const conn = await pool.getConnection();
  const { id } = req.params;
  const { notes, request_name, justification, observation, partidas } = req.body;

  try {
    await conn.beginTransaction();

    await conn.query(
      `
      UPDATE requisition
      SET
        notes = ?,
        request_name = ?,
        justification = ?,
        observation = ?
      WHERE id = ? AND statuses_id = 7
      `,
      [notes, request_name, justification, observation, id]
    );

    const [actuales] = await conn.query(`SELECT id FROM line_items WHERE requisition_id = ?`, [id]);
    const idsActuales = actuales.map((p) => p.id);
    const idsRecibidos = (partidas || []).filter((p) => p.id).map((p) => p.id);

    const eliminar = idsActuales.filter((x) => !idsRecibidos.includes(x));
    if (eliminar.length) {
      await conn.query(`DELETE FROM line_items WHERE id IN (?)`, [eliminar]);
    }

    for (const p of partidas || []) {
      if (p.id) {
        await conn.query(
          `
          UPDATE line_items
          SET product_name=?, description=?, quantity=?, units_id=?
          WHERE id=?
          `,
          [p.product_name, p.description, p.quantity, p.units_id, p.id]
        );
      } else {
        await conn.query(
          `
          INSERT INTO line_items
            (product_name, description, quantity, units_id, requisition_id)
          VALUES (?, ?, ?, ?, ?)
          `,
          [p.product_name, p.description, p.quantity, p.units_id, id]
        );
      }
    }

    await conn.commit();
    return res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error("ERROR editar requisición:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  } finally {
    conn.release();
  }
});

export default router;
