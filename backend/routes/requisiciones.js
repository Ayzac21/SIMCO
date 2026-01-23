import express from "express";
import { pool } from "../db/connection.js";

const router = express.Router();
console.log("✔ Rutas de requisiciones cargadas");

/* ======================================================
    CREAR REQUISICIÓN (SIEMPRE BORRADOR)
====================================================== */
router.post("/requisiciones", async (req, res) => {
    const conn = await pool.getConnection();

    try {
        const {
            users_id,
            categoria,
            articulos,
            notes = "",
            request_name = "",
            justification = "",
            observation = ""
        } = req.body;

        if (!users_id || !articulos || articulos.length === 0) {
            return res.status(400).json({ ok: false, message: "Datos incompletos" });
        }

        await conn.beginTransaction();

        const now = new Date();
        const folioCorto = `AF-${Math.floor(1000 + Math.random() * 9000)}`;

        const [result] = await conn.query(
            `INSERT INTO requisition
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                null,
                folioCorto,
                notes,
                users_id,
                7, // BORRADOR
                "",
                now,
                null,
                categoria || 1,
                request_name,
                justification,
                observation
            ]
        );

        const requisitionId = result.insertId;

        for (const art of articulos) {
            await conn.query(
                `INSERT INTO line_items
                (product_name, description, quantity, units_id, requisition_id)
                VALUES (?, ?, ?, ?, ?)`,
                [
                    art.producto,
                    art.especificaciones || "",
                    Number(art.cantidad),
                    art.units_id || 1,
                    requisitionId
                ]
            );
        }

        await conn.commit();

        res.json({
            ok: true,
            id: requisitionId,
            folio: folioCorto,
            status: "En borrador"
        });

    } catch (err) {
        await conn.rollback();
        console.error("ERROR crear requisición:", err);
        res.status(500).json({ ok: false });
    } finally {
        conn.release();
    }
});

/* ======================================================
    LISTAR MIS REQUISICIONES
====================================================== */
router.get("/requisiciones/mis-requisiciones/:users_id", async (req, res) => {
    const { users_id } = req.params;

    const [rows] = await pool.query(`
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
    `, [users_id]);

    res.json(rows);
});

/* ======================================================
    OBTENER REQUISICIÓN + PARTIDAS (EDITAR)
====================================================== */
router.get("/requisiciones/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const [[requisicion]] = await pool.query(`
            SELECT
                r.id,
                r.notes,
                r.request_name,
                r.justification,
                r.observation,
                r.statuses_id,
                s.name AS estatus
            FROM requisition r
            JOIN statuses s ON r.statuses_id = s.id
            WHERE r.id = ?
        `, [id]);

        if (!requisicion) {
            return res.status(404).json({ ok: false });
        }

        const [partidas] = await pool.query(`
            SELECT
                id,
                product_name,
                description,
                quantity,
                units_id
            FROM line_items
            WHERE requisition_id = ?
        `, [id]);

        res.json({
            ...requisicion,
            partidas
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false });
    }
});

/* ======================================================
    EDITAR REQUISICIÓN + PARTIDAS (SOLO BORRADOR)
====================================================== */
router.put("/requisiciones/:id", async (req, res) => {
    const conn = await pool.getConnection();
    const { id } = req.params;

    const {
        notes,
        request_name,
        justification,
        observation,
        partidas
    } = req.body;

    try {
        await conn.beginTransaction();

        await conn.query(`
            UPDATE requisition
            SET
                notes = ?,
                request_name = ?,
                justification = ?,
                observation = ?
            WHERE id = ? AND statuses_id = 7
        `, [notes, request_name, justification, observation, id]);

        const [actuales] = await conn.query(
            `SELECT id FROM line_items WHERE requisition_id = ?`,
            [id]
        );

        const idsActuales = actuales.map(p => p.id);
        const idsRecibidos = partidas.filter(p => p.id).map(p => p.id);

        const eliminar = idsActuales.filter(id => !idsRecibidos.includes(id));
        if (eliminar.length) {
            await conn.query(`DELETE FROM line_items WHERE id IN (?)`, [eliminar]);
        }

        for (const p of partidas) {
            if (p.id) {
                await conn.query(`
                    UPDATE line_items
                    SET product_name=?, description=?, quantity=?, units_id=?
                    WHERE id=?
                `, [p.product_name, p.description, p.quantity, p.units_id, p.id]);
            } else {
                await conn.query(`
                    INSERT INTO line_items
                    (product_name, description, quantity, units_id, requisition_id)
                    VALUES (?, ?, ?, ?, ?)
                `, [p.product_name, p.description, p.quantity, p.units_id, id]);
            }
        }

        await conn.commit();
        res.json({ ok: true });

    } catch (err) {
        await conn.rollback();
        console.error("ERROR editar requisición:", err);
        res.status(500).json({ ok: false });
    } finally {
        conn.release();
    }
});

/* ======================================================
    ENVIAR A COORDINACIÓN
====================================================== */
router.patch("/requisiciones/:id/enviar", async (req, res) => {
    const { id } = req.params;

    const [result] = await pool.query(`
        UPDATE requisition
        SET statuses_id = 8
        WHERE id = ? AND statuses_id = 7
    `, [id]);

    if (!result.affectedRows) {
        return res.status(400).json({
            ok: false,
            message: "No se puede enviar"
        });
    }

    res.json({
        ok: true,
        statuses_id: 8,
        status: "En coordinación"
    });
});

export default router;
