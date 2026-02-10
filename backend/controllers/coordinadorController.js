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

export const createRequisicionCoordinador = async (req, res) => {
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
        const folioCorto = `CO-${Math.floor(1000 + Math.random() * 9000)}`;

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
        console.error("ERROR crear requisición (coordinador):", err);
        return res.status(500).json({ ok: false, message: "Error interno" });
    } finally {
        conn.release();
    }
};

export const enviarBorradorCoordinador = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.query(
            `
            UPDATE requisition
            SET statuses_id = 9
            WHERE id = ? AND statuses_id = 7
            `,
            [id]
        );

        if (!result.affectedRows) {
            return res.status(400).json({ ok: false, message: "No se puede enviar" });
        }

        return res.json({ ok: true, statuses_id: 9, status: "En secretaría" });
    } catch (err) {
        console.error("ERROR enviar borrador (coordinador):", err);
        return res.status(500).json({ ok: false, message: "Error interno" });
    }
};
