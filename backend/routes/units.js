import express from "express";
import { pool } from "../db/connection.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT id, name FROM units ORDER BY id ASC`);
    return res.json(rows);
  } catch (err) {
    console.error("ERROR units:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
});

export default router;
