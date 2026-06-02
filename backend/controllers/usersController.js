import { pool } from "../db/connection.js";
import bcrypt from "bcryptjs";

const DEFAULT_PASSWORD = process.env.DEFAULT_USER_PASSWORD || "";

const rejectFinanceUserManagement = async (id, res) => {
  const [rows] = await pool.query(`SELECT role FROM users WHERE id = ? LIMIT 1`, [id]);
  if (rows.length === 0) {
    res.status(404).json({ message: "Usuario no encontrado" });
    return true;
  }
  if (["finanzas", "finanzas_admin", "finanzas_analista", "finanzas_lector"].includes(rows[0].role)) {
    res.status(403).json({ message: "Los usuarios de Finanzas se administran desde el perfil de Finanzas" });
    return true;
  }
  return false;
};

export const listUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        u.user_name,
        u.ure,
        u.statuses_id,
        u.email,
        u.role,
        COALESCE(
          NULLIF(TRIM(
            CASE
              WHEN u.role = 'head_office' THEN ho.name
              WHEN u.role = 'secretaria' THEN sec.name
              WHEN u.role = 'coordinador' THEN co.name
              ELSE NULL
            END
          ), ''),
          NULLIF(TRIM(ho.name), ''),
          NULLIF(TRIM(sec.name), ''),
          NULLIF(TRIM(co.name), ''),
          NULLIF(TRIM(u.ure), '')
        ) AS ure_name
      FROM users u
      LEFT JOIN head_offices ho
        ON TRIM(UPPER(ho.ure)) = TRIM(UPPER(u.ure))
      LEFT JOIN secretary sec
        ON TRIM(UPPER(sec.ure)) = TRIM(UPPER(u.ure))
      LEFT JOIN coordination co
        ON TRIM(UPPER(co.ure)) = TRIM(UPPER(u.ure))
      WHERE u.role NOT IN ('finanzas', 'finanzas_admin', 'finanzas_analista', 'finanzas_lector')
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
    const cleanUre = String(ure || "").trim();

    if (!name || !user_name || !role) {
      return res.status(400).json({ message: "Faltan campos requeridos" });
    }

    if (["finanzas", "finanzas_admin", "finanzas_analista", "finanzas_lector"].includes(role)) {
      return res.status(403).json({ message: "Los usuarios de Finanzas se administran desde el perfil de Finanzas" });
    }

    const comprasRoles = new Set(["compras_admin", "compras_operador", "compras_lector"]);
    const isCompras = comprasRoles.has(role);

    if (!isCompras && !cleanUre) {
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
        [cleanUre]
      );
      if (ureExists.length > 0) {
        return res.status(409).json({ message: "La URE ya está asignada" });
      }

      let table = "head_offices";
      if (role === "coordinador") table = "coordination";
      if (role === "secretaria") table = "secretary";

      const [ureRows] = await pool.query(
        `SELECT 1 FROM ${table} WHERE ure = ? LIMIT 1`,
        [cleanUre]
      );
      if (ureRows.length === 0) {
        return res.status(400).json({ message: "URE inválida" });
      }
    } else if (cleanUre) {
      const [ureRows] = await pool.query(
        `
        SELECT 1
        FROM (
          SELECT ure FROM head_offices
          UNION ALL
          SELECT ure FROM secretary
          UNION ALL
          SELECT ure FROM coordination
        ) x
        WHERE TRIM(UPPER(x.ure)) = TRIM(UPPER(?))
        LIMIT 1
        `,
        [cleanUre]
      );
      if (ureRows.length === 0) {
        return res.status(400).json({ message: "URE inválida para Compras" });
      }
    }

    const finalPassword = password || DEFAULT_PASSWORD;
    if (!finalPassword) {
      return res.status(400).json({
        message: "Debes proporcionar password o configurar DEFAULT_USER_PASSWORD"
      });
    }
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    const [result] = await pool.query(
      `
      INSERT INTO users (name, user_name, ure, statuses_id, email, password, role)
      VALUES (?, ?, ?, 1, ?, ?, ?)
      `,
      [name, user_name, cleanUre || null, email, hashedPassword, role]
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
    const cleanUre = String(ure || "").trim();

    if (!name || !user_name || !role) {
      return res.status(400).json({ message: "Faltan campos requeridos" });
    }

    if (await rejectFinanceUserManagement(id, res)) return;
    if (["finanzas", "finanzas_admin", "finanzas_analista", "finanzas_lector"].includes(role)) {
      return res.status(403).json({ message: "Los usuarios de Finanzas se administran desde el perfil de Finanzas" });
    }

    const comprasRoles = new Set(["compras_admin", "compras_operador", "compras_lector"]);
    const isCompras = comprasRoles.has(role);

    if (!isCompras && !cleanUre) {
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
        [cleanUre, id]
      );
      if (ureExists.length > 0) {
        return res.status(409).json({ message: "La URE ya está asignada" });
      }

      let table = "head_offices";
      if (role === "coordinador") table = "coordination";
      if (role === "secretaria") table = "secretary";

      const [ureRows] = await pool.query(
        `SELECT 1 FROM ${table} WHERE ure = ? LIMIT 1`,
        [cleanUre]
      );
      if (ureRows.length === 0) {
        return res.status(400).json({ message: "URE inválida" });
      }
    } else if (cleanUre) {
      const [ureRows] = await pool.query(
        `
        SELECT 1
        FROM (
          SELECT ure FROM head_offices
          UNION ALL
          SELECT ure FROM secretary
          UNION ALL
          SELECT ure FROM coordination
        ) x
        WHERE TRIM(UPPER(x.ure)) = TRIM(UPPER(?))
        LIMIT 1
        `,
        [cleanUre]
      );
      if (ureRows.length === 0) {
        return res.status(400).json({ message: "URE inválida para Compras" });
      }
    }

    const [result] = await pool.query(
      `
      UPDATE users
      SET name = ?, user_name = ?, ure = ?, email = ?, role = ?
      WHERE id = ?
      `,
      [name, user_name, cleanUre || null, email, role, id]
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
    if (await rejectFinanceUserManagement(id, res)) return;
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
    const { password } = req.body || {};
    const nextPassword = password || DEFAULT_PASSWORD;
    if (await rejectFinanceUserManagement(id, res)) return;

    if (!nextPassword) {
      return res.status(400).json({
        message: "Debes proporcionar password o configurar DEFAULT_USER_PASSWORD"
      });
    }

    const [result] = await pool.query(
      `
      UPDATE users
      SET password = ?
      WHERE id = ?
      `,
      [await bcrypt.hash(nextPassword, 10), id]
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
    if (await rejectFinanceUserManagement(id, res)) return;

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
