import { pool } from "../db/connection.js";

/* =============================
   DASHBOARD COMPRAS
   (12 En cotización, 14 En revisión, 13 En proceso de compra)
============================= */
export const getComprasDashboard = async (req, res) => {
  try {
    const query = `
      SELECT 
        r.id,
        r.request_name,
        r.observation,
        r.created_at,
        r.statuses_id,
        s.name as nombre_estatus,
        u.name as solicitante,
        ho.name as nombre_unidad,
        c.name as coordinacion
      FROM requisition r
      LEFT JOIN statuses s ON r.statuses_id = s.id
      LEFT JOIN users u ON r.users_id = u.id
      LEFT JOIN head_offices ho ON u.ure = ho.ure
      LEFT JOIN coordination c ON ho.coordination_id = c.id
      WHERE r.statuses_id IN (12, 14, 13)
      ORDER BY r.created_at DESC
    `;
    const [results] = await pool.query(query);
    res.json(results);
  } catch (error) {
    console.error("Error en dashboard compras:", error);
    res.status(500).json({ message: "Error en el servidor" });
  }
};

/* =============================
   ITEMS DE REQUISICIÓN
============================= */
export const getRequisitionItems = async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT 
        li.id,
        li.quantity,
        li.description,
        un.name AS unidad
      FROM line_items li
      LEFT JOIN units un ON li.units_id = un.id
      WHERE li.requisition_id = ?
    `;
    const [rows] = await pool.query(query, [id]);
    res.json(rows);
  } catch (error) {
    console.error("Error obteniendo items:", error);
    res.status(500).json([]);
  }
};

/* =============================
   DATA PARA GESTIÓN DE COTIZACIÓN
============================= */
export const getCotizacionData = async (req, res) => {
  try {
    const { id } = req.params;

    // Requisición + estado + cierre + categoría
    const queryReq = `
      SELECT 
        r.id,
        r.request_name,
        r.statuses_id,
        r.quotation_closed_at,
        c.id as category_id,
        c.name as category_name
      FROM requisition r
      LEFT JOIN categories c ON r.categories_id = c.id
      WHERE r.id = ?
    `;
    const [reqRows] = await pool.query(queryReq, [id]);
    if (reqRows.length === 0) {
      return res.status(404).json({ message: "Requisición no encontrada" });
    }
    const requisition = reqRows[0];

    // Artículos
    const queryItems = `
      SELECT li.id, li.quantity, li.description, u.name as unidad_medida
      FROM line_items li
      LEFT JOIN units u ON li.units_id = u.id
      WHERE li.requisition_id = ?
    `;
    const [items] = await pool.query(queryItems, [id]);

    // Proveedores sugeridos por categoría
    const queryProvidersSuggested = `
      SELECT DISTINCT p.id, p.name, p.email, p.rfc
      FROM provider p
      INNER JOIN provider_has_category phc ON p.id = phc.provider_id
      WHERE phc.categories_id = ? AND p.statuses_id = 1
      ORDER BY p.name ASC
    `;
    const [providers] = await pool.query(queryProvidersSuggested, [
      requisition.category_id,
    ]);

    // Invitados (con status)
    const queryInvited = `
      SELECT 
        p.id, p.name, p.email, p.rfc,
        qr.status, qr.invited_at, qr.responded_at, qr.deadline_at
      FROM quotation_requests qr
      INNER JOIN provider p ON p.id = qr.provider_id
      WHERE qr.requisition_id = ?
      ORDER BY 
        FIELD(qr.status, 'responded', 'invited', 'expired', 'declined') ASC,
        qr.invited_at DESC
    `;
    const [invitedProviders] = await pool.query(queryInvited, [id]);

    // Precios guardados
    const queryPrices = `
      SELECT line_item_id, provider_id, unit_price, offered_description, notes, is_winner
      FROM quotation_prices
      WHERE requisition_id = ?
    `;
    const [savedPrices] = await pool.query(queryPrices, [id]);

    res.json({ requisition, items, providers, invitedProviders, savedPrices });
  } catch (error) {
    console.error("Error cargando datos de cotización:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

/* =============================
   INVITAR PROVEEDORES
   (si está cerrada o en revisión, NO deja)
============================= */
export const inviteProvidersToCotizacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { provider_ids, deadline_at } = req.body;

    if (!Array.isArray(provider_ids) || provider_ids.length === 0) {
      return res.status(400).json({ message: "provider_ids es requerido" });
    }

    const [reqRows] = await pool.query(
      `SELECT statuses_id, quotation_closed_at FROM requisition WHERE id = ?`,
      [id]
    );

    if (reqRows.length === 0) {
      return res.status(404).json({ message: "Requisición no encontrada" });
    }

    const st = Number(reqRows[0].statuses_id);
    const closedAt = reqRows[0].quotation_closed_at;

    if (st === 14 || closedAt) {
      return res.status(409).json({
        message: "Recepción finalizada. Ya no puedes invitar más proveedores.",
      });
    }

    const queries = provider_ids.map((providerId) => {
      const sql = `
        INSERT INTO quotation_requests (requisition_id, provider_id, status, invited_at, deadline_at)
        VALUES (?, ?, 'invited', NOW(), ?)
        ON DUPLICATE KEY UPDATE
          status = IF(status='responded', status, 'invited'),
          invited_at = IF(invited_at IS NULL, NOW(), invited_at),
          deadline_at = VALUES(deadline_at)
      `;
      return pool.query(sql, [id, providerId, deadline_at || null]);
    });

    await Promise.all(queries);
    res.json({ message: "Proveedores invitados correctamente" });
  } catch (error) {
    console.error("Error invitando proveedores:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

/* =============================
   GUARDAR PRECIOS + DESCRIPCIÓN
   (si está cerrada o en revisión, NO deja)
   (solo proveedores invitados)
   marca responded si mandaron algo
============================= */
export const saveCotizacionPrices = async (req, res) => {
  try {
    const { id } = req.params;
    const { prices } = req.body;

    if (!Array.isArray(prices) || prices.length === 0) {
      return res.status(400).json({ message: "No hay datos para guardar" });
    }

    const [reqRows] = await pool.query(
      `SELECT statuses_id, quotation_closed_at FROM requisition WHERE id = ?`,
      [id]
    );

    if (reqRows.length === 0) {
      return res.status(404).json({ message: "Requisición no encontrada" });
    }

    const st = Number(reqRows[0].statuses_id);
    const closedAt = reqRows[0].quotation_closed_at;

    if (st === 14 || closedAt) {
      return res.status(409).json({
        message: "Recepción finalizada. Ya no puedes modificar la cotización.",
      });
    }

    const providerIdsIncoming = Array.from(
      new Set(prices.map((p) => Number(p.provider_id)).filter(Boolean))
    );
    if (providerIdsIncoming.length === 0) {
      return res.status(400).json({ message: "provider_id inválido" });
    }

    const [invRows] = await pool.query(
      `SELECT provider_id FROM quotation_requests WHERE requisition_id = ?`,
      [id]
    );
    const invitedSet = new Set(invRows.map((r) => Number(r.provider_id)));

    const filtered = prices.filter((p) => invitedSet.has(Number(p.provider_id)));
    if (filtered.length === 0) {
      return res
        .status(400)
        .json({ message: "Ningún proveedor está invitado para guardar datos" });
    }

    const insertQueries = filtered.map((p) => {
      const line_item_id = Number(p.line_item_id);
      const provider_id = Number(p.provider_id);

      const offered_description = (p.offered_description ?? "")
        .toString()
        .trim();

      const raw = p.unit_price;
      const unit_price =
        raw === "" || raw === null || raw === undefined
          ? null
          : Number.isFinite(Number(raw))
          ? Number(raw)
          : null;

      const notes = (p.notes ?? "").toString();
      const is_winner = Number(p.is_winner) ? 1 : 0;

      if (!line_item_id || !provider_id) return Promise.resolve();

      const hasDesc = offered_description.length > 0;
      const hasPrice = unit_price !== null;
      if (!hasDesc && !hasPrice) return Promise.resolve();

      const sql = `
        INSERT INTO quotation_prices
          (requisition_id, line_item_id, provider_id, unit_price, offered_description, notes, is_winner, created_at)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          unit_price = VALUES(unit_price),
          offered_description = VALUES(offered_description),
          notes = VALUES(notes),
          is_winner = VALUES(is_winner)
      `;

      return pool.query(sql, [
        id,
        line_item_id,
        provider_id,
        unit_price,
        offered_description,
        notes,
        is_winner,
      ]);
    });

    await Promise.all(insertQueries);

    const respondedProviderIds = Array.from(
      new Set(
        filtered
          .filter((p) => {
            const desc = (p.offered_description ?? "").toString().trim();
            const raw = p.unit_price;
            const hasDesc = desc.length > 0;
            const hasPrice = !(raw === "" || raw === null || raw === undefined);
            return hasDesc || hasPrice;
          })
          .map((p) => Number(p.provider_id))
          .filter(Boolean)
      )
    );

    if (respondedProviderIds.length > 0) {
      await pool.query(
        `
          UPDATE quotation_requests
          SET status = 'responded',
              responded_at = COALESCE(responded_at, NOW())
          WHERE requisition_id = ?
            AND provider_id IN (${respondedProviderIds.map(() => "?").join(",")})
        `,
        [id, ...respondedProviderIds]
      );
    }

    res.json({ message: "Datos guardados correctamente", respondedProviderIds });
  } catch (error) {
    console.error("Error guardando precios:", error);
    res.status(500).json({ message: "Error al guardar datos" });
  }
};

/* =============================
   BUSCADOR DE TODOS LOS PROVEEDORES
============================= */
export const getAllProviders = async (req, res) => {
  try {
    const { q = "" } = req.query;
    const like = `%${q}%`;

    const sql = `
      SELECT p.id, p.name, p.email, p.rfc
      FROM provider p
      WHERE p.statuses_id = 1
        AND (p.name LIKE ? OR p.email LIKE ? OR p.rfc LIKE ?)
      ORDER BY p.name ASC
      LIMIT 200
    `;
    const [rows] = await pool.query(sql, [like, like, like]);
    res.json(rows);
  } catch (error) {
    console.error("Error getAllProviders:", error);
    res.status(500).json({ message: "Error interno" });
  }
};

/* =============================
   CERRAR RECEPCIÓN
   invited -> expired
   requisition -> 14 (En revisión)
   requisition.quotation_closed_at = NOW()
============================= */
export const closeCotizacionInvites = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;

    await conn.beginTransaction();

    const [reqRows] = await conn.query(
      `
      SELECT id, statuses_id, quotation_closed_at
      FROM requisition
      WHERE id = ? FOR UPDATE
      `,
      [id]
    );

    if (reqRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: "Requisición no encontrada" });
    }

    const reqRow = reqRows[0];

    if (reqRow.quotation_closed_at || Number(reqRow.statuses_id) === 14) {
      await conn.commit();
      return res.json({
        message: "La recepción ya estaba cerrada",
        affectedRows: 0,
        requisition_statuses_id: Number(reqRow.statuses_id),
      });
    }

    if (Number(reqRow.statuses_id) !== 12) {
      await conn.rollback();
      return res.status(400).json({
        message: "Solo se puede cerrar cuando está en 'En cotización' (12)",
        current_status: Number(reqRow.statuses_id),
      });
    }

    const [result] = await conn.query(
      `
      UPDATE quotation_requests
      SET status = 'expired'
      WHERE requisition_id = ?
        AND status = 'invited'
      `,
      [id]
    );

    const closedBy = null;

    await conn.query(
      `
      UPDATE requisition
      SET statuses_id = 14,
          quotation_closed_at = NOW(),
          quotation_closed_by = ?,
          quotation_close_note = NULL
      WHERE id = ?
      `,
      [closedBy, id]
    );

    await conn.commit();

    res.json({
      message: "Recepción cerrada y enviada a revisión",
      affectedRows: result.affectedRows,
      requisition_statuses_id: 14,
    });
  } catch (error) {
    await conn.rollback();
    console.error("Error cerrando invitación:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  } finally {
    conn.release();
  }
};
