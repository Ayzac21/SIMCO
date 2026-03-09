import express from "express";
import { pool } from "../db/connection.js";

const router = express.Router();

const isComprasRole = (role) => String(role || "").startsWith("compras_");
const ownerIdRaw = Number(process.env.UNITS_OWNER_ID || 0);
const UNITS_OWNER_ID = Number.isInteger(ownerIdRaw) && ownerIdRaw > 0 ? ownerIdRaw : 0;
const UNITS_OWNER_USER = String(process.env.UNITS_OWNER_USER || "")
  .trim()
  .toLowerCase();

const canMutateUnitsByRole = (role) => {
  const r = String(role || "");
  return isComprasRole(r) && r !== "compras_lector";
};

const canMutateUnits = async (req) => {
  const role = String(req.user?.role || "");
  if (!canMutateUnitsByRole(role)) return false;

  const authId = Number(req.user?.id || 0);
  if (!Number.isInteger(authId) || authId <= 0) return false;
  if (UNITS_OWNER_ID > 0) return authId === UNITS_OWNER_ID;
  if (!UNITS_OWNER_USER) return role === "compras_admin";

  const [rows] = await pool.query(
    `SELECT user_name FROM users WHERE id = ? LIMIT 1`,
    [authId]
  );
  const dbUser = String(rows?.[0]?.user_name || "").trim().toLowerCase();
  return Boolean(dbUser) && dbUser === UNITS_OWNER_USER;
};

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT id, name FROM units ORDER BY id ASC`);
    return res.json(rows);
  } catch (err) {
    console.error("ERROR units:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
});

router.post("/", async (req, res) => {
  try {
    if (!(await canMutateUnits(req))) {
      return res.status(403).json({ ok: false, message: "Acceso restringido" });
    }

    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ ok: false, message: "Nombre requerido" });
    }

    const [dup] = await pool.query(
      `SELECT 1 FROM units WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1`,
      [name]
    );
    if (dup.length > 0) {
      return res.status(409).json({ ok: false, message: "La unidad ya existe" });
    }

    const [result] = await pool.query(`INSERT INTO units (name) VALUES (?)`, [name]);
    return res.json({ ok: true, id: result.insertId, name });
  } catch (err) {
    console.error("ERROR create unit:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!(await canMutateUnits(req))) {
      return res.status(403).json({ ok: false, message: "Acceso restringido" });
    }

    const id = Number(req.params.id);
    const name = String(req.body?.name || "").trim();
    if (!id || !name) {
      return res.status(400).json({ ok: false, message: "Datos inválidos" });
    }

    const [dup] = await pool.query(
      `SELECT 1 FROM units WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id <> ? LIMIT 1`,
      [name, id]
    );
    if (dup.length > 0) {
      return res.status(409).json({ ok: false, message: "La unidad ya existe" });
    }

    const [result] = await pool.query(`UPDATE units SET name = ? WHERE id = ?`, [name, id]);
    if (!result.affectedRows) {
      return res.status(404).json({ ok: false, message: "Unidad no encontrada" });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("ERROR update unit:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
});

export default router;
