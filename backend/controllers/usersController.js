import { pool } from "../db/connection.js";
import bcrypt from "bcryptjs";

const DEFAULT_PASSWORD = "C0mpr@s2026";

export const listUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT id, name, user_name, ure, statuses_id, email, role
      FROM users
      ORDER BY id DESC
      `
    );
    res.json(rows);
  } catch (error) {
    console.error("Error listUsers:", error);
    res.status(500).json({ message: "Error al listar usuarios" });
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, user_name, ure, email = null, password, role } = req.body;

    if (!name || !user_name || !role) {
      return res.status(400).json({ message: "Faltan campos requeridos" });
    }

    const comprasRoles = new Set(["compras_admin", "compras_operador", "compras_lector"]);
    const isCompras = comprasRoles.has(role);

    if (!isCompras && !ure) {
      return res.status(400).json({ message: "URE obligatoria para este rol" });
    }

    const [exists] = await pool.query(
      `SELECT 1 FROM users WHERE user_name = ? LIMIT 1`,
      [user_name]
    );
    if (exists.length > 0) {
      return res.status(409).json({ message: "El usuario ya existe" });
    }

    if (!isCompras) {
      const [ureExists] = await pool.query(
        `SELECT 1 FROM users WHERE ure = ? LIMIT 1`,
        [ure]
      );
      if (ureExists.length > 0) {
        return res.status(409).json({ message: "La URE ya está asignada" });
      }

      let table = "head_offices";
      if (role === "coordinador") table = "coordination";
      if (role === "secretaria") table = "secretary";

      const [ureRows] = await pool.query(
        `SELECT 1 FROM ${table} WHERE ure = ? LIMIT 1`,
        [ure]
      );
      if (ureRows.length === 0) {
        return res.status(400).json({ message: "URE inválida" });
      }
    }

    const finalPassword = password || DEFAULT_PASSWORD;
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    const [result] = await pool.query(
      `
      INSERT INTO users (name, user_name, ure, statuses_id, email, password, role)
      VALUES (?, ?, ?, 1, ?, ?, ?)
      `,
      [name, user_name, isCompras ? null : ure, email, hashedPassword, role]
    );

    res.json({ ok: true, id: result.insertId });
  } catch (error) {
    console.error("Error createUser:", error);
    res.status(500).json({ message: "Error al crear usuario" });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, user_name, ure, email = null, role } = req.body;

    if (!name || !user_name || !role) {
      return res.status(400).json({ message: "Faltan campos requeridos" });
    }

    const comprasRoles = new Set(["compras_admin", "compras_operador", "compras_lector"]);
    const isCompras = comprasRoles.has(role);

    if (!isCompras && !ure) {
      return res.status(400).json({ message: "URE obligatoria para este rol" });
    }

    const [exists] = await pool.query(
      `SELECT 1 FROM users WHERE user_name = ? AND id != ? LIMIT 1`,
      [user_name, id]
    );
    if (exists.length > 0) {
      return res.status(409).json({ message: "El usuario ya existe" });
    }

    if (!isCompras) {
      const [ureExists] = await pool.query(
        `SELECT 1 FROM users WHERE ure = ? AND id != ? LIMIT 1`,
        [ure, id]
      );
      if (ureExists.length > 0) {
        return res.status(409).json({ message: "La URE ya está asignada" });
      }

      let table = "head_offices";
      if (role === "coordinador") table = "coordination";
      if (role === "secretaria") table = "secretary";

      const [ureRows] = await pool.query(
        `SELECT 1 FROM ${table} WHERE ure = ? LIMIT 1`,
        [ure]
      );
      if (ureRows.length === 0) {
        return res.status(400).json({ message: "URE inválida" });
      }
    }

    const [result] = await pool.query(
      `
      UPDATE users
      SET name = ?, user_name = ?, ure = ?, email = ?, role = ?
      WHERE id = ?
      `,
      [name, user_name, isCompras ? null : ure, email, role, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Error updateUser:", error);
    res.status(500).json({ message: "Error al actualizar usuario" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query(`DELETE FROM users WHERE id = ?`, [id]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("Error deleteUser:", error);
    res.status(500).json({ message: "Error al eliminar usuario" });
  }
};

export const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query(
      `
      UPDATE users
      SET password = ?
      WHERE id = ?
      `,
      [await bcrypt.hash(DEFAULT_PASSWORD, 10), id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("Error resetUserPassword:", error);
    res.status(500).json({ message: "Error al resetear contraseña" });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { statuses_id } = req.body;

    if (typeof statuses_id === "undefined") {
      return res.status(400).json({ message: "Falta statuses_id" });
    }

    const [statusRows] = await pool.query(
      `SELECT 1 FROM statuses WHERE id = ? LIMIT 1`,
      [statuses_id]
    );
    if (statusRows.length === 0) {
      return res.status(400).json({ message: "Estatus inválido" });
    }

    const [result] = await pool.query(
      `
      UPDATE users
      SET statuses_id = ?
      WHERE id = ?
      `,
      [statuses_id, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("Error updateUserStatus:", error);
    res.status(500).json({ message: "Error al actualizar estatus" });
  }
};
