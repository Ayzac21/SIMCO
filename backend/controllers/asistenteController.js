import { pool } from "../db/connection.js";
import { logRequisitionStatusChange } from "../services/statusHistory.js";

const parseUserId = (value) => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : 0;
};

const getAuthUserId = (req) => parseUserId(req.user?.id);

const ensureOwnsRequisition = async (req, res, requisitionId, connOrPool = pool) => {
    const authId = getAuthUserId(req);
    if (!authId) {
        res.status(401).json({ message: "No autorizado" });
        return false;
    }

    const [[row]] = await connOrPool.query(
        `SELECT users_id FROM requisition WHERE id = ? LIMIT 1`,
        [requisitionId]
    );
    if (!row) {
        res.status(404).json({ message: "Requisición no encontrada" });
        return false;
    }

    if (parseUserId(row.users_id) !== authId) {
        res.status(403).json({ message: "Acceso denegado" });
        return false;
    }
    return true;
};

/**
 * Lista requisiciones en revisión (14) del usuario solicitante
 * (por ahora recibe user_id por query)
 */
export const getRevisionRequisitions = async (req, res) => {
    try {
        const authUserId = getAuthUserId(req);
        if (!authUserId) return res.status(401).json({ message: "No autorizado" });

        const requestedUserId = req.query.user_id == null ? authUserId : Number(req.query.user_id);
        if (!requestedUserId) return res.status(400).json({ message: "user_id inválido" });
        if (requestedUserId !== authUserId) return res.status(403).json({ message: "Acceso denegado" });

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
        const [rows] = await pool.query(sql, [authUserId]);
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
        const ownsReq = await ensureOwnsRequisition(req, res, id);
        if (!ownsReq) return;

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
        const ownsReq = await ensureOwnsRequisition(req, res, id, conn);
        if (!ownsReq) return;

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
        await logRequisitionStatusChange(
            {
                requisitionId: id,
                fromStatusId: 14,
                toStatusId: 13,
                changedBy: getAuthUserId(req),
                note: "Selección de cotización por solicitante",
            },
            conn
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
