// routes/units.js
import express from "express";
import { pool } from "../db/connection.js";

const router = express.Router();

router.get("/units", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT id, name FROM units ORDER BY name ASC"
        );
        return res.json(rows);
    } catch (error) {
        console.error("Error al obtener unidades:", error);
        return res.status(500).json({ error: "Error en servidor" });
    }
});

export default router;
