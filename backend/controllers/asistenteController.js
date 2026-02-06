import { pool } from "../db/connection.js";

/**
 * Lista requisiciones en revisión (14) del usuario solicitante
 * (por ahora recibe user_id por query)
 */
export const getRevisionRequisitions = async (req, res) => {
    try {
        const userId = Number(req.query.user_id);
        if (!userId) return res.status(400).json({ message: "user_id requerido" });

        const sql = `
        SELECT 
            r.id,
            r.request_name,
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
        WHERE r.users_id = ?
            AND r.statuses_id = 14
        ORDER BY r.created_at DESC
        `;
        const [rows] = await pool.query(sql, [userId]);
        res.json(rows);
    } catch (e) {
        console.error("getRevisionRequisitions:", e);
        res.status(500).json({ message: "Error interno" });
    }
};

/**
 * Data para que el solicitante revise:
 * requisition + items + invitedProviders + savedPrices
 */
export const getRevisionCotizacionData = async (req, res) => {
    try {
        const { id } = req.params;

        const queryReq = `
        SELECT r.id, r.request_name, r.statuses_id, r.quotation_closed_at,
                c.id as category_id, c.name as category_name
        FROM requisition r
        LEFT JOIN categories c ON r.categories_id = c.id
        WHERE r.id = ?
        `;
        const [reqRows] = await pool.query(queryReq, [id]);
        if (reqRows.length === 0) return res.status(404).json({ message: "Requisición no encontrada" });

        const requisition = reqRows[0];

        const queryItems = `
        SELECT li.id, li.quantity, li.description, u.name as unidad_medida
        FROM line_items li
        LEFT JOIN units u ON li.units_id = u.id
        WHERE li.requisition_id = ?
        ORDER BY li.id ASC
        `;
        const [items] = await pool.query(queryItems, [id]);

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

        const queryPrices = `
        SELECT line_item_id, provider_id, unit_price, offered_description, notes, is_winner
        FROM quotation_prices
        WHERE requisition_id = ?
        `;
        const [savedPrices] = await pool.query(queryPrices, [id]);

        res.json({ requisition, items, invitedProviders, savedPrices });
    } catch (e) {
        console.error("getRevisionCotizacionData:", e);
        res.status(500).json({ message: "Error interno" });
    }
};

/**
 * Guardar selección por partida (1 ganador por line_item_id)
 * - actualiza is_winner
 * - cambia requisition a 13 (proceso de compra)
 */
export const submitRevisionSelection = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { id } = req.params;
        const { selection } = req.body;

        if (!Array.isArray(selection) || selection.length === 0) {
        return res.status(400).json({ message: "selection requerida" });
        }

        await conn.beginTransaction();

        // lock requisition
        const [reqRows] = await conn.query(
        `SELECT id, statuses_id FROM requisition WHERE id = ? FOR UPDATE`,
        [id]
        );
        if (reqRows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ message: "Requisición no encontrada" });
        }

        const st = Number(reqRows[0].statuses_id);
        if (st !== 14) {
        await conn.rollback();
        return res.status(400).json({ message: "Solo puedes seleccionar cuando está en revisión (14)" });
        }

        for (const row of selection) {
        const line_item_id = Number(row.line_item_id);
        const provider_id = Number(row.provider_id);
        if (!line_item_id || !provider_id) {
            await conn.rollback();
            return res.status(400).json({ message: "Datos inválidos en selection" });
        }

        // validar que exista esa celda
        const [exists] = await conn.query(
            `SELECT 1 FROM quotation_prices 
            WHERE requisition_id = ? AND line_item_id = ? AND provider_id = ?
            LIMIT 1`,
            [id, line_item_id, provider_id]
        );
        if (exists.length === 0) {
            await conn.rollback();
            return res.status(400).json({
            message: `No existe cotización para partida ${line_item_id} con proveedor ${provider_id}`,
            });
        }

        // poner todos en 0 para esa partida
        await conn.query(
            `UPDATE quotation_prices
            SET is_winner = 0
            WHERE requisition_id = ? AND line_item_id = ?`,
            [id, line_item_id]
        );

        // marcar ganador
        await conn.query(
            `UPDATE quotation_prices
            SET is_winner = 1
            WHERE requisition_id = ? AND line_item_id = ? AND provider_id = ?`,
            [id, line_item_id, provider_id]
        );
        }

        // pasar a proceso de compra (13)
        await conn.query(
        `UPDATE requisition SET statuses_id = 13 WHERE id = ?`,
        [id]
        );

        await conn.commit();
        res.json({ message: "Selección guardada y enviada a compras", requisition_statuses_id: 13 });
    } catch (e) {
        await conn.rollback();
        console.error("submitRevisionSelection:", e);
        res.status(500).json({ message: "Error interno" });
    } finally {
        conn.release();
    }
};
