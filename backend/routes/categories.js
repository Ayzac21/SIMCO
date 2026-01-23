import express from "express";
import { pool } from "../db/connection.js";

const router = express.Router();

router.get("/categories", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT id, name FROM categories ORDER BY name ASC"
        );

        return res.json(rows);
    } catch (error) {
        console.error("Error al obtener categorías:", error);
        return res.status(500).json({ error: "Error en servidor" });
    }
});

export default router;
