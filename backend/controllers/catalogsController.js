import { pool } from "../db/connection.js";

export const getUresCatalog = async (req, res) => {
  try {
    const role = String(req.query.role || "head_office");

    if (role === "coordinador") {
      const query = `
        SELECT
          c.ure,
          c.name AS nombre_ure,
          c.id AS coordination_id,
          c.name AS coordinacion
        FROM coordination c
        ORDER BY c.ure ASC
      `;
      const [rows] = await pool.query(query);
      return res.json(rows);
    }

    if (role === "secretaria") {
      const query = `
        SELECT
          s.ure,
          s.name AS nombre_ure,
          NULL AS coordination_id,
          c.name AS coordinacion
        FROM secretary s
        LEFT JOIN coordination c ON c.ure = s.ure
        ORDER BY s.ure ASC
      `;
      const [rows] = await pool.query(query);
      return res.json(rows);
    }

    // default: jefe de unidad (head_offices)
    const query = `
      SELECT
        ho.ure,
        ho.name AS nombre_ure,
        c.id AS coordination_id,
        c.name AS coordinacion
      FROM head_offices ho
      LEFT JOIN coordination c ON ho.coordination_id = c.id
      ORDER BY ho.ure ASC
    `;
    const [rows] = await pool.query(query);
    return res.json(rows);
  } catch (error) {
    console.error("Error getUresCatalog:", error);
    res.status(500).json({ message: "Error al cargar catálogo de UREs" });
  }
};
