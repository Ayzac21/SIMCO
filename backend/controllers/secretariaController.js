import { pool } from "../db/connection.js";

// --- OBTENER REQUISICIONES PARA SECRETARÍA (Estatus 9) ---
export const getRequisicionesSecretaria = async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT 
                r.id,
                r.request_name,
                r.created_at,
                r.statuses_id,
                s.name as nombre_estatus,
                u.name as solicitante,
                u.ure as ure_solicitante,
                r.observation as observaciones
            FROM requisition r  
            JOIN statuses s ON r.statuses_id = s.id
            JOIN users u ON r.users_id = u.id
            WHERE r.statuses_id = 9
            ORDER BY r.created_at ASC
        `;

        const [rows] = await pool.query(query);
        res.json(rows);

    } catch (error) {
        console.error("Error en getRequisicionesSecretaria:", error);
        res.status(500).json({ message: "Error al obtener requisiciones" });
    }
};

// --- ACTUALIZAR ESTATUS (Autorizar o Rechazar) ---
export const updateEstatusSecretaria = async (req, res) => {
    try {
        const { id } = req.params; 
        const { status_id, comentarios } = req.body; 
        
        // CORRECCIÓN FINAL: 'UPDATE requisition' (Singular)
        const query = `
            UPDATE requisition 
            SET statuses_id = ?, observation = ?
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

// --- OBTENER ITEMS ---
export const getSecretariaItems = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT 
                li.*, 
                u.name AS nombre_unidad
            FROM line_items li
            LEFT JOIN units u ON li.units_id = u.id
            WHERE li.requisition_id = ?
        `;
        const [rows] = await pool.query(query, [id]);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener items" });
    }
};