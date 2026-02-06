import { pool } from "../db/connection.js";

// --- 1. OBTENER REQUISICIONES  ---
export const getRequisicionesSecretaria = async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT
                r.id,
                r.request_name,
                r.created_at,
                r.statuses_id,
                s.name as nombre_estatus,
                r.observation as observaciones,
                
                u.name as solicitante,
                u.ure as ure_solicitante,
                
                -- 1. NOMBRE DE LA JEFATURA 
                COALESCE(ho.name, u.ure) as nombre_unidad,
                
                -- 2. NOMBRE DE LA COORDINACIÓN 
                COALESCE(c.name, 'General') as coordinacion

            FROM requisition r  
            JOIN statuses s ON r.statuses_id = s.id
            JOIN users u ON r.users_id = u.id
            
            LEFT JOIN head_offices ho ON u.ure = ho.ure
            
            LEFT JOIN coordination c ON ho.coordination_id = c.id
            
            WHERE r.statuses_id IN (9, 10, 12)
            ORDER BY r.created_at DESC
        `;

        const [rows] = await pool.query(query);
        res.json(rows);

    } catch (error) {
        console.error("Error en Lista Secretaria:", error.message);
        res.status(200).json([]); 
    }
};

// --- 2. ACTUALIZAR ESTATUS  ---
export const updateEstatusSecretaria = async (req, res) => {
    try {
        const { id } = req.params; 
        const { status_id, comentarios } = req.body; 
        
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