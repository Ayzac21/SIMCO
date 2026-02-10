import { pool } from "../db/connection.js";

// --- 1. OBTENER REQUISICIONES  ---
export const getRequisicionesSecretaria = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)));
        const offset = (page - 1) * limit;

        const q = String(req.query.q || "").trim();
        const status = String(req.query.status || "todos");

        const whereParts = ["r.statuses_id IN (9, 10, 12)"];
        const params = [];

        if (status === "pendientes") whereParts.push("r.statuses_id = 9");
        if (status === "aprobadas") whereParts.push("r.statuses_id = 12");
        if (status === "rechazadas") whereParts.push("r.statuses_id = 10");

        if (q) {
            whereParts.push(`
                (
                    CAST(r.id AS CHAR) LIKE ?
                    OR r.request_name LIKE ?
                    OR u.name LIKE ?
                    OR u.ure LIKE ?
                    OR ho.name LIKE ?
                    OR c.name LIKE ?
                    OR c2.name LIKE ?
                )
            `);
            const like = `%${q}%`;
            params.push(like, like, like, like, like, like, like);
        }

        const whereClause = `WHERE ${whereParts.join(" AND ")}`;

        const countQuery = `
            SELECT COUNT(DISTINCT r.id) AS total
            FROM requisition r
            JOIN statuses s ON r.statuses_id = s.id
            JOIN users u ON r.users_id = u.id

            LEFT JOIN head_offices ho
                ON ho.id = (
                    SELECT ho2.id
                    FROM head_offices ho2
                    WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(ho2.ure)), '%')
                    ORDER BY LENGTH(TRIM(ho2.ure)) DESC
                    LIMIT 1
                )

            LEFT JOIN coordination c ON ho.coordination_id = c.id
            LEFT JOIN coordination c2
                ON c2.id = (
                    SELECT c3.id
                    FROM coordination c3
                    WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(c3.ure)), '%')
                    ORDER BY LENGTH(TRIM(c3.ure)) DESC
                    LIMIT 1
                )
            ${whereClause}
        `;

        const [countRows] = await pool.query(countQuery, params);
        const total = Number(countRows?.[0]?.total || 0);

        const query = `
            SELECT DISTINCT
                r.id,
                r.request_name,
                r.created_at,
                r.statuses_id,
                s.name as nombre_estatus,
                r.observation as observaciones,
                r.justification as justificacion,
                r.notes as notas,

                u.name as solicitante,
                u.ure as ure_solicitante,

                COALESCE(NULLIF(TRIM(ho.name), ''), NULLIF(TRIM(c2.name), ''), u.ure) as nombre_unidad,
                COALESCE(NULLIF(TRIM(c.name), ''), NULLIF(TRIM(c2.name), ''), 'General') as coordinacion

            FROM requisition r
            JOIN statuses s ON r.statuses_id = s.id
            JOIN users u ON r.users_id = u.id

            LEFT JOIN head_offices ho
                ON ho.id = (
                    SELECT ho2.id
                    FROM head_offices ho2
                    WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(ho2.ure)), '%')
                    ORDER BY LENGTH(TRIM(ho2.ure)) DESC
                    LIMIT 1
                )

            LEFT JOIN coordination c ON ho.coordination_id = c.id
            
            LEFT JOIN coordination c2
                ON c2.id = (
                    SELECT c3.id
                    FROM coordination c3
                    WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(c3.ure)), '%')
                    ORDER BY LENGTH(TRIM(c3.ure)) DESC
                    LIMIT 1
                )

            ${whereClause}
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const [rows] = await pool.query(query, [...params, limit, offset]);
        res.json({ rows, total, page, limit });

    } catch (error) {
        console.error("Error en Lista Secretaria:", error.message);
        res.status(200).json({ rows: [], total: 0, page: 1, limit: 10 }); 
    }
};

// --- 2. ACTUALIZAR ESTATUS  ---
export const updateEstatusSecretaria = async (req, res) => {
    try {
        const { id } = req.params; 
        const { status_id, comentarios } = req.body; 
        
        const query = `
            UPDATE requisition 
            SET statuses_id = ?, notes = ?
            WHERE id = ?
        `;

        const [result] = await pool.query(query, [status_id, comentarios, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Requisición no encontrada" });
        }
        res.json({ message: "Estatus actualizado correctamente" });
    } catch (error) {
        console.error("Error actualizando estatus:", error);
        res.status(500).json({ message: "Error al actualizar estatus" });
    }
};

// --- 3. OBTENER ITEMS  ---
export const getSecretariaItems = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT 
                li.*, 
                un.name AS unidad
            FROM line_items li
            LEFT JOIN units un ON li.units_id = un.id
            WHERE li.requisition_id = ?
        `;
        const [rows] = await pool.query(query, [id]);
        res.json(rows);
    } catch (error) {
        console.error("Error obteniendo items:", error.message);
        res.status(200).json([]);
    }
};
