import { pool } from "../db/connection.js";
import PDFDocument from "pdfkit";
import { PDFDocument as PDFLibDocument } from "pdf-lib";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesDir = path.resolve(__dirname, "..", "templates");

const ensureAssignedOrAdmin = async (req, res, requisitionId) => {
  const role = req.user?.role || "";
  if (role === "compras_admin" || role === "compras_lector") return true;

  const userId = Number(req.user?.id || 0);
  if (!userId) {
    res.status(401).json({ message: "Usuario no identificado" });
    return false;
  }

  const [rows] = await pool.query(
    `SELECT assigned_operator_id FROM requisition WHERE id = ? LIMIT 1`,
    [requisitionId]
  );
  if (rows.length === 0) {
    res.status(404).json({ message: "Requisición no encontrada" });
    return false;
  }

  const assignedId = Number(rows[0].assigned_operator_id || 0);
  if (assignedId !== userId) {
    res.status(403).json({ message: "No tienes acceso a esta requisición" });
    return false;
  }
  return true;
};

/* =============================
   DASHBOARD COMPRAS
   (12 En cotización, 14 En revisión, 13 En proceso de compra)
============================= */
export const getComprasDashboard = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)));
    const offset = (page - 1) * limit;

    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "all");
    const role = req.user?.role || "";
    const assignedTo =
      role === "compras_admin" || role === "compras_lector"
        ? req.query.assigned_to
          ? Number(req.query.assigned_to)
          : null
        : Number(req.user?.id || 0);

    const whereParts = ["r.statuses_id IN (12, 14, 13)"];
    const params = [];

    if (["12", "14", "13"].includes(status)) {
      whereParts.push("r.statuses_id = ?");
      params.push(Number(status));
    }

    if (q) {
      whereParts.push(`
        (
          CAST(r.id AS CHAR) LIKE ?
          OR r.request_name LIKE ?
          OR u.name LIKE ?
          OR u.ure LIKE ?
          OR ho.name LIKE ?
          OR c.name LIKE ?
          OR c2.name LIKE ?
        )
      `);
      const like = `%${q}%`;
      params.push(like, like, like, like, like, like, like);
    }

    if (assignedTo) {
      whereParts.push("r.assigned_operator_id = ?");
      params.push(assignedTo);
    }

    const whereClause = `WHERE ${whereParts.join(" AND ")}`;

    const countQuery = `
      SELECT COUNT(DISTINCT r.id) AS total
      FROM requisition r
      LEFT JOIN users u ON r.users_id = u.id
      LEFT JOIN head_offices ho
        ON ho.id = (
          SELECT ho2.id
          FROM head_offices ho2
          WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(ho2.ure)), '%')
          ORDER BY LENGTH(TRIM(ho2.ure)) DESC
          LIMIT 1
        )
      LEFT JOIN coordination c ON ho.coordination_id = c.id
      LEFT JOIN coordination c2
        ON c2.id = (
          SELECT c3.id
          FROM coordination c3
          WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(c3.ure)), '%')
          ORDER BY LENGTH(TRIM(c3.ure)) DESC
          LIMIT 1
        )
      ${whereClause}
    `;

    const [countRows] = await pool.query(countQuery, params);
    const total = Number(countRows?.[0]?.total || 0);

    const countsParams = [];
    const countsWhere = ["r.statuses_id IN (12,14,13)"];
    if (assignedTo) {
      countsWhere.push("r.assigned_operator_id = ?");
      countsParams.push(assignedTo);
    }
    const [countsRows] = await pool.query(
      `
      SELECT
        SUM(CASE WHEN r.statuses_id = 12 THEN 1 ELSE 0 END) AS c12,
        SUM(CASE WHEN r.statuses_id = 14 THEN 1 ELSE 0 END) AS c14,
        SUM(CASE WHEN r.statuses_id = 13 THEN 1 ELSE 0 END) AS c13,
        SUM(CASE WHEN r.statuses_id IN (12,14,13) THEN 1 ELSE 0 END) AS total,
        SUM(
          CASE 
            WHEN r.statuses_id IN (12,14) 
             AND DATEDIFF(NOW(), r.created_at) >= 7 
            THEN 1 ELSE 0 
          END
        ) AS high
      FROM requisition r
      WHERE ${countsWhere.join(" AND ")}
      `,
      countsParams
    );
    const counts = countsRows?.[0] || {};

    const query = `
      SELECT 
        r.id,
        r.request_name,
        r.observation,
        r.justification,
        r.notes,
        r.created_at,
        r.statuses_id,
        r.order_type,
        r.folio,
        r.assigned_operator_id,
        s.name as nombre_estatus,
        u.name as solicitante,
        au.name as assigned_operator_name,
        COALESCE(NULLIF(TRIM(ho.name), ''), NULLIF(TRIM(c2.name), ''), u.ure) as nombre_unidad,
        COALESCE(NULLIF(TRIM(c.name), ''), NULLIF(TRIM(c2.name), ''), 'General') as coordinacion
      FROM requisition r
      LEFT JOIN statuses s ON r.statuses_id = s.id
      LEFT JOIN users u ON r.users_id = u.id
      LEFT JOIN users au ON r.assigned_operator_id = au.id
      LEFT JOIN head_offices ho
        ON ho.id = (
          SELECT ho2.id
          FROM head_offices ho2
          WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(ho2.ure)), '%')
          ORDER BY LENGTH(TRIM(ho2.ure)) DESC
          LIMIT 1
        )
      LEFT JOIN coordination c ON ho.coordination_id = c.id
      LEFT JOIN coordination c2
        ON c2.id = (
          SELECT c3.id
          FROM coordination c3
          WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(c3.ure)), '%')
          ORDER BY LENGTH(TRIM(c3.ure)) DESC
          LIMIT 1
        )
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [results] = await pool.query(query, [...params, limit, offset]);
    res.json({ rows: results, total, page, limit, counts });
  } catch (error) {
    console.error("Error en dashboard compras:", error);
    res.status(500).json({ message: "Error en el servidor" });
  }
};

/* =============================
   OPERADORES DE COMPRAS
============================= */
export const getComprasOperators = async (req, res) => {
  try {
    if (req.user?.role !== "compras_admin") {
      return res.status(403).json({ message: "Solo admin puede ver operadores" });
    }

    const [rows] = await pool.query(
      `
      SELECT id, name, user_name
      FROM users
      WHERE role = 'compras_operador' AND statuses_id = 1
      ORDER BY name ASC
      `
    );
    res.json(rows);
  } catch (error) {
    console.error("Error getComprasOperators:", error);
    res.status(500).json({ message: "Error al listar operadores" });
  }
};

/* =============================
   ASIGNAR REQUISICION A OPERADOR
============================= */
export const assignRequisitionOperator = async (req, res) => {
  try {
    if (req.user?.role !== "compras_admin") {
      return res.status(403).json({ message: "Solo admin puede asignar" });
    }

    const { id } = req.params;
    const { assigned_operator_id } = req.body;

    if (typeof assigned_operator_id === "undefined") {
      return res.status(400).json({ message: "Falta assigned_operator_id" });
    }

    if (assigned_operator_id !== null) {
      const [opRows] = await pool.query(
        `SELECT 1 FROM users WHERE id = ? AND role = 'compras_operador' AND statuses_id = 1 LIMIT 1`,
        [assigned_operator_id]
      );
      if (opRows.length === 0) {
        return res.status(400).json({ message: "Operador inválido" });
      }
    }

    const [result] = await pool.query(
      `
      UPDATE requisition
      SET assigned_operator_id = ?
      WHERE id = ?
      `,
      [assigned_operator_id, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Requisición no encontrada" });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("Error assignRequisitionOperator:", error);
    res.status(500).json({ message: "Error al asignar operador" });
  }
};

/* =============================
   ACTUALIZAR ESTATUS DESDE COMPRAS
   (rechazar: 10)
============================= */
export const updateEstatusCompras = async (req, res) => {
  try {
    const { id } = req.params;
    const { status_id, comentarios } = req.body;

    if (!status_id) {
      return res.status(400).json({ message: "Falta status_id" });
    }

    if (Number(status_id) === 10 && req.user?.role !== "compras_admin") {
      return res.status(403).json({ message: "Solo admin puede rechazar" });
    }

    const ok = await ensureAssignedOrAdmin(req, res, id);
    if (!ok) return;

    if (Number(status_id) === 11) {
      const [rows] = await pool.query(
        `
        SELECT
          qs.provider_id,
          p.name AS provider_name,
          m.folio
        FROM quotation_selections qs
        LEFT JOIN provider p ON p.id = qs.provider_id
        LEFT JOIN orden_compra_meta m
          ON m.requisition_id = qs.requisition_id
         AND m.provider_id = qs.provider_id
        WHERE qs.requisition_id = ?
        GROUP BY qs.provider_id, p.name, m.folio
        `,
        [id]
      );

      if (!rows.length) {
        return res.status(400).json({
          message: "No hay proveedores seleccionados para marcar como comprada",
        });
      }

      const missing = rows.filter((r) => !String(r.folio || "").trim());
      if (missing.length) {
        const names = missing
          .map((r) => r.provider_name || `ID ${r.provider_id}`)
          .join(", ");
        return res.status(400).json({
          message: `Falta folio para: ${names}`,
        });
      }
    }

    const [result] = await pool.query(
      `
      UPDATE requisition
      SET statuses_id = ?, notes = ?
      WHERE id = ?
      `,
      [status_id, comentarios || null, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Requisición no encontrada" });
    }

    res.json({ message: "Estatus actualizado correctamente" });
  } catch (error) {
    console.error("Error updateEstatusCompras:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

/* =============================
   HISTORIAL COMPRAS (10, 11)
============================= */
export const getComprasHistorial = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)));
    const offset = (page - 1) * limit;

    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "all");
    const role = req.user?.role || "";
    const assignedTo =
      role === "compras_admin" || role === "compras_lector"
        ? req.query.assigned_to
          ? Number(req.query.assigned_to)
          : null
        : Number(req.user?.id || 0);

    const whereParts = ["r.statuses_id IN (10, 11)"];
    const params = [];

    if (["10", "11"].includes(status)) {
      whereParts.push("r.statuses_id = ?");
      params.push(Number(status));
    }

    if (q) {
      whereParts.push(`
        (
          CAST(r.id AS CHAR) LIKE ?
          OR r.request_name LIKE ?
          OR u.name LIKE ?
          OR u.ure LIKE ?
          OR ho.name LIKE ?
          OR c.name LIKE ?
          OR c2.name LIKE ?
        )
      `);
      const like = `%${q}%`;
      params.push(like, like, like, like, like, like, like);
    }

    if (assignedTo) {
      whereParts.push("r.assigned_operator_id = ?");
      params.push(assignedTo);
    }

    const whereClause = `WHERE ${whereParts.join(" AND ")}`;

    const countQuery = `
      SELECT COUNT(DISTINCT r.id) AS total
      FROM requisition r
      LEFT JOIN users u ON r.users_id = u.id
      LEFT JOIN head_offices ho
        ON ho.id = (
          SELECT ho2.id
          FROM head_offices ho2
          WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(ho2.ure)), '%')
          ORDER BY LENGTH(TRIM(ho2.ure)) DESC
          LIMIT 1
        )
      LEFT JOIN coordination c ON ho.coordination_id = c.id
      LEFT JOIN coordination c2
        ON c2.id = (
          SELECT c3.id
          FROM coordination c3
          WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(c3.ure)), '%')
          ORDER BY LENGTH(TRIM(c3.ure)) DESC
          LIMIT 1
        )
      ${whereClause}
    `;

    const [countRows] = await pool.query(countQuery, params);
    const total = Number(countRows?.[0]?.total || 0);

    const query = `
      SELECT 
        r.id,
        r.request_name,
        r.observation,
        r.justification,
        r.notes,
        r.created_at,
        r.statuses_id,
        r.order_type,
        s.name as nombre_estatus,
        u.name as solicitante,
        COALESCE(NULLIF(TRIM(ho.name), ''), NULLIF(TRIM(c2.name), ''), u.ure) as nombre_unidad,
        COALESCE(NULLIF(TRIM(c.name), ''), NULLIF(TRIM(c2.name), ''), 'General') as coordinacion
      FROM requisition r
      LEFT JOIN statuses s ON r.statuses_id = s.id
      LEFT JOIN users u ON r.users_id = u.id
      LEFT JOIN head_offices ho
        ON ho.id = (
          SELECT ho2.id
          FROM head_offices ho2
          WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(ho2.ure)), '%')
          ORDER BY LENGTH(TRIM(ho2.ure)) DESC
          LIMIT 1
        )
      LEFT JOIN coordination c ON ho.coordination_id = c.id
      LEFT JOIN coordination c2
        ON c2.id = (
          SELECT c3.id
          FROM coordination c3
          WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(c3.ure)), '%')
          ORDER BY LENGTH(TRIM(c3.ure)) DESC
          LIMIT 1
        )
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [results] = await pool.query(query, [...params, limit, offset]);
    res.json({ rows: results, total, page, limit });
  } catch (error) {
    console.error("Error en historial compras:", error);
    res.status(500).json({ message: "Error en el servidor" });
  }
};

/* =============================
   REPORTE PDF HISTORIAL COMPRAS
   (filtros actuales + opcional partidas)
============================= */
export const getComprasHistorialReport = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "all");
    const includeItems = String(req.query.include_items || "0") === "1";
    const role = req.user?.role || "";
    const assignedTo =
      role === "compras_admin" || role === "compras_lector"
        ? req.query.assigned_to
          ? Number(req.query.assigned_to)
          : null
        : Number(req.user?.id || 0);

    const whereParts = ["r.statuses_id IN (10, 11)"];
    const params = [];

    if (["10", "11"].includes(status)) {
      whereParts.push("r.statuses_id = ?");
      params.push(Number(status));
    }

    if (q) {
      whereParts.push(`
        (
          CAST(r.id AS CHAR) LIKE ?
          OR r.request_name LIKE ?
          OR u.name LIKE ?
          OR u.ure LIKE ?
          OR ho.name LIKE ?
          OR c.name LIKE ?
          OR c2.name LIKE ?
        )
      `);
      const like = `%${q}%`;
      params.push(like, like, like, like, like, like, like);
    }

    if (assignedTo) {
      whereParts.push("r.assigned_operator_id = ?");
      params.push(assignedTo);
    }

    const whereClause = `WHERE ${whereParts.join(" AND ")}`;

    const query = `
      SELECT 
        r.id,
        r.request_name,
        r.created_at,
        r.statuses_id,
        s.name as nombre_estatus,
        r.notes,
        u.name as solicitante,
        COALESCE(NULLIF(TRIM(ho.name), ''), NULLIF(TRIM(c2.name), ''), u.ure) as nombre_unidad,
        COALESCE(NULLIF(TRIM(c.name), ''), NULLIF(TRIM(c2.name), ''), 'General') as coordinacion
      FROM requisition r
      LEFT JOIN statuses s ON r.statuses_id = s.id
      LEFT JOIN users u ON r.users_id = u.id
      LEFT JOIN head_offices ho
        ON ho.id = (
          SELECT ho2.id
          FROM head_offices ho2
          WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(ho2.ure)), '%')
          ORDER BY LENGTH(TRIM(ho2.ure)) DESC
          LIMIT 1
        )
      LEFT JOIN coordination c ON ho.coordination_id = c.id
      LEFT JOIN coordination c2
        ON c2.id = (
          SELECT c3.id
          FROM coordination c3
          WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(c3.ure)), '%')
          ORDER BY LENGTH(TRIM(c3.ure)) DESC
          LIMIT 1
        )
      ${whereClause}
      ORDER BY r.created_at DESC
    `;

    const [rows] = await pool.query(query, params);

    let itemsByReq = {};
    if (includeItems && rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const [items] = await pool.query(
        `
        SELECT 
          li.requisition_id,
          li.quantity,
          li.description,
          un.name AS unidad
        FROM line_items li
        LEFT JOIN units un ON li.units_id = un.id
        WHERE li.requisition_id IN (${ids.map(() => "?").join(",")})
        ORDER BY li.requisition_id ASC, li.id ASC
        `,
        ids
      );
      itemsByReq = items.reduce((acc, it) => {
        if (!acc[it.requisition_id]) acc[it.requisition_id] = [];
        acc[it.requisition_id].push(it);
        return acc;
      }, {});
    }

    const total = rows.length;
    const compradas = rows.filter((r) => Number(r.statuses_id) === 11).length;
    const rechazadas = rows.filter((r) => Number(r.statuses_id) === 10).length;
    const pctRechazo = total > 0 ? Math.round((rechazadas / total) * 100) : 0;

    const topAreas = {};
    rows.forEach((r) => {
      const key = r.nombre_unidad || "Sin Unidad";
      topAreas[key] = (topAreas[key] || 0) + 1;
    });
    const topAreasList = Object.entries(topAreas)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    res.setHeader("Content-Type", "application/pdf");
    const statusLabel =
      status === "11" ? "Compradas" : status === "10" ? "Rechazadas" : "Todas";
    const dateIso = new Date().toISOString().slice(0, 10);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Historial_Compras_${dateIso}_${statusLabel}.pdf"`
    );

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    doc.pipe(res);

    const now = new Date();
    const dateStr = now.toLocaleDateString("es-MX", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });

    // Header
    doc.fontSize(18).fillColor("#000").text("Historial de Compras – SIMCO", { align: "left" });
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor("#555").text(`Fecha de emisión: ${dateStr}`);
    doc.text(`Filtros: ${statusLabel} | Búsqueda: ${q || "—"}`);
    doc.text(`Registros: ${total}`);
    doc.moveDown(1);

    // Resumen ejecutivo (bloques)
    const summaryY = doc.y;
    const boxW = 120;
    const gap = 12;

    const drawBox = (x, y, title, value) => {
      doc.roundedRect(x, y, boxW, 46, 6).fillAndStroke("#f3f4f6", "#e5e7eb");
      doc.fillColor("#6b7280").fontSize(8).text(title, x + 8, y + 8);
      doc.fillColor("#111827").fontSize(14).text(String(value), x + 8, y + 22);
    };

    drawBox(40, summaryY, "COMPRADAS", compradas);
    drawBox(40 + boxW + gap, summaryY, "RECHAZADAS", rechazadas);
    drawBox(40 + (boxW + gap) * 2, summaryY, "% RECHAZO", `${pctRechazo}%`);
    drawBox(40 + (boxW + gap) * 3, summaryY, "TOTAL", total);

    doc.y = summaryY + 60;

    // Top áreas (mini tabla)
    if (topAreasList.length > 0) {
      doc.fontSize(11).fillColor("#000").text("Top áreas", 40, doc.y);
      doc.moveDown(0.3);
      const tx = 40;
      let ty = doc.y;
      doc.fontSize(9).fillColor("#555");
      doc.text("Área", tx, ty);
      doc.text("Total", tx + 360, ty, { width: 60, align: "right" });
      doc.moveTo(40, ty + 12).lineTo(555, ty + 12).strokeColor("#ddd").stroke();
      ty += 18;
      doc.fillColor("#111827");
      topAreasList.forEach(([name, count]) => {
        doc.text(name, tx, ty, { width: 360 });
        doc.text(String(count), tx + 360, ty, { width: 60, align: "right" });
        ty += 14;
      });
      doc.y = ty + 8;
    }

    doc.fontSize(12).fillColor("#000").text("Detalle");
    doc.moveDown(0.4);

    doc.fontSize(12).text("Detalle");
    doc.moveDown(0.4);

    const colX = { folio: 40, proj: 90, unidad: 270, estatus: 430, fecha: 505 };
    const rowMinHeight = 16;
    let y = doc.y;

    const drawHeader = () => {
      doc.fontSize(9).fillColor("#111827");
      doc.text("Folio", colX.folio, y);
      doc.text("Proyecto", colX.proj, y);
      doc.text("Unidad", colX.unidad, y);
      doc.text("Estatus", colX.estatus, y);
      doc.text("Fecha", colX.fecha, y);
      doc.moveTo(40, y + 12).lineTo(555, y + 12).strokeColor("#cbd5e1").stroke();
      y += rowMinHeight;
      doc.fillColor("#000");
    };

    drawHeader();

    rows.forEach((r) => {
      if (y > 760) {
        doc.addPage();
        y = doc.y;
        drawHeader();
      }

      doc.fontSize(9);
      const projText = r.request_name || "—";
      const unidadText = r.nombre_unidad || "—";
      const fechaText = new Date(r.created_at).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      const hProj = doc.heightOfString(projText, { width: 170 });
      const hUnidad = doc.heightOfString(unidadText, { width: 150 });
      const rowH = Math.max(rowMinHeight, hProj, hUnidad);

      doc.text(`#${r.id}`, colX.folio, y);
      doc.text(projText, colX.proj, y, { width: 170 });
      doc.text(unidadText, colX.unidad, y, { width: 150 });
      doc.text(Number(r.statuses_id) === 11 ? "Comprado" : "Rechazado", colX.estatus, y);
      doc.text(fechaText, colX.fecha, y);
      y += rowH;

      if (Number(r.statuses_id) === 10 && r.notes) {
        doc.fillColor("#aa0000").fontSize(8).text(`Motivo: ${r.notes}`, colX.proj, y, { width: 420 });
        doc.fillColor("#000");
        y += rowMinHeight;
      }

      if (includeItems && itemsByReq[r.id]?.length) {
        doc.fontSize(8).fillColor("#333").text("Partidas:", colX.proj, y);
        y += rowMinHeight - 4;
        itemsByReq[r.id].forEach((it) => {
          if (y > 760) {
            doc.addPage();
            y = doc.y;
          }
          doc.text(`• ${it.quantity} ${it.unidad || ""} - ${it.description || ""}`, colX.proj + 10, y, { width: 430 });
          y += rowMinHeight - 4;
        });
        doc.fillColor("#000");
        y += 4;
      }
    });

    doc.end();
  } catch (error) {
    console.error("Error generando reporte PDF:", error);
    res.status(500).json({ message: "Error al generar reporte" });
  }
};

/* =============================
   ITEMS DE REQUISICIÓN
============================= */
export const getRequisitionItems = async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await ensureAssignedOrAdmin(req, res, id);
    if (!ok) return;

    const query = `
      SELECT 
        li.id,
        li.quantity,
        li.description,
        un.name AS unidad
      FROM line_items li
      LEFT JOIN units un ON li.units_id = un.id
      WHERE li.requisition_id = ?
    `;
    const [rows] = await pool.query(query, [id]);
    res.json(rows);
  } catch (error) {
    console.error("Error obteniendo items:", error);
    res.status(500).json([]);
  }
};

/* =============================
   SELECCION PARA PROCESO DE COMPRA (13)
============================= */
export const getCompraSeleccion = async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await ensureAssignedOrAdmin(req, res, id);
    if (!ok) return;

    const queryReq = `
      SELECT 
        r.id,
        r.request_name,
        r.observation,
        r.justification,
        r.notes,
        r.created_at,
        r.statuses_id,
        s.name as nombre_estatus,
        u.name as solicitante,
        u.ure as ure_solicitante,
        COALESCE(NULLIF(TRIM(ho.name), ''), NULLIF(TRIM(c2.name), ''), u.ure) as nombre_unidad,
        COALESCE(NULLIF(TRIM(c.name), ''), NULLIF(TRIM(c2.name), ''), 'General') as coordinacion
      FROM requisition r
      LEFT JOIN statuses s ON r.statuses_id = s.id
      LEFT JOIN users u ON r.users_id = u.id
      LEFT JOIN head_offices ho
        ON ho.id = (
          SELECT ho2.id
          FROM head_offices ho2
          WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(ho2.ure)), '%')
          ORDER BY LENGTH(TRIM(ho2.ure)) DESC
          LIMIT 1
        )
      LEFT JOIN coordination c ON ho.coordination_id = c.id
      LEFT JOIN coordination c2
        ON c2.id = (
          SELECT c3.id
          FROM coordination c3
          WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(c3.ure)), '%')
          ORDER BY LENGTH(TRIM(c3.ure)) DESC
          LIMIT 1
        )
      WHERE r.id = ?
    `;

    const [reqRows] = await pool.query(queryReq, [id]);
    if (reqRows.length === 0) {
      return res.status(404).json({ message: "Requisición no encontrada" });
    }

    const requisition = reqRows[0];
    if (Number(requisition.statuses_id) !== 13) {
      return res.status(400).json({
        message: "La requisición no está en proceso de compra (13)",
        current_status: requisition.statuses_id,
      });
    }

    const queryItems = `
      SELECT 
        li.id,
        li.quantity,
        li.description,
        u.name AS unidad_medida,
        qs.provider_id,
        p.name AS provider_name,
        qs.selected_unit_price,
        qs.selected_description
      FROM line_items li
      LEFT JOIN units u ON li.units_id = u.id
      LEFT JOIN quotation_selections qs
        ON qs.requisition_id = li.requisition_id
        AND qs.line_item_id = li.id
      LEFT JOIN provider p ON p.id = qs.provider_id
      WHERE li.requisition_id = ?
      ORDER BY li.id ASC
    `;

    const [items] = await pool.query(queryItems, [id]);

    const [[tot]] = await pool.query(
      `SELECT COUNT(*) AS total FROM line_items WHERE requisition_id = ?`,
      [id]
    );

    const [[sel]] = await pool.query(
      `
      SELECT COUNT(DISTINCT line_item_id) AS selected
      FROM quotation_selections
      WHERE requisition_id = ?
      `,
      [id]
    );

    const [[lastSel]] = await pool.query(
      `
      SELECT MAX(updated_at) AS last_selection_at
      FROM quotation_selections
      WHERE requisition_id = ?
      `,
      [id]
    );

    const total = Number(tot?.total || 0);
    const selected = Number(sel?.selected || 0);
    const missing = Math.max(0, total - selected);

    res.json({
      requisition,
      items,
      summary: {
        total_items: total,
        selected_items: selected,
        missing_items: missing,
        is_complete: total > 0 && selected === total,
        last_selection_at: lastSel?.last_selection_at || null,
      },
    });
  } catch (error) {
    console.error("Error getCompraSeleccion:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

/* =============================
   ORDEN DE COMPRA PDF (plantilla UDG)
============================= */
export const getOrdenCompraPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const providerIdParam = Number(req.query.provider_id || 0);
    const ok = await ensureAssignedOrAdmin(req, res, id);
    if (!ok) return;

    const queryReq = `
      SELECT 
        r.id,
        r.request_name,
        r.observation,
        r.justification,
        r.notes,
        r.created_at,
        r.statuses_id,
        r.folio,
        r.order_type,
        u.name as solicitante,
        u.ure as ure_solicitante,
        COALESCE(NULLIF(TRIM(ho.name), ''), NULLIF(TRIM(c2.name), ''), u.ure) as nombre_unidad,
        COALESCE(NULLIF(TRIM(c.name), ''), NULLIF(TRIM(c2.name), ''), 'General') as coordinacion
      FROM requisition r
      LEFT JOIN users u ON r.users_id = u.id
      LEFT JOIN head_offices ho
        ON ho.id = (
          SELECT ho2.id
          FROM head_offices ho2
          WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(ho2.ure)), '%')
          ORDER BY LENGTH(TRIM(ho2.ure)) DESC
          LIMIT 1
        )
      LEFT JOIN coordination c ON ho.coordination_id = c.id
      LEFT JOIN coordination c2
        ON c2.id = (
          SELECT c3.id
          FROM coordination c3
          WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(c3.ure)), '%')
          ORDER BY LENGTH(TRIM(c3.ure)) DESC
          LIMIT 1
        )
      WHERE r.id = ?
    `;
    const [reqRows] = await pool.query(queryReq, [id]);
    if (reqRows.length === 0) {
      return res.status(404).json({ message: "Requisición no encontrada" });
    }

    const requisition = reqRows[0];
    const st = Number(requisition.statuses_id);
    if (![13, 11].includes(st)) {
      return res.status(400).json({
        message: "Solo disponible en proceso de compra (13) o comprada (11)",
        current_status: st,
      });
    }

    const queryItems = `
      SELECT 
        li.id,
        li.quantity,
        li.description,
        u.name AS unidad_medida,
        qs.provider_id,
        p.name AS provider_name,
        qs.selected_unit_price,
        qs.selected_description
      FROM line_items li
      LEFT JOIN units u ON li.units_id = u.id
      LEFT JOIN quotation_selections qs
        ON qs.requisition_id = li.requisition_id
        AND qs.line_item_id = li.id
      LEFT JOIN provider p ON p.id = qs.provider_id
      WHERE li.requisition_id = ?
      ORDER BY li.id ASC
    `;
    const [itemsRaw] = await pool.query(queryItems, [id]);

    const items = (itemsRaw || []).filter((it) => Number(it.provider_id));
    if (items.length === 0) {
      return res.status(400).json({ message: "No hay partidas seleccionadas" });
    }

    const providerIds = Array.from(new Set(items.map((i) => Number(i.provider_id))));
    let providerId = providerIdParam || 0;
    if (!providerId) {
      if (providerIds.length !== 1) {
        return res.status(400).json({
          message: "Selecciona un proveedor para generar la orden",
          providers_count: providerIds.length,
        });
      }
      providerId = providerIds[0];
    }
    if (!providerIds.includes(providerId)) {
      return res.status(400).json({
        message: "Proveedor inválido para esta requisición",
      });
    }

    const itemsByProvider = items.filter((it) => Number(it.provider_id) === providerId);
    if (itemsByProvider.length === 0) {
      return res.status(400).json({ message: "No hay partidas para ese proveedor" });
    }
    const [provRows] = await pool.query(
      `
      SELECT 
        p.id,
        p.name,
        p.rfc,
        p.email,
        p.address,
        GROUP_CONCAT(ph.phone SEPARATOR ', ') AS phones
      FROM provider p
      LEFT JOIN provider_has_phones php ON php.provider_id = p.id
      LEFT JOIN phones ph ON ph.id = php.phones_id
      WHERE p.id = ?
      GROUP BY p.id
      `,
      [providerId]
    );
    const provider = provRows?.[0] || {};

    const [metaRows] = await pool.query(
      `
      SELECT folio, oc_incluir_iva, oc_iva_porcentaje
      FROM orden_compra_meta
      WHERE requisition_id = ? AND provider_id = ?
      LIMIT 1
      `,
      [id, providerId]
    );
    const meta = metaRows?.[0] || {};
    const folioValue = meta.folio ?? requisition.folio ?? null;
    const incluirIvaMeta = meta.oc_incluir_iva ?? 0;
    const ivaPctMeta = meta.oc_iva_porcentaje ?? 0;
    const orderType =
      String(requisition.order_type || "compra").toLowerCase() === "servicio"
        ? "servicio"
        : "compra";

    const resolveTemplatePath = async (envPath, fallbackPath) => {
      if (envPath) {
        try {
          await fs.access(envPath);
          return envPath;
        } catch {
          // fallback to bundled template
        }
      }
      return fallbackPath;
    };

    const templatePath =
      orderType === "servicio"
        ? await resolveTemplatePath(
            process.env.ORDEN_SERVICIO_TEMPLATE,
            path.join(templatesDir, "ORDEN_DE_SERVICIO.pdf")
          )
        : await resolveTemplatePath(
            process.env.ORDEN_COMPRA_TEMPLATE,
            path.join(templatesDir, "ORDEN_DE_COMPRA.pdf")
          );

    const templateBytes = await fs.readFile(templatePath);
    const outputDoc = await PDFLibDocument.create();

    const formatDate = (d) => {
      const dt = d instanceof Date ? d : new Date(d);
      const dd = String(dt.getDate()).padStart(2, "0");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const yyyy = dt.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    const formatMoney = (n) => {
      const num = Number(n);
      if (!Number.isFinite(num)) return "";
      return num.toFixed(2);
    };

    const setText = (form, name, value) => {
      try {
        const field = form.getTextField(name);
        field.setText(value == null ? "" : String(value));
      } catch {}
    };

    const setCheck = (form, name, checked) => {
      try {
        const field = form.getCheckBox(name);
        if (checked) field.check();
        else field.uncheck();
      } catch {}
    };

    const common = {
      "NUMERO": folioValue ? String(folioValue) : String(requisition.id),
      "FECHA DE ELABORACION": formatDate(new Date()),
      "ENTIDAD o DEPENDENCIA EMISORA": "UNIVERSIDAD DE GUADALAJARA",
      "No PROYECTO": "",
      "No FONDO": "",
      "PROGRAMA": "",
      "CÓDIGO DE URERow1": requisition.ure_solicitante || "",
      "ENTIDAD o DEPENDENCIA SOLICITANTERow1": requisition.nombre_unidad || requisition.ure_solicitante || "",
      "TELEFONO DE LA DEPENDENCIA": "3787828033",
      "DOMICILIO DE LA DEPENDENCIA": "Av. Rafael Casillas Aceves #1200, Col. Popotes, Tepatitlan de Morelos, Jalisco C.P 47620",
      "PROVEEDOR": provider.name || "",
      "RFC": provider.rfc || "",
      "FAX/EMAIL": provider.email || "",
      "TELEFONO DEL PROVEEDOR": provider.phones || "",
      "DOMICILO DEL PROVEEDOR": provider.address || "",
      "LUGAR DE ENTREGA": requisition.nombre_unidad || "",
      "OBSERVACIONES": requisition.observation || requisition.notes || "",
      "FECHA DE INICIO": "",
      "FECHA DE CONCLUCION": "",
      "FECHA DE PAGO": "",
      "No DE PARCIALIDADES": "",
      "PORCENTAJE DE ANTICIPO": "",
    };

    for (const it of itemsByProvider) {
      const srcDoc = await PDFLibDocument.load(templateBytes);
      const form = srcDoc.getForm();

      Object.entries(common).forEach(([k, v]) => setText(form, k, v));
      setCheck(form, "PAGO DE CONTADO", true);
      setCheck(form, "PAGO EN PARCIALIDADES", false);
      setCheck(form, "a) ANTICIPO", false);
      setCheck(form, "b CUMPLIMIENTO", false);

      const qty = Number(it.quantity || 0);
      const unit = Number(it.selected_unit_price || 0);
      const total = qty * unit;
      const incluirIva = Number(incluirIvaMeta) === 1;
      const ivaPct = Number(ivaPctMeta || 0);
      const iva = incluirIva ? (total * ivaPct) / 100 : 0;
      const totalConIva = total + iva;

      setText(form, "CANTIDADRow1", qty ? String(qty) : "");
      setText(form, "DESCRIPCIÓN DE LOS SERVICIOSRow1", it.selected_description || it.description || "");
      setText(form, "PRECIO UNITARIORow1", unit ? formatMoney(unit) : "");
      setText(form, "IMPORTE TOTALRow1", total ? formatMoney(total) : "");
      setText(form, "IMPORTE TOTALSUBTOTAL IVA TOTAL", total ? formatMoney(total) : "");
      setText(form, "IMPORTE TOTALSUBTOTAL IVA TOTAL_2", iva ? formatMoney(iva) : "0.00");
      setText(form, "IMPORTE TOTALSUBTOTAL IVA TOTAL_3", totalConIva ? formatMoney(totalConIva) : "");
      setText(form, "IMPORTE CON LETRA", "");

      form.flatten();

      const pageIndices = srcDoc.getPageIndices();
      const copied = await outputDoc.copyPages(srcDoc, pageIndices);
      copied.forEach((p) => outputDoc.addPage(p));
    }

    const pdfBytes = await outputDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"Orden_Compra_${id}.pdf\"`
    );
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error("Error generando orden PDF:", error);
    res.status(500).json({ message: "Error al generar PDF" });
  }
};

export const getOrdenCompraProviders = async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await ensureAssignedOrAdmin(req, res, id);
    if (!ok) return;

    const [rows] = await pool.query(
      `
      SELECT DISTINCT p.id, p.name
      FROM quotation_selections qs
      INNER JOIN provider p ON p.id = qs.provider_id
      WHERE qs.requisition_id = ?
      ORDER BY p.name ASC
      `,
      [id]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error getOrdenCompraProviders:", error);
    res.status(500).json({ message: "Error interno" });
  }
};

export const updateOrdenCompraMeta = async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await ensureAssignedOrAdmin(req, res, id);
    if (!ok) return;

    const { provider_id, folio, oc_incluir_iva, oc_iva_porcentaje } = req.body || {};
    const providerId = Number(provider_id || 0);
    if (!providerId) {
      return res.status(400).json({ message: "provider_id es requerido" });
    }

    const incluir = Number(oc_incluir_iva) ? 1 : 0;
    const pct =
      oc_iva_porcentaje === null || oc_iva_porcentaje === undefined || oc_iva_porcentaje === ""
        ? null
        : Number(oc_iva_porcentaje);

    if (pct != null && (!Number.isFinite(pct) || pct < 0 || pct > 100)) {
      return res.status(400).json({ message: "IVA inválido" });
    }

    await pool.query(
      `
      INSERT INTO orden_compra_meta
        (requisition_id, provider_id, folio, oc_incluir_iva, oc_iva_porcentaje)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        folio = VALUES(folio),
        oc_incluir_iva = VALUES(oc_incluir_iva),
        oc_iva_porcentaje = VALUES(oc_iva_porcentaje)
      `,
      [id, providerId, folio || null, incluir, pct]
    );

    res.json({ message: "Datos de orden actualizados" });
  } catch (error) {
    console.error("Error updateOrdenCompraMeta:", error);
    res.status(500).json({ message: "Error interno" });
  }
};

export const getOrdenCompraMeta = async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await ensureAssignedOrAdmin(req, res, id);
    if (!ok) return;

    const [rows] = await pool.query(
      `
      SELECT provider_id, folio, oc_incluir_iva, oc_iva_porcentaje
      FROM orden_compra_meta
      WHERE requisition_id = ?
      `,
      [id]
    );
    res.json(rows);
  } catch (error) {
    console.error("Error getOrdenCompraMeta:", error);
    res.status(500).json({ message: "Error interno" });
  }
};

export const updateOrdenCompraType = async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await ensureAssignedOrAdmin(req, res, id);
    if (!ok) return;

    const { order_type } = req.body || {};
    const safeType =
      String(order_type || "compra").toLowerCase() === "servicio" ? "servicio" : "compra";

    await pool.query(
      `
      UPDATE requisition
      SET order_type = ?
      WHERE id = ?
      `,
      [safeType, id]
    );

    res.json({ message: "Tipo de orden actualizado" });
  } catch (error) {
    console.error("Error updateOrdenCompraType:", error);
    res.status(500).json({ message: "Error interno" });
  }
};

/* =============================
   DATA PARA GESTIÓN DE COTIZACIÓN
============================= */
export const getCotizacionData = async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await ensureAssignedOrAdmin(req, res, id);
    if (!ok) return;

    // Requisición + estado + cierre + categoría
    const queryReq = `
      SELECT 
        r.id,
        r.request_name,
        r.statuses_id,
        r.quotation_closed_at,
        c.id as category_id,
        c.name as category_name
      FROM requisition r
      LEFT JOIN categories c ON r.categories_id = c.id
      WHERE r.id = ?
    `;
    const [reqRows] = await pool.query(queryReq, [id]);
    if (reqRows.length === 0) {
      return res.status(404).json({ message: "Requisición no encontrada" });
    }
    const requisition = reqRows[0];

    // Artículos
    const queryItems = `
      SELECT li.id, li.quantity, li.description, u.name as unidad_medida
      FROM line_items li
      LEFT JOIN units u ON li.units_id = u.id
      WHERE li.requisition_id = ?
    `;
    const [items] = await pool.query(queryItems, [id]);

    // Proveedores sugeridos por categoría
    const queryProvidersSuggested = `
      SELECT DISTINCT p.id, p.name, p.email, p.rfc
      FROM provider p
      INNER JOIN provider_has_category phc ON p.id = phc.provider_id
      WHERE phc.categories_id = ? AND p.statuses_id = 1
      ORDER BY p.name ASC
    `;
    const [providers] = await pool.query(queryProvidersSuggested, [
      requisition.category_id,
    ]);

    // Invitados (con status)
    const queryInvited = `
      SELECT 
        p.id, p.name, p.email, p.rfc,
        qr.status, qr.invited_at, qr.responded_at, qr.deadline_at
      FROM quotation_requests qr
      INNER JOIN provider p ON p.id = qr.provider_id
      WHERE qr.requisition_id = ?
      ORDER BY 
        FIELD(qr.status, 'responded', 'invited', 'expired', 'declined') ASC,
        qr.invited_at DESC
    `;
    const [invitedProviders] = await pool.query(queryInvited, [id]);

    // Precios guardados
    const queryPrices = `
      SELECT line_item_id, provider_id, unit_price, offered_description, notes, is_winner
      FROM quotation_prices
      WHERE requisition_id = ?
    `;
    const [savedPrices] = await pool.query(queryPrices, [id]);

    res.json({ requisition, items, providers, invitedProviders, savedPrices });
  } catch (error) {
    console.error("Error cargando datos de cotización:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

/* =============================
   INVITAR PROVEEDORES
   (si está cerrada o en revisión, NO deja)
============================= */
export const inviteProvidersToCotizacion = async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await ensureAssignedOrAdmin(req, res, id);
    if (!ok) return;

    const { provider_ids, deadline_at } = req.body;

    if (!Array.isArray(provider_ids) || provider_ids.length === 0) {
      return res.status(400).json({ message: "provider_ids es requerido" });
    }

    const [reqRows] = await pool.query(
      `SELECT statuses_id, quotation_closed_at FROM requisition WHERE id = ?`,
      [id]
    );

    if (reqRows.length === 0) {
      return res.status(404).json({ message: "Requisición no encontrada" });
    }

    const st = Number(reqRows[0].statuses_id);
    const closedAt = reqRows[0].quotation_closed_at;

    if (st === 14 || closedAt) {
      return res.status(409).json({
        message: "Recepción finalizada. Ya no puedes invitar más proveedores.",
      });
    }

    const queries = provider_ids.map((providerId) => {
      const sql = `
        INSERT INTO quotation_requests (requisition_id, provider_id, status, invited_at, deadline_at)
        VALUES (?, ?, 'invited', NOW(), ?)
        ON DUPLICATE KEY UPDATE
          status = IF(status='responded', status, 'invited'),
          invited_at = IF(invited_at IS NULL, NOW(), invited_at),
          deadline_at = VALUES(deadline_at)
      `;
      return pool.query(sql, [id, providerId, deadline_at || null]);
    });

    await Promise.all(queries);
    res.json({ message: "Proveedores invitados correctamente" });
  } catch (error) {
    console.error("Error invitando proveedores:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

/* =============================
   GUARDAR PRECIOS + DESCRIPCIÓN
   (si está cerrada o en revisión, NO deja)
   (solo proveedores invitados)
   marca responded si mandaron algo
============================= */
export const saveCotizacionPrices = async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await ensureAssignedOrAdmin(req, res, id);
    if (!ok) return;

    const { prices } = req.body;

    if (!Array.isArray(prices) || prices.length === 0) {
      return res.status(400).json({ message: "No hay datos para guardar" });
    }

    const [reqRows] = await pool.query(
      `SELECT statuses_id, quotation_closed_at FROM requisition WHERE id = ?`,
      [id]
    );

    if (reqRows.length === 0) {
      return res.status(404).json({ message: "Requisición no encontrada" });
    }

    const st = Number(reqRows[0].statuses_id);
    const closedAt = reqRows[0].quotation_closed_at;

    if (st === 14 || closedAt) {
      return res.status(409).json({
        message: "Recepción finalizada. Ya no puedes modificar la cotización.",
      });
    }

    const providerIdsIncoming = Array.from(
      new Set(prices.map((p) => Number(p.provider_id)).filter(Boolean))
    );
    if (providerIdsIncoming.length === 0) {
      return res.status(400).json({ message: "provider_id inválido" });
    }

    const [invRows] = await pool.query(
      `SELECT provider_id FROM quotation_requests WHERE requisition_id = ?`,
      [id]
    );
    const invitedSet = new Set(invRows.map((r) => Number(r.provider_id)));

    const filtered = prices.filter((p) => invitedSet.has(Number(p.provider_id)));
    if (filtered.length === 0) {
      return res
        .status(400)
        .json({ message: "Ningún proveedor está invitado para guardar datos" });
    }

    const insertQueries = filtered.map((p) => {
      const line_item_id = Number(p.line_item_id);
      const provider_id = Number(p.provider_id);

      const offered_description = (p.offered_description ?? "")
        .toString()
        .trim();

      const raw = p.unit_price;
      const unit_price =
        raw === "" || raw === null || raw === undefined
          ? null
          : Number.isFinite(Number(raw))
          ? Number(raw)
          : null;

      const notes = (p.notes ?? "").toString();
      const is_winner = Number(p.is_winner) ? 1 : 0;

      if (!line_item_id || !provider_id) return Promise.resolve();

      const hasDesc = offered_description.length > 0;
      const hasPrice = unit_price !== null;
      if (!hasDesc && !hasPrice) return Promise.resolve();

      const sql = `
        INSERT INTO quotation_prices
          (requisition_id, line_item_id, provider_id, unit_price, offered_description, notes, is_winner, created_at)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          unit_price = VALUES(unit_price),
          offered_description = VALUES(offered_description),
          notes = VALUES(notes),
          is_winner = VALUES(is_winner)
      `;

      return pool.query(sql, [
        id,
        line_item_id,
        provider_id,
        unit_price,
        offered_description,
        notes,
        is_winner,
      ]);
    });

    await Promise.all(insertQueries);

    const respondedProviderIds = Array.from(
      new Set(
        filtered
          .filter((p) => {
            const desc = (p.offered_description ?? "").toString().trim();
            const raw = p.unit_price;
            const hasDesc = desc.length > 0;
            const hasPrice = !(raw === "" || raw === null || raw === undefined);
            return hasDesc || hasPrice;
          })
          .map((p) => Number(p.provider_id))
          .filter(Boolean)
      )
    );

    if (respondedProviderIds.length > 0) {
      await pool.query(
        `
          UPDATE quotation_requests
          SET status = 'responded',
              responded_at = COALESCE(responded_at, NOW())
          WHERE requisition_id = ?
            AND provider_id IN (${respondedProviderIds.map(() => "?").join(",")})
        `,
        [id, ...respondedProviderIds]
      );
    }

    res.json({ message: "Datos guardados correctamente", respondedProviderIds });
  } catch (error) {
    console.error("Error guardando precios:", error);
    res.status(500).json({ message: "Error al guardar datos" });
  }
};

/* =============================
   BUSCADOR DE TODOS LOS PROVEEDORES
============================= */
export const getAllProviders = async (req, res) => {
  try {
    const { q = "" } = req.query;
    const like = `%${q}%`;

    const sql = `
      SELECT p.id, p.name, p.razon_social, p.email, p.rfc
      FROM provider p
      WHERE p.statuses_id IN (1, 3, 5)
        AND (p.name LIKE ? OR p.razon_social LIKE ? OR p.email LIKE ? OR p.rfc LIKE ?)
      ORDER BY p.name ASC
      LIMIT 200
    `;
    const [rows] = await pool.query(sql, [like, like, like, like]);
    res.json(rows);
  } catch (error) {
    console.error("Error getAllProviders:", error);
    res.status(500).json({ message: "Error interno" });
  }
};

/* =============================
   PROVEEDORES - ADMIN
============================= */
export const getProvidersAdmin = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "all");
    const like = `%${q}%`;

    const where = ["1=1"];
    const params = [];
    if (q) {
      where.push("(p.name LIKE ? OR p.razon_social LIKE ? OR p.email LIKE ? OR p.rfc LIKE ?)");
      params.push(like, like, like, like);
    }
    if (status !== "all") {
      where.push("p.statuses_id = ?");
      params.push(Number(status));
    }

    const [rows] = await pool.query(
      `
      SELECT p.id, p.name, p.razon_social, p.email, p.rfc, p.statuses_id, p.address
      FROM provider p
      WHERE ${where.join(" AND ")}
      ORDER BY p.name ASC
      LIMIT 500
      `,
      params
    );

    const providerIds = rows.map((r) => r.id);
    let categoriesByProvider = {};
    let phonesByProvider = {};

    if (providerIds.length > 0) {
      const [catRows] = await pool.query(
        `
        SELECT phc.provider_id, c.id AS category_id, c.name AS category_name
        FROM provider_has_category phc
        INNER JOIN categories c ON c.id = phc.categories_id
        WHERE phc.provider_id IN (${providerIds.map(() => "?").join(",")})
        `,
        providerIds
      );
      categoriesByProvider = catRows.reduce((acc, row) => {
        if (!acc[row.provider_id]) acc[row.provider_id] = [];
        acc[row.provider_id].push({
          id: row.category_id,
          name: row.category_name,
        });
        return acc;
      }, {});

      const [phoneRows] = await pool.query(
        `
        SELECT php.provider_id, ph.id AS phone_id, ph.phone
        FROM provider_has_phones php
        INNER JOIN phones ph ON ph.id = php.phones_id
        WHERE php.provider_id IN (${providerIds.map(() => "?").join(",")})
        `,
        providerIds
      );
      phonesByProvider = phoneRows.reduce((acc, row) => {
        if (!acc[row.provider_id]) acc[row.provider_id] = [];
        acc[row.provider_id].push({
          id: row.phone_id,
          phone: row.phone,
        });
        return acc;
      }, {});
    }

    const data = rows.map((p) => ({
      ...p,
      categories: categoriesByProvider[p.id] || [],
      phones: phonesByProvider[p.id] || [],
    }));

    res.json(data);
  } catch (error) {
    console.error("Error getProvidersAdmin:", error);
    res.status(500).json({ message: "Error interno" });
  }
};

export const createProvider = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      name,
      razon_social = null,
      email = null,
      rfc,
      address = null,
      statuses_id = 6,
      categories = [],
      phones = [],
    } = req.body || {};

    const cleanName = String(name || "").trim();
    const cleanRazon = razon_social ? String(razon_social).trim() : null;
    const cleanEmail = email ? String(email).trim() : null;
    const cleanAddress = address ? String(address).trim() : null;
    const cleanRfc = String(rfc || "").trim().toUpperCase();
    const rfcRegex = /^[A-ZÑ&]{3,4}\\d{6}[A-Z0-9]{3}$/;

    if (!cleanName) {
      return res.status(400).json({ message: "name es requerido" });
    }
    if (!cleanRfc) {
      return res.status(400).json({ message: "rfc es requerido" });
    }
    if (!rfcRegex.test(cleanRfc)) {
      return res.status(400).json({ message: "RFC inválido" });
    }

    await conn.beginTransaction();

    const [dupRfc] = await conn.query(
      `SELECT id FROM provider WHERE rfc = ? LIMIT 1`,
      [cleanRfc]
    );
    if (dupRfc.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: "RFC ya registrado" });
    }

    if (cleanEmail) {
      const [dupEmail] = await conn.query(
        `SELECT id FROM provider WHERE email = ? LIMIT 1`,
        [cleanEmail]
      );
      if (dupEmail.length > 0) {
        await conn.rollback();
        return res.status(409).json({ message: "Email ya registrado" });
      }
    }

    const [insert] = await conn.query(
      `
      INSERT INTO provider (name, razon_social, email, rfc, statuses_id, address)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [cleanName, cleanRazon, cleanEmail, cleanRfc, Number(statuses_id), cleanAddress]
    );

    const providerId = insert.insertId;

    if (Array.isArray(categories) && categories.length > 0) {
      const values = categories.map((catId) => [providerId, Number(catId)]);
      await conn.query(
        `INSERT INTO provider_has_category (provider_id, categories_id) VALUES ?`,
        [values]
      );
    }

    if (Array.isArray(phones) && phones.length > 0) {
      for (const phone of phones) {
        const value = String(phone || "").trim();
        if (!value) continue;
        const [phoneInsert] = await conn.query(
          `INSERT INTO phones (phone) VALUES (?)`,
          [value]
        );
        await conn.query(
          `INSERT INTO provider_has_phones (provider_id, phones_id) VALUES (?, ?)`,
          [providerId, phoneInsert.insertId]
        );
      }
    }

    await conn.commit();
    res.status(201).json({ message: "Proveedor creado", id: providerId });
  } catch (error) {
    await conn.rollback();
    console.error("Error createProvider:", error);
    res.status(500).json({ message: "Error interno" });
  } finally {
    conn.release();
  }
};

export const updateProvider = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const providerId = Number(id);
    if (!providerId) return res.status(400).json({ message: "id inválido" });

    const {
      name,
      razon_social = null,
      email = null,
      rfc,
      address = null,
      statuses_id,
      categories = [],
      phones = [],
    } = req.body || {};

    const cleanName = String(name || "").trim();
    const cleanRazon = razon_social ? String(razon_social).trim() : null;
    const cleanEmail = email ? String(email).trim() : null;
    const cleanAddress = address ? String(address).trim() : null;
    const cleanRfc = String(rfc || "").trim().toUpperCase();
    const rfcRegex = /^[A-ZÑ&]{3,4}\\d{6}[A-Z0-9]{3}$/;

    if (!cleanName) {
      return res.status(400).json({ message: "name es requerido" });
    }
    if (!cleanRfc) {
      return res.status(400).json({ message: "rfc es requerido" });
    }

    await conn.beginTransaction();

    const [[current]] = await conn.query(
      `SELECT rfc FROM provider WHERE id = ? LIMIT 1`,
      [providerId]
    );
    if (!current) {
      await conn.rollback();
      return res.status(404).json({ message: "Proveedor no encontrado" });
    }

    const currentRfc = String(current.rfc || "").trim().toUpperCase();
    const rfcChanged = currentRfc !== cleanRfc;
    if (rfcChanged && !rfcRegex.test(cleanRfc)) {
      await conn.rollback();
      return res.status(400).json({ message: "RFC inválido" });
    }

    const [dupRfc] = await conn.query(
      `SELECT id FROM provider WHERE rfc = ? AND id <> ? LIMIT 1`,
      [cleanRfc, providerId]
    );
    if (dupRfc.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: "RFC ya registrado" });
    }

    if (cleanEmail) {
      const [dupEmail] = await conn.query(
        `SELECT id FROM provider WHERE email = ? AND id <> ? LIMIT 1`,
        [cleanEmail, providerId]
      );
      if (dupEmail.length > 0) {
        await conn.rollback();
        return res.status(409).json({ message: "Email ya registrado" });
      }
    }

    await conn.query(
      `
      UPDATE provider
      SET name = ?, razon_social = ?, email = ?, rfc = ?, statuses_id = ?, address = ?
      WHERE id = ?
      `,
      [
        cleanName,
        cleanRazon,
        cleanEmail,
        cleanRfc,
        Number(statuses_id),
        cleanAddress,
        providerId,
      ]
    );

    await conn.query(`DELETE FROM provider_has_category WHERE provider_id = ?`, [providerId]);
    if (Array.isArray(categories) && categories.length > 0) {
      const values = categories.map((catId) => [providerId, Number(catId)]);
      await conn.query(
        `INSERT INTO provider_has_category (provider_id, categories_id) VALUES ?`,
        [values]
      );
    }

    await conn.query(`DELETE FROM provider_has_phones WHERE provider_id = ?`, [providerId]);
    if (Array.isArray(phones) && phones.length > 0) {
      for (const phone of phones) {
        const value = String(phone || "").trim();
        if (!value) continue;
        const [phoneInsert] = await conn.query(`INSERT INTO phones (phone) VALUES (?)`, [value]);
        await conn.query(
          `INSERT INTO provider_has_phones (provider_id, phones_id) VALUES (?, ?)`,
          [providerId, phoneInsert.insertId]
        );
      }
    }

    await conn.commit();
    res.json({ message: "Proveedor actualizado" });
  } catch (error) {
    await conn.rollback();
    console.error("Error updateProvider:", error);
    res.status(500).json({ message: "Error interno" });
  } finally {
    conn.release();
  }
};

export const updateProviderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const providerId = Number(id);
    if (!providerId) return res.status(400).json({ message: "id inválido" });

    const { statuses_id } = req.body || {};
    if (!Number(statuses_id)) {
      return res.status(400).json({ message: "statuses_id es requerido" });
    }

    await pool.query(`UPDATE provider SET statuses_id = ? WHERE id = ?`, [
      Number(statuses_id),
      providerId,
    ]);

    res.json({ message: "Estatus actualizado" });
  } catch (error) {
    console.error("Error updateProviderStatus:", error);
    res.status(500).json({ message: "Error interno" });
  }
};

/* =============================
   CERRAR RECEPCIÓN
   invited -> expired
   requisition -> 14 (En revisión)
   requisition.quotation_closed_at = NOW()
============================= */
export const closeCotizacionInvites = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const ok = await ensureAssignedOrAdmin(req, res, id);
    if (!ok) return;

    await conn.beginTransaction();

    const [reqRows] = await conn.query(
      `
      SELECT id, statuses_id, quotation_closed_at
      FROM requisition
      WHERE id = ? FOR UPDATE
      `,
      [id]
    );

    if (reqRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: "Requisición no encontrada" });
    }

    const reqRow = reqRows[0];

    if (reqRow.quotation_closed_at || Number(reqRow.statuses_id) === 14) {
      await conn.commit();
      return res.json({
        message: "La recepción ya estaba cerrada",
        affectedRows: 0,
        requisition_statuses_id: Number(reqRow.statuses_id),
      });
    }

    if (Number(reqRow.statuses_id) !== 12) {
      await conn.rollback();
      return res.status(400).json({
        message: "Solo se puede cerrar cuando está en 'En cotización' (12)",
        current_status: Number(reqRow.statuses_id),
      });
    }

    const [result] = await conn.query(
      `
      UPDATE quotation_requests
      SET status = 'expired'
      WHERE requisition_id = ?
        AND status = 'invited'
      `,
      [id]
    );

    const closedBy = null;

    await conn.query(
      `
      UPDATE requisition
      SET quotation_closed_at = NOW(),
          quotation_closed_by = ?,
          quotation_close_note = NULL
      WHERE id = ?
      `,
      [closedBy, id]
    );

    await conn.commit();

    res.json({
      message: "Recepción cerrada",
      affectedRows: result.affectedRows,
      requisition_statuses_id: Number(reqRow.statuses_id),
    });
  } catch (error) {
    await conn.rollback();
    console.error("Error cerrando invitación:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  } finally {
    conn.release();
  }
};

export const sendCotizacionToReview = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const ok = await ensureAssignedOrAdmin(req, res, id);
    if (!ok) return;

    await conn.beginTransaction();

    const [reqRows] = await conn.query(
      `
      SELECT id, statuses_id, quotation_closed_at
      FROM requisition
      WHERE id = ? FOR UPDATE
      `,
      [id]
    );

    if (reqRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: "Requisición no encontrada" });
    }

    const reqRow = reqRows[0];
    const st = Number(reqRow.statuses_id);

    if (st === 14) {
      await conn.commit();
      return res.json({ message: "Ya estaba en revisión", requisition_statuses_id: 14 });
    }

    if (!reqRow.quotation_closed_at) {
      await conn.rollback();
      return res.status(400).json({
        message: "Primero cierra la recepción antes de enviar a revisión",
      });
    }

    const [hasPricesRows] = await conn.query(
      `SELECT 1 FROM quotation_prices WHERE requisition_id = ? LIMIT 1`,
      [id]
    );
    if (hasPricesRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({
        message: "Primero guarda al menos una cotización antes de enviar a revisión",
      });
    }

    await conn.query(
      `
      UPDATE requisition
      SET statuses_id = 14
      WHERE id = ?
      `,
      [id]
    );

    await conn.commit();
    res.json({ message: "Enviado a revisión", requisition_statuses_id: 14 });
  } catch (error) {
    await conn.rollback();
    console.error("Error enviando a revisión:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  } finally {
    conn.release();
  }
};

export const reopenCotizacionReception = async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await ensureAssignedOrAdmin(req, res, id);
    if (!ok) return;

    const [reqRows] = await pool.query(
      `SELECT id, statuses_id, quotation_closed_at FROM requisition WHERE id = ?`,
      [id]
    );
    if (reqRows.length === 0) {
      return res.status(404).json({ message: "Requisición no encontrada" });
    }

    const st = Number(reqRows[0].statuses_id);
    if (st === 14) {
      return res.status(400).json({
        message: "No se puede reabrir cuando ya está en revisión",
      });
    }

    await pool.query(
      `
      UPDATE requisition
      SET quotation_closed_at = NULL,
          quotation_closed_by = NULL,
          quotation_close_note = NULL
      WHERE id = ?
      `,
      [id]
    );

    res.json({ message: "Recepción reabierta" });
  } catch (error) {
    console.error("Error reabriendo recepción:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
