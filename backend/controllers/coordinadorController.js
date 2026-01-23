import { pool } from "../db/connection.js"; 

export const getRequisicionItems = async (req, res) => {
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
        console.error("Error al obtener items:", error);
        res.status(500).json({ message: "Error al obtener partidas" });
    }
};


export const getRequisicionesCoordinador = async (req, res) => {
    try {
        const { coordinador_id } = req.params;

        const [rows] = await pool.query("SELECT ure FROM users WHERE id = ?", [coordinador_id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ message: "Coordinador no encontrado" });
        }
        const ureBase = rows[0].ure; 

        const [requisiciones] = await pool.query(
            `
            SELECT 
                r.id,
                r.request_name,
                r.created_at,
                r.statuses_id,
                r.area_folio,
                r.observation,
                r.justification,
                r.notes,       
                u.name AS solicitante,
                u.ure AS ure_solicitante,
                s.name AS nombre_estatus 
            FROM requisition r
            JOIN users u ON r.users_id = u.id
            JOIN statuses s ON r.statuses_id = s.id 
            WHERE u.ure LIKE CONCAT(?, '%')
            AND r.statuses_id != 7 
            ORDER BY r.created_at DESC
            `,
            [ureBase]
        );

        res.json(requisiciones);

    } catch (error) {
        console.error("ERROR FATAL:", error); 
        res.status(500).json({ message: error.message });
    }
};


export const updateEstatusRequisicion = async (req, res) => {
    try {
        const { id } = req.params;            
        const { status_id, comentarios } = req.body;
        
        if (!status_id) {
            return res.status(400).json({ message: "Falta el status_id" });
        }

        const [result] = await pool.query(
            "UPDATE requisition SET statuses_id = ?, notes = ? WHERE id = ?",
            [status_id, comentarios || null, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Requisición no encontrada" });
        }

        res.json({ message: "Estatus actualizado correctamente" });

    } catch (error) {
        console.error("Error al actualizar:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
};