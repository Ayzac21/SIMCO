import { pool } from "../db/connection.js";
import PDFDocument from "pdfkit";
import { PDFDocument as PDFLibDocument } from "pdf-lib";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  createNotification,
  createNotificationsForUsers,
  getCoordinatorUsersForRequisition,
  getUsersByRole,
} from "../services/notifications.js";
import {
  getRequisitionStatusTimeline,
  logRequisitionStatusChange,
} from "../services/statusHistory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesDir = path.resolve(__dirname, "..", "templates");
const requisitionUploadsDir = path.resolve(__dirname, "..", "uploads", "requisiciones");
const resolveStoredRequisitionImagePath = async (storedPath) => {
  if (!storedPath) return null;
  const raw = String(storedPath || "");
  const normalized = raw.replace(/\\/g, "/");
  const fileName = path.basename(normalized);
  const candidates = [];
  if (path.isAbsolute(raw)) {
    candidates.push(path.resolve(raw));
  }
  if (fileName) {
    candidates.push(path.resolve(requisitionUploadsDir, fileName));
  }

  for (const candidate of candidates) {
    if (!candidate.startsWith(requisitionUploadsDir)) continue;
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // continuar al siguiente candidato
    }
  }
  return null;
};
const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
const normalizeRfc = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "");
const normalizeProviderStatus = (value) => {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && [3, 4, 5, 6].includes(parsed)) return parsed;
  return 6;
};
const normalizeProviderCategories = (values) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v) && v > 0)
    )
  );
const normalizeProviderPhones = (values) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((v) => String(v || "").trim())
        .filter(Boolean)
    )
  );
const generateDraftRfc = async (conn) => {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const baseDate = `${yy}${mm}${dd}`;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";

  const pick = () =>
    Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

  for (let i = 0; i < 30; i += 1) {
    const candidate = `BORR${baseDate}${pick()}`;
    const [dup] = await conn.query(`SELECT id FROM provider WHERE rfc = ? LIMIT 1`, [candidate]);
    if (!dup.length) return candidate;
  }

  return `BORR${baseDate}${String(Date.now()).slice(-3)}`;
};
const mapProviderMutationError = (error) => {
  const code = String(error?.code || "");
  const detail = String(error?.sqlMessage || error?.message || "").toLowerCase();

  if (code === "ER_DUP_ENTRY") {
    if (detail.includes("rfc")) return { status: 409, message: "RFC ya registrado" };
    if (detail.includes("email")) return { status: 409, message: "Email ya registrado" };
    return { status: 409, message: "Registro duplicado" };
  }
  if (code === "ER_NO_REFERENCED_ROW_2") {
    if (detail.includes("category")) return { status: 400, message: "Categoría inválida" };
    if (detail.includes("status")) return { status: 400, message: "Estatus inválido" };
    return { status: 400, message: "Referencia inválida en los datos enviados" };
  }
  if (code === "ER_BAD_NULL_ERROR") {
    return { status: 400, message: "Faltan campos requeridos" };
  }
  if (code === "ER_TRUNCATED_WRONG_VALUE" || code === "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD") {
    return { status: 400, message: "Hay datos con formato inválido" };
  }
  return { status: 500, message: "Error interno" };
};

const normalizeHeader = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const normalizeTaxPercent = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
};

const parseSelectionTaxesFromNotes = (notes) => {
  if (!notes) return { vatPct: null, isrPct: null };
  try {
    const parsed = typeof notes === "string" ? JSON.parse(notes) : notes;
    return {
      vatPct: normalizeTaxPercent(parsed?.vat_percentage),
      isrPct: normalizeTaxPercent(parsed?.isr_percentage),
    };
  } catch {
    return { vatPct: null, isrPct: null };
  }
};

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

const getComprasAdminIds = async (connOrPool = pool) => {
    const [rows] = await connOrPool.query(
    `
    SELECT id
    FROM users
    WHERE role = 'compras_admin' AND COALESCE(statuses_id, 1) = 1
    `
  );
  return rows.map((r) => Number(r.id)).filter((id) => Number.isInteger(id) && id > 0);
};

let selectionTaxColumnsAvailableCache = null;
let ensureAttachmentsTablePromise = null;
let lineItemImageColumnsAvailableCache = null;
const hasLineItemImageColumns = async (connOrPool = pool) => {
  if (lineItemImageColumnsAvailableCache !== null) return lineItemImageColumnsAvailableCache;
  try {
    const [pathCols] = await connOrPool.query(
      `SHOW COLUMNS FROM line_items LIKE 'image_file_path'`
    );
    const [mimeCols] = await connOrPool.query(
      `SHOW COLUMNS FROM line_items LIKE 'image_mime_type'`
    );
    const [nameCols] = await connOrPool.query(
      `SHOW COLUMNS FROM line_items LIKE 'image_original_name'`
    );
    lineItemImageColumnsAvailableCache =
      pathCols.length > 0 && mimeCols.length > 0 && nameCols.length > 0;
  } catch {
    lineItemImageColumnsAvailableCache = false;
  }
  return lineItemImageColumnsAvailableCache;
};
const hasSelectionTaxColumns = async (connOrPool = pool) => {
  if (selectionTaxColumnsAvailableCache !== null) return selectionTaxColumnsAvailableCache;
  try {
    const [vatCols] = await connOrPool.query(
      `SHOW COLUMNS FROM quotation_selections LIKE 'selected_vat_percentage'`
    );
    const [isrCols] = await connOrPool.query(
      `SHOW COLUMNS FROM quotation_selections LIKE 'selected_isr_percentage'`
    );
    selectionTaxColumnsAvailableCache = vatCols.length > 0 && isrCols.length > 0;
  } catch {
    selectionTaxColumnsAvailableCache = false;
  }
  return selectionTaxColumnsAvailableCache;
};

const ensureAttachmentsTable = async () => {
  if (!ensureAttachmentsTablePromise) {
    ensureAttachmentsTablePromise = pool.query(`
      CREATE TABLE IF NOT EXISTS requisition_attachments (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        requisition_id INT NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        stored_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(120) NOT NULL,
        size_bytes INT NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        uploaded_by INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_req_att_req (requisition_id),
        CONSTRAINT fk_req_att_req FOREIGN KEY (requisition_id) REFERENCES requisition(id) ON DELETE CASCADE
      )
    `).catch((error) => {
      ensureAttachmentsTablePromise = null;
      throw error;
    });
  }
  await ensureAttachmentsTablePromise;
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
          OR sec.name LIKE ?
          OR c.name LIKE ?
          OR csec.name LIKE ?
          OR c2.name LIKE ?
        )
      `);
      const like = `%${q}%`;
      params.push(like, like, like, like, like, like, like, like, like);
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
      LEFT JOIN secretary sec
        ON sec.id = (
          SELECT s2.id
          FROM secretary s2
          WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(s2.ure)), '%')
          ORDER BY LENGTH(TRIM(s2.ure)) DESC
          LIMIT 1
        )
      LEFT JOIN coordination c ON ho.coordination_id = c.id
      LEFT JOIN coordination csec
        ON csec.id = (
          SELECT c4.id
          FROM coordination c4
          WHERE TRIM(UPPER(sec.ure)) LIKE CONCAT(TRIM(UPPER(c4.ure)), '%')
          ORDER BY LENGTH(TRIM(c4.ure)) DESC
          LIMIT 1
        )
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
        COALESCE(
          NULLIF(TRIM(ho.name), ''),
          NULLIF(TRIM(sec.name), ''),
          NULLIF(TRIM(c2.name), ''),
          u.ure
        ) as nombre_unidad,
        COALESCE(
          NULLIF(TRIM(c.name), ''),
          NULLIF(TRIM(csec.name), ''),
          NULLIF(TRIM(c2.name), ''),
          'General'
        ) as coordinacion
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
      LEFT JOIN secretary sec
        ON sec.id = (
          SELECT s2.id
          FROM secretary s2
          WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(s2.ure)), '%')
          ORDER BY LENGTH(TRIM(s2.ure)) DESC
          LIMIT 1
        )
      LEFT JOIN coordination c ON ho.coordination_id = c.id
      LEFT JOIN coordination csec
        ON csec.id = (
          SELECT c4.id
          FROM coordination c4
          WHERE TRIM(UPPER(sec.ure)) LIKE CONCAT(TRIM(UPPER(c4.ure)), '%')
          ORDER BY LENGTH(TRIM(c4.ure)) DESC
          LIMIT 1
        )
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
   PREPARACION COMPRAS (ADMIN)
   Vista previa solo de etapas previas a Compras:
   7 (URE), 8 (Coordinación), 9 (Secretaría)
============================= */
export const getComprasPreparation = async (req, res) => {
  try {
    if (req.user?.role !== "compras_admin") {
      return res.status(403).json({ message: "Solo admin puede acceder a esta vista" });
    }

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)));
    const offset = (page - 1) * limit;
    const q = String(req.query.q || "").trim();

    const status = String(req.query.status || "all");
    const visibleStatuses = [7, 8, 9];
    const whereParts = [`r.statuses_id IN (${visibleStatuses.join(",")})`];
    const params = [];

    if (status !== "all") {
      const statusId = Number(status);
      if (!Number.isInteger(statusId) || !visibleStatuses.includes(statusId)) {
        return res.status(400).json({ message: "Filtro de estatus inválido" });
      }
      whereParts.push("r.statuses_id = ?");
      params.push(statusId);
    }

    if (q) {
      whereParts.push(`
        (
          CAST(r.id AS CHAR) LIKE ?
          OR r.request_name LIKE ?
          OR u.name LIKE ?
          OR u.ure LIKE ?
          OR ho.name LIKE ?
          OR sec.name LIKE ?
          OR c.name LIKE ?
          OR csec.name LIKE ?
          OR c2.name LIKE ?
        )
      `);
      const like = `%${q}%`;
      params.push(like, like, like, like, like, like, like, like, like);
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
      LEFT JOIN secretary sec
        ON sec.id = (
          SELECT s2.id
          FROM secretary s2
          WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(s2.ure)), '%')
          ORDER BY LENGTH(TRIM(s2.ure)) DESC
          LIMIT 1
        )
      LEFT JOIN coordination c ON ho.coordination_id = c.id
      LEFT JOIN coordination csec
        ON csec.id = (
          SELECT c4.id
          FROM coordination c4
          WHERE TRIM(UPPER(sec.ure)) LIKE CONCAT(TRIM(UPPER(c4.ure)), '%')
          ORDER BY LENGTH(TRIM(c4.ure)) DESC
          LIMIT 1
        )
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

    const [countsRows] = await pool.query(
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN r.statuses_id = 7 THEN 1 ELSE 0 END) AS s7,
        SUM(CASE WHEN r.statuses_id = 8 THEN 1 ELSE 0 END) AS s8,
        SUM(CASE WHEN r.statuses_id = 9 THEN 1 ELSE 0 END) AS s9,
        SUM(CASE WHEN r.statuses_id = 10 THEN 1 ELSE 0 END) AS s10,
        SUM(CASE WHEN r.statuses_id = 11 THEN 1 ELSE 0 END) AS s11,
        SUM(CASE WHEN r.statuses_id = 12 THEN 1 ELSE 0 END) AS s12,
        SUM(CASE WHEN r.statuses_id = 13 THEN 1 ELSE 0 END) AS s13,
        SUM(CASE WHEN r.statuses_id = 14 THEN 1 ELSE 0 END) AS s14
      FROM requisition r
      WHERE r.statuses_id IN (${visibleStatuses.join(",")})
      `
    );
    const counts = countsRows?.[0] || {};

    const query = `
      SELECT
        r.id,
        r.request_name,
        r.created_at,
        r.statuses_id,
        r.notes,
        r.justification,
        r.observation,
        s.name AS nombre_estatus,
        u.name AS solicitante,
        u.role AS created_by_role,
        u.ure AS ure_solicitante,
        COALESCE(
          NULLIF(TRIM(ho.name), ''),
          NULLIF(TRIM(sec.name), ''),
          NULLIF(TRIM(c2.name), ''),
          u.ure
        ) AS nombre_unidad,
        COALESCE(
          NULLIF(TRIM(c.name), ''),
          NULLIF(TRIM(csec.name), ''),
          NULLIF(TRIM(c2.name), ''),
          'General'
        ) AS coordinacion
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
      LEFT JOIN secretary sec
        ON sec.id = (
          SELECT s2.id
          FROM secretary s2
          WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(s2.ure)), '%')
          ORDER BY LENGTH(TRIM(s2.ure)) DESC
          LIMIT 1
        )
      LEFT JOIN coordination c ON ho.coordination_id = c.id
      LEFT JOIN coordination csec
        ON csec.id = (
          SELECT c4.id
          FROM coordination c4
          WHERE TRIM(UPPER(sec.ure)) LIKE CONCAT(TRIM(UPPER(c4.ure)), '%')
          ORDER BY LENGTH(TRIM(c4.ure)) DESC
          LIMIT 1
        )
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
    const [rows] = await pool.query(query, [...params, limit, offset]);

    return res.json({
      rows,
      total,
      page,
      limit,
      counts: {
        total: Number(counts.total || 0),
        s7: Number(counts.s7 || 0),
        s8: Number(counts.s8 || 0),
        s9: Number(counts.s9 || 0),
        s10: Number(counts.s10 || 0),
        s11: Number(counts.s11 || 0),
        s12: Number(counts.s12 || 0),
        s13: Number(counts.s13 || 0),
        s14: Number(counts.s14 || 0),
      },
    });
  } catch (error) {
    console.error("Error en vista de preparación compras:", error);
    return res.status(500).json({ message: "Error en el servidor" });
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
    const requisitionId = Number(id);
    if (!Number.isInteger(requisitionId) || requisitionId <= 0) {
      return res.status(400).json({ message: "ID de requisición inválido" });
    }

    const { assigned_operator_id } = req.body || {};

    if (typeof assigned_operator_id === "undefined") {
      return res.status(400).json({ message: "Falta assigned_operator_id" });
    }

    const nextAssignedId =
      assigned_operator_id === null || assigned_operator_id === ""
        ? null
        : Number(assigned_operator_id);

    if (nextAssignedId !== null && (!Number.isInteger(nextAssignedId) || nextAssignedId <= 0)) {
      return res.status(400).json({ message: "assigned_operator_id inválido" });
    }

    if (nextAssignedId !== null) {
      const [opRows] = await pool.query(
        `SELECT 1 FROM users WHERE id = ? AND role = 'compras_operador' AND statuses_id = 1 LIMIT 1`,
        [nextAssignedId]
      );
      if (opRows.length === 0) {
        return res.status(400).json({ message: "Operador inválido" });
      }
    }

    const [reqRows] = await pool.query(
      `SELECT id, request_name, assigned_operator_id FROM requisition WHERE id = ? LIMIT 1`,
      [requisitionId]
    );
    if (!reqRows.length) {
      return res.status(404).json({ message: "Requisición no encontrada" });
    }

    const currentAssignedId = Number(reqRows[0].assigned_operator_id || 0) || null;

    const [result] = await pool.query(
      `
      UPDATE requisition
      SET assigned_operator_id = ?
      WHERE id = ?
      `,
      [nextAssignedId, requisitionId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Requisición no encontrada" });
    }

    const actorId = Number(req.user?.id || 0) || null;
    const requestName = String(reqRows[0].request_name || "").trim();
    const reqLabel = requestName ? `#${requisitionId} - ${requestName}` : `#${requisitionId}`;

    if (nextAssignedId && nextAssignedId !== currentAssignedId) {
      await createNotification({
        recipientUserId: nextAssignedId,
        actorUserId: actorId,
        title: "Nueva requisición asignada",
        message: `Se te asignó la requisición ${reqLabel}.`,
        entityType: "requisition",
        entityId: requisitionId,
        actionPath: "/compras/dashboard",
      });
    }

    if (currentAssignedId && currentAssignedId !== nextAssignedId) {
      await createNotification({
        recipientUserId: currentAssignedId,
        actorUserId: actorId,
        title: "Requisición reasignada",
        message: `La requisición ${reqLabel} fue reasignada a otro operador.`,
        entityType: "requisition",
        entityId: requisitionId,
        actionPath: "/compras/dashboard",
      });
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
    const targetStatusId = Number(status_id);

    if (!targetStatusId) {
      return res.status(400).json({ message: "Falta status_id" });
    }

    const allowedTargets = new Set([7, 10, 11]);
    if (!allowedTargets.has(targetStatusId)) {
      return res.status(400).json({
        message: "status_id no permitido para Compras",
        allowed_statuses: [7, 10, 11],
      });
    }

    if ((targetStatusId === 10 || targetStatusId === 7 || targetStatusId === 11) && req.user?.role !== "compras_admin") {
      return res.status(403).json({ message: "Solo admin puede ejecutar esta acción" });
    }

    if ((targetStatusId === 10 || targetStatusId === 7) && !String(comentarios || "").trim()) {
      return res.status(400).json({ message: "Debes incluir comentarios para esta acción" });
    }

    const ok = await ensureAssignedOrAdmin(req, res, id);
    if (!ok) return;

    const [[currentRow]] = await pool.query(
      `SELECT statuses_id, users_id FROM requisition WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!currentRow) {
      return res.status(404).json({ message: "Requisición no encontrada" });
    }
    const currentStatusId = Number(currentRow.statuses_id || 0);

    if (currentStatusId === targetStatusId) {
      return res.json({ message: "La requisición ya tiene ese estatus" });
    }

    // Reglas de transición para evitar saltos de proceso por error o llamadas externas
    if (targetStatusId === 11 && currentStatusId !== 13) {
      return res.status(400).json({
        message: "Solo se puede marcar como finalizada cuando está en proceso de compra (13)",
        current_status: currentStatusId,
      });
    }

    if ((targetStatusId === 7 || targetStatusId === 10) && ![12, 13, 14].includes(currentStatusId)) {
      return res.status(400).json({
        message: "Solo se puede ajustar/rechazar requisiciones activas en flujo de Compras (12, 13, 14)",
        current_status: currentStatusId,
      });
    }

    if (targetStatusId === 11) {
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
          message: "No hay proveedores seleccionados para marcar como finalizada",
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
      [targetStatusId, comentarios || null, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Requisición no encontrada" });
    }

    await logRequisitionStatusChange({
      requisitionId: id,
      fromStatusId: currentStatusId,
      toStatusId: targetStatusId,
      changedBy: Number(req.user?.id || 0) || null,
      note: comentarios || null,
    });

    const ownerId = Number(currentRow.users_id || 0);
    const actorId = Number(req.user?.id || 0) || null;
    if (ownerId > 0 && targetStatusId === 7) {
      await createNotification({
        recipientUserId: ownerId,
        actorUserId: actorId,
        title: "Compras solicitó corrección",
        message: `La requisición #${id} regresó a borrador para ajustes. Revisa comentarios y reenvía.`,
        entityType: "requisition",
        entityId: Number(id),
        actionPath: `/unidad/mi-requisiciones?openReq=${id}`,
      });
    } else if (ownerId > 0 && targetStatusId === 11) {
      await createNotification({
        recipientUserId: ownerId,
        actorUserId: actorId,
        title: "Requisición finalizada",
        message: `La requisición #${id} fue marcada como finalizada por Compras.`,
        entityType: "requisition",
        entityId: Number(id),
        actionPath: `/unidad/mi-requisiciones?openReq=${id}`,
      });
    } else if (ownerId > 0 && targetStatusId === 10) {
      await createNotification({
        recipientUserId: ownerId,
        actorUserId: actorId,
        title: "Requisición rechazada en Compras",
        message: `La requisición #${id} fue rechazada por Compras. Revisa el motivo en el detalle.`,
        entityType: "requisition",
        entityId: Number(id),
        actionPath: `/unidad/mi-requisiciones?openReq=${id}`,
      });
    }

    if (targetStatusId === 11 || targetStatusId === 10) {
      const coordinatorIds = await getCoordinatorUsersForRequisition(id);
      await createNotificationsForUsers(coordinatorIds, {
        actorUserId: actorId,
        title: targetStatusId === 11 ? "Requisición finalizada en Compras" : "Requisición rechazada en Compras",
        message:
          targetStatusId === 11
            ? `La requisición #${id} fue finalizada por Compras.`
            : `La requisición #${id} fue rechazada por Compras.`,
        entityType: "requisition",
        entityId: Number(id),
        actionPath: `/coordinador/requisiciones?openReq=${id}`,
      });

      const secretariaIds = await getUsersByRole("secretaria");
      await createNotificationsForUsers(secretariaIds, {
        actorUserId: actorId,
        title: targetStatusId === 11 ? "Compra finalizada" : "Compra rechazada",
        message:
          targetStatusId === 11
            ? `La requisición #${id} fue finalizada por Compras.`
            : `La requisición #${id} fue rechazada por Compras.`,
        entityType: "requisition",
        entityId: Number(id),
        actionPath: `/secretaria/recibidas?openReq=${id}`,
      });
    } else if (targetStatusId === 7) {
      const coordinatorIds = await getCoordinatorUsersForRequisition(id);
      await createNotificationsForUsers(coordinatorIds, {
        actorUserId: actorId,
        title: "Compras solicitó corrección",
        message: `La requisición #${id} regresó a borrador para ajustes solicitados por Compras.`,
        entityType: "requisition",
        entityId: Number(id),
        actionPath: `/coordinador/requisiciones?openReq=${id}`,
      });

      const secretariaIds = await getUsersByRole("secretaria");
      await createNotificationsForUsers(secretariaIds, {
        actorUserId: actorId,
        title: "Ajuste solicitado por Compras",
        message: `La requisición #${id} fue devuelta a borrador por Compras.`,
        entityType: "requisition",
        entityId: Number(id),
        actionPath: `/secretaria/recibidas?openReq=${id}`,
      });
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
      status === "11" ? "Finalizadas" : status === "10" ? "Rechazadas" : "Todas";
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

    drawBox(40, summaryY, "FINALIZADAS", compradas);
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
   ADJUNTOS DE REQUISICIÓN (COMPRAS)
============================= */
export const getComprasRequisitionAttachments = async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await ensureAssignedOrAdmin(req, res, id);
    if (!ok) return;
    await ensureAttachmentsTable();

    const [rows] = await pool.query(
      `
      SELECT id, original_name, mime_type, size_bytes, created_at
      FROM requisition_attachments
      WHERE requisition_id = ?
      ORDER BY created_at DESC, id DESC
      `,
      [id]
    );
    return res.json(rows);
  } catch (error) {
    console.error("Error obteniendo adjuntos:", error);
    return res.status(500).json({ message: "Error obteniendo adjuntos" });
  }
};

export const downloadComprasRequisitionAttachment = async (req, res) => {
  try {
    const { id, attachmentId } = req.params;
    const ok = await ensureAssignedOrAdmin(req, res, id);
    if (!ok) return;
    await ensureAttachmentsTable();

    const [[row]] = await pool.query(
      `
      SELECT id, original_name, mime_type, file_path
      FROM requisition_attachments
      WHERE id = ? AND requisition_id = ?
      LIMIT 1
      `,
      [attachmentId, id]
    );

    if (!row) {
      return res.status(404).json({ message: "Adjunto no encontrado" });
    }

    const absPath = path.resolve(String(row.file_path || ""));
    if (!absPath.startsWith(requisitionUploadsDir)) {
      return res.status(404).json({ message: "Archivo no disponible" });
    }

    await fs.access(absPath);
    res.setHeader("Content-Type", row.mime_type || "application/octet-stream");
    return res.download(absPath, row.original_name || "adjunto");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return res.status(404).json({ message: "Archivo no disponible" });
    }
    console.error("Error descargando adjunto:", error);
    return res.status(500).json({ message: "Error descargando adjunto" });
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
        li.product_name,
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

export const getComprasRequisitionItemImage = async (req, res) => {
  try {
    const { id, lineItemId } = req.params;
    const ok = await ensureAssignedOrAdmin(req, res, id);
    if (!ok) return;

    const [[row]] = await pool.query(
      `
      SELECT image_file_path, image_mime_type, image_original_name
      FROM line_items
      WHERE id = ? AND requisition_id = ?
      LIMIT 1
      `,
      [lineItemId, id]
    );

    if (!row || !row.image_file_path) {
      return res.status(404).json({ message: "Imagen no encontrada" });
    }

    const absPath = await resolveStoredRequisitionImagePath(row.image_file_path);
    if (!absPath) {
      return res.status(404).json({ message: "Archivo no disponible" });
    }
    const mime = row.image_mime_type || "application/octet-stream";
    const fileName = encodeURIComponent(row.image_original_name || "imagen");
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${fileName}`);
    return res.sendFile(absPath);
  } catch (error) {
    if (error?.code === "ER_BAD_FIELD_ERROR") {
      return res.status(404).json({ message: "Imagen no disponible" });
    }
    if (error?.code === "ENOENT") {
      return res.status(404).json({ message: "Archivo no disponible" });
    }
    console.error("Error obteniendo imagen por partida (compras):", error);
    return res.status(500).json({ message: "Error interno" });
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
    const withSelectionTaxCols = await hasSelectionTaxColumns();

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
        qs.selected_description,
        COALESCE(
          ${withSelectionTaxCols ? "qs.selected_vat_percentage" : "NULL"},
          CAST(
            JSON_UNQUOTE(
              JSON_EXTRACT(
                IF(JSON_VALID(qp.notes), qp.notes, NULL),
                '$.vat_percentage'
              )
            ) AS DECIMAL(6,2)
          ),
          0
        ) AS selected_vat_percentage,
        COALESCE(
          ${withSelectionTaxCols ? "qs.selected_isr_percentage" : "NULL"},
          CAST(
            JSON_UNQUOTE(
              JSON_EXTRACT(
                IF(JSON_VALID(qp.notes), qp.notes, NULL),
                '$.isr_percentage'
              )
            ) AS DECIMAL(6,2)
          ),
          0
        ) AS selected_isr_percentage
      FROM line_items li
      LEFT JOIN units u ON li.units_id = u.id
      LEFT JOIN quotation_selections qs
        ON qs.requisition_id = li.requisition_id
        AND qs.line_item_id = li.id
      LEFT JOIN quotation_prices qp
        ON qp.requisition_id = li.requisition_id
        AND qp.line_item_id = li.id
        AND qp.provider_id = qs.provider_id
      LEFT JOIN provider p ON p.id = qs.provider_id
      WHERE li.requisition_id = ?
      ORDER BY li.id ASC
    `;

    const [items] = await pool.query(queryItems, [id]);
    const providerIds = Array.from(
      new Set(items.map((it) => Number(it.provider_id || 0)).filter((pid) => pid > 0))
    );

    let providers = [];
    if (providerIds.length > 0) {
      const [providerRows] = await pool.query(
        `
        SELECT
          p.id,
          p.name,
          p.razon_social,
          p.rfc,
          p.email,
          p.address,
          GROUP_CONCAT(ph.phone SEPARATOR ', ') AS phones
        FROM provider p
        LEFT JOIN provider_has_phones php ON php.provider_id = p.id
        LEFT JOIN phones ph ON ph.id = php.phones_id
        WHERE p.id IN (${providerIds.map(() => "?").join(",")})
        GROUP BY p.id, p.name, p.razon_social, p.rfc, p.email, p.address
        ORDER BY p.name ASC
        `,
        providerIds
      );
      providers = Array.isArray(providerRows) ? providerRows : [];
    }

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
      providers,
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
    const withSelectionTaxCols = await hasSelectionTaxColumns();

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
        message: "Solo disponible en proceso de compra (13) o finalizada (11)",
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
        qs.selected_description,
        COALESCE(
          ${withSelectionTaxCols ? "qs.selected_vat_percentage" : "NULL"},
          CAST(
            JSON_UNQUOTE(
              JSON_EXTRACT(
                IF(JSON_VALID(qp.notes), qp.notes, NULL),
                '$.vat_percentage'
              )
            ) AS DECIMAL(6,2)
          ),
          0
        ) AS selected_vat_percentage,
        COALESCE(
          ${withSelectionTaxCols ? "qs.selected_isr_percentage" : "NULL"},
          CAST(
            JSON_UNQUOTE(
              JSON_EXTRACT(
                IF(JSON_VALID(qp.notes), qp.notes, NULL),
                '$.isr_percentage'
              )
            ) AS DECIMAL(6,2)
          ),
          0
        ) AS selected_isr_percentage
      FROM line_items li
      LEFT JOIN units u ON li.units_id = u.id
      LEFT JOIN quotation_selections qs
        ON qs.requisition_id = li.requisition_id
        AND qs.line_item_id = li.id
      LEFT JOIN quotation_prices qp
        ON qp.requisition_id = li.requisition_id
        AND qp.line_item_id = li.id
        AND qp.provider_id = qs.provider_id
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

    const moneyFormatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const formatMoney = (n) => {
      const num = Number(n);
      if (!Number.isFinite(num)) return "";
      return moneyFormatter.format(num);
    };
    const formatQty = (n) => {
      const num = Number(n);
      if (!Number.isFinite(num)) return "";
      if (Number.isInteger(num)) return String(num);
      return num.toLocaleString("es-MX", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
      });
    };

    const setText = (form, name, value) => {
      try {
        const field = form.getTextField(name);
        field.setText(value == null ? "" : String(value));
      } catch {}
    };

    const setTextAny = (form, names, value) => {
      for (const name of names) {
        try {
          const field = form.getTextField(name);
          field.setText(value == null ? "" : String(value));
          return true;
        } catch {}
      }
      return false;
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

    const srcDoc = await PDFLibDocument.load(templateBytes);
    const form = srcDoc.getForm();

    Object.entries(common).forEach(([k, v]) => setText(form, k, v));
    setCheck(form, "PAGO DE CONTADO", true);
    setCheck(form, "PAGO EN PARCIALIDADES", false);
    setCheck(form, "a) ANTICIPO", false);
    setCheck(form, "b CUMPLIMIENTO", false);

    const itemValues = itemsByProvider.map((it) => {
      const qty = Number(it.quantity || 0);
      const unit = Number(it.selected_unit_price || 0);
      const base = qty * unit;
      const vatPct = normalizeTaxPercent(it.selected_vat_percentage) ?? 0;
      const isrPct = normalizeTaxPercent(it.selected_isr_percentage) ?? 0;
      const vatAmount = (base * vatPct) / 100;
      const isrAmount = (base * isrPct) / 100;
      const total = base + vatAmount - isrAmount;
      return {
        qty,
        unit,
        base,
        total,
        vatPct,
        isrPct,
        vatAmount,
        isrAmount,
        desc: it.selected_description || it.description || "",
        unidad: it.unidad_medida || "",
      };
    });

    const subtotalBase = itemValues.reduce((acc, it) => acc + it.base, 0);
    const ivaFromItems = itemValues.reduce((acc, it) => acc + it.vatAmount, 0);
    const isrFromItems = itemValues.reduce((acc, it) => acc + it.isrAmount, 0);
    const hasPerItemTaxes = itemValues.some((it) => it.vatPct > 0 || it.isrPct > 0);
    const includeIva = Number(incluirIvaMeta) === 1;
    const ivaPct = Number(ivaPctMeta || 0);
    const ivaFallback = includeIva ? (subtotalBase * ivaPct) / 100 : 0;
    const iva = hasPerItemTaxes ? ivaFromItems : ivaFallback;
    const totalConIva = hasPerItemTaxes
      ? subtotalBase + ivaFromItems - isrFromItems
      : subtotalBase + ivaFallback;

    const single = itemValues.length === 1 ? itemValues[0] : null;
    const multilineGap = "\n\n";
    const mergedDescription = itemValues.map((it, idx) => `${idx + 1}. ${it.desc}`).join(multilineGap);
    const mergedQty = itemValues.map((it) => formatQty(it.qty) || "-").join(multilineGap);
    const mergedUnits = itemValues.map((it) => it.unidad || "-").join(multilineGap);
    const mergedUnitPrices = itemValues.map((it) => (it.unit ? formatMoney(it.unit) : "-")).join(multilineGap);
    const isrNote = isrFromItems > 0 ? `\nRetención ISR: ${formatMoney(isrFromItems)}` : "";
    const obsBase = requisition.observation || requisition.notes || "";

    setText(form, "CANTIDADRow1", single ? (single.qty ? formatQty(single.qty) : "") : mergedQty);
    setTextAny(form, ["DESCRIPCIÓN DE LOS SERVICIOSRow1", "DESCRIPCIÓN DE LOS BIENESRow1"], single ? single.desc : mergedDescription);
    setTextAny(form, ["UNIDAD DE MEDIDARow1"], single ? single.unidad : mergedUnits);
    setText(form, "PRECIO UNITARIORow1", single ? (single.unit ? formatMoney(single.unit) : "") : mergedUnitPrices);
    setText(form, "IMPORTE TOTALRow1", subtotalBase ? formatMoney(subtotalBase) : "");
    setText(form, "IMPORTE TOTALSUBTOTAL IVA TOTAL", subtotalBase ? formatMoney(subtotalBase) : "");
    setText(form, "IMPORTE TOTALSUBTOTAL IVA TOTAL_2", iva ? formatMoney(iva) : "0.00");
    setText(form, "IMPORTE TOTALSUBTOTAL IVA TOTAL_3", totalConIva ? formatMoney(totalConIva) : "");
    setText(form, "IMPORTE CON LETRA", "");
    setText(form, "OBSERVACIONES", `${obsBase}${isrNote}`.trim());

    form.flatten();

    const pageIndices = srcDoc.getPageIndices();
    const copied = await outputDoc.copyPages(srcDoc, pageIndices);
    copied.forEach((p) => outputDoc.addPage(p));

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

    const [selections] = await pool.query(
      `
      SELECT line_item_id, provider_id
      FROM quotation_selections
      WHERE requisition_id = ?
      `,
      [id]
    );

    res.json({ requisition, items, providers, invitedProviders, savedPrices, selections });
  } catch (error) {
    console.error("Error cargando datos de cotización:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const downloadCotizacionExcel = async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await ensureAssignedOrAdmin(req, res, id);
    if (!ok) return;

    let ExcelJS;
    try {
      const excelModule = await import("exceljs");
      ExcelJS = excelModule.default || excelModule;
    } catch {
      return res.status(500).json({
        message: "Falta dependencia para exportar Excel. Ejecuta npm install en backend.",
      });
    }

    const [reqRows] = await pool.query(
      `
      SELECT
        r.id,
        r.request_name,
        r.created_at,
        c.name AS category_name
      FROM requisition r
      LEFT JOIN categories c ON c.id = r.categories_id
      WHERE r.id = ?
      LIMIT 1
      `,
      [id]
    );
    if (!reqRows.length) {
      return res.status(404).json({ message: "Requisición no encontrada" });
    }
    const requisition = reqRows[0];

    const [items] = await pool.query(
      `
      SELECT
        li.id,
        li.quantity,
        li.description,
        u.name AS unidad_medida
      FROM line_items li
      LEFT JOIN units u ON u.id = li.units_id
      WHERE li.requisition_id = ?
      ORDER BY li.id ASC
      `,
      [id]
    );

    const [invitedProviders] = await pool.query(
      `
      SELECT
        p.id,
        p.name,
        qr.status
      FROM quotation_requests qr
      INNER JOIN provider p ON p.id = qr.provider_id
      WHERE qr.requisition_id = ?
      ORDER BY p.name ASC
      `,
      [id]
    );

    const [savedPrices] = await pool.query(
      `
      SELECT
        line_item_id,
        provider_id,
        unit_price,
        notes
      FROM quotation_prices
      WHERE requisition_id = ?
      `,
      [id]
    );
    const [selections] = await pool.query(
      `
      SELECT line_item_id, provider_id
      FROM quotation_selections
      WHERE requisition_id = ?
      `,
      [id]
    );

    const numericPrice = (value) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    };
    const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
    const excelColLetter = (colNumber) => {
      let n = Number(colNumber || 0);
      let result = "";
      while (n > 0) {
        const rem = (n - 1) % 26;
        result = String.fromCharCode(65 + rem) + result;
        n = Math.floor((n - 1) / 26);
      }
      return result || "A";
    };

    const priceMap = new Map();
    savedPrices.forEach((p) => {
      const key = `${Number(p.line_item_id)}_${Number(p.provider_id)}`;
      const { vatPct, isrPct } = parseSelectionTaxesFromNotes(p.notes);
      priceMap.set(key, {
        unitPrice: numericPrice(p.unit_price),
        vatPct: Number.isFinite(Number(vatPct)) ? Number(vatPct) : 0,
        isrPct: Number.isFinite(Number(isrPct)) ? Number(isrPct) : 0,
      });
    });

    const providers = invitedProviders.filter((provider) =>
      items.some((item) => {
        const key = `${Number(item.id)}_${Number(provider.id)}`;
        const row = priceMap.get(key);
        return row && row.unitPrice > 0;
      })
    );

    if (!providers.length) {
      return res.status(400).json({ message: "No hay proveedores con cotización capturada" });
    }

    const safeDate = (d) => {
      if (!d) return "";
      const date = new Date(d);
      if (Number.isNaN(date.getTime())) return "";
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = String(date.getFullYear()).slice(-2);
      return `${day}/${month}/${year}`;
    };
    const wrapText = (text, maxLen = 44) => {
      const raw = String(text || "").trim();
      if (!raw) return "";
      const words = raw.split(/\s+/);
      const lines = [];
      let current = "";
      words.forEach((word) => {
        const next = current ? `${current} ${word}` : word;
        if (next.length > maxLen) {
          if (current) lines.push(current);
          current = word;
        } else {
          current = next;
        }
      });
      if (current) lines.push(current);
      return lines.join("\n");
    };

    const totalsByProvider = {};
    const assignedTotalsByProvider = {};
    const assignedCountByProvider = {};
    providers.forEach((p) => {
      totalsByProvider[p.id] = { subtotal: 0, iva: 0, isr: 0, total: 0 };
      assignedTotalsByProvider[p.id] = { subtotal: 0, iva: 0, isr: 0, total: 0 };
      assignedCountByProvider[p.id] = 0;
    });

    const selectedProviderByItem = {};
    selections.forEach((s) => {
      const itemId = Number(s.line_item_id || 0);
      const providerId = Number(s.provider_id || 0);
      if (itemId && providerId) selectedProviderByItem[itemId] = providerId;
    });

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("CuadroComparativo");
    ws.properties.defaultRowHeight = 20;
    ws.pageSetup = {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2,
      },
    };
    ws.pageSetup.printTitlesRow = "8:9";
    ws.headerFooter.oddFooter = "&C&P / &N";
    const now = new Date();
    const series = `${id}-${now.getFullYear()}`;

    ws.getCell("D1").value = "UNIVERSIDAD DE GUADALAJARA";
    ws.getCell("D2").value = "CENTRO UNIVERSITARIO DE LOS ALTOS";
    ws.getCell("H4").value = "CUADRO COMPARATIVO";
    ws.getCell("I4").value = series;
    ws.getCell("E6").value = "FECHA CUADRO:";
    ws.getCell("F6").value = safeDate(now);
    ws.getCell("H6").value = "DEPENDENCIA:";
    ws.getCell("I6").value = requisition.request_name || requisition.category_name || "";

    ws.getRow(8).values = ["Partida", "Cantidad", "Unidad", "DESCRIPCION DEL BIEN O SERVICIO"];
    providers.forEach((p, idx) => {
      const unitCol = 5 + idx * 2;
      const totalCol = unitCol + 1;
      ws.getCell(8, unitCol).value = String(p.name || "Proveedor").toUpperCase();
      ws.getCell(9, unitCol).value = "PRECIO UNITARIO";
      ws.getCell(9, totalCol).value = "TOTAL (SIN IVA)";
    });

    const currencyFmt = '"$"#,##0.00';
    const tableHeaderFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };
    const tableHeaderFont = { bold: true, size: 10, color: { argb: "FF1F2937" } };
    const zebraFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF8FAFC" },
    };
    const summaryFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    const selectedFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDCFCE7" },
    };
    const selectedFont = { bold: true, color: { argb: "FF166534" } };
    const borderThin = {
      top: { style: "thin", color: { argb: "FFBDBDBD" } },
      left: { style: "thin", color: { argb: "FFBDBDBD" } },
      bottom: { style: "thin", color: { argb: "FFBDBDBD" } },
      right: { style: "thin", color: { argb: "FFBDBDBD" } },
    };

    let rowIndex = 10;
    items.forEach((item, idx) => {
      ws.getCell(rowIndex, 1).value = idx + 1;
      ws.getCell(rowIndex, 2).value = Number(item.quantity || 0);
      ws.getCell(rowIndex, 3).value = item.unidad_medida || "";
      const wrappedDescription = wrapText(item.description || "");
      ws.getCell(rowIndex, 4).value = wrappedDescription;
      const descLines = Math.max(1, wrappedDescription.split("\n").length);
      ws.getRow(rowIndex).height = Math.min(90, Math.max(18, descLines * 14));
      ws.getCell(rowIndex, 4).alignment = { vertical: "top", wrapText: true };

      providers.forEach((p, pIdx) => {
        const key = `${Number(item.id)}_${Number(p.id)}`;
        const data = priceMap.get(key);
        const unitPrice = data?.unitPrice || 0;
        const quantity = Number(item.quantity || 0);
        const subtotal = round2(unitPrice * quantity);
        const ivaAmount = round2(subtotal * ((data?.vatPct || 0) / 100));
        const isrAmount = round2(subtotal * ((data?.isrPct || 0) / 100));
        const total = round2(subtotal + ivaAmount - isrAmount);

        totalsByProvider[p.id].subtotal += subtotal;
        totalsByProvider[p.id].iva += ivaAmount;
        totalsByProvider[p.id].isr += isrAmount;
        totalsByProvider[p.id].total += total;

        const unitCol = 5 + pIdx * 2;
        const totalCol = unitCol + 1;
        if (unitPrice > 0) {
          ws.getCell(rowIndex, unitCol).value = unitPrice;
          // En la columna del comparativo mostramos total por partida sin impuestos.
          ws.getCell(rowIndex, totalCol).value = subtotal;
          ws.getCell(rowIndex, unitCol).numFmt = currencyFmt;
          ws.getCell(rowIndex, totalCol).numFmt = currencyFmt;
        } else {
          ws.getCell(rowIndex, unitCol).value = "";
          ws.getCell(rowIndex, totalCol).value = "";
        }

        const selectedProviderId = Number(selectedProviderByItem[item.id] || 0);
        if (selectedProviderId && selectedProviderId === Number(p.id)) {
          ws.getCell(rowIndex, unitCol).fill = selectedFill;
          ws.getCell(rowIndex, totalCol).fill = selectedFill;
          ws.getCell(rowIndex, unitCol).font = selectedFont;
          ws.getCell(rowIndex, totalCol).font = selectedFont;
          ws.getCell(rowIndex, totalCol).note = "SELECCIONADO";
          assignedTotalsByProvider[p.id].subtotal += subtotal;
          assignedTotalsByProvider[p.id].iva += ivaAmount;
          assignedTotalsByProvider[p.id].isr += isrAmount;
          assignedTotalsByProvider[p.id].total += total;
          assignedCountByProvider[p.id] += 1;
        }
      });
      rowIndex += 1;
    });

    const summaryStart = rowIndex + 1;
    const writeSummary = (label, key, row) => {
      ws.getCell(row, 4).value = label;
      ws.getCell(row, 4).font = { bold: true };
      providers.forEach((p, pIdx) => {
        const totalCol = 6 + pIdx * 2;
        ws.getCell(row, totalCol).value = round2(totalsByProvider[p.id][key] || 0);
        ws.getCell(row, totalCol).numFmt = currencyFmt;
        ws.getCell(row, totalCol).font = { bold: true };
      });
    };
    writeSummary("Sub Total", "subtotal", summaryStart);
    writeSummary("I.V.A", "iva", summaryStart + 1);
    writeSummary("TOTAL", "total", summaryStart + 2);

    const assignedTitleRow = summaryStart + 4;
    ws.getCell(assignedTitleRow, 4).value = "Totales seleccionados para pedido";
    ws.getCell(assignedTitleRow, 4).font = { bold: true, color: { argb: "FF166534" } };
    const assignedNoteRow = assignedTitleRow + 1;
    ws.getCell(assignedNoteRow, 4).value =
      "Nota: estos importes consideran unicamente las partidas marcadas como SELECCIONADO (lo que se va a pedir).";
    ws.getCell(assignedNoteRow, 4).font = { italic: true, color: { argb: "FF475569" } };

    const assignedStart = summaryStart + 6;
    const writeAssignedSummary = (label, key, row) => {
      ws.getCell(row, 4).value = label;
      ws.getCell(row, 4).font = { bold: true };
      providers.forEach((p, pIdx) => {
        const totalCol = 6 + pIdx * 2;
        const hasAssigned = assignedCountByProvider[p.id] > 0;
        ws.getCell(row, totalCol).value = hasAssigned
          ? round2(assignedTotalsByProvider[p.id][key] || 0)
          : "";
        ws.getCell(row, totalCol).numFmt = currencyFmt;
        ws.getCell(row, totalCol).font = { bold: true };
      });
    };
    writeAssignedSummary("Sub Total Seleccionado", "subtotal", assignedStart);
    writeAssignedSummary("I.V.A Seleccionado", "iva", assignedStart + 1);
    writeAssignedSummary("Total Seleccionado", "total", assignedStart + 2);
    const lastCol = 4 + providers.length * 2;

    const signatureLineRow = assignedStart + 10;
    const signatureLabelRow = signatureLineRow + 1;
    const signatureNameRow = signatureLineRow + 2;
    const signatureRoleRow = signatureLineRow + 3;

    const leftSignStart = 4;
    const signWidthCols = 4;
    const leftSignEnd = Math.min(
      leftSignStart + (signWidthCols - 1),
      Math.max(leftSignStart, lastCol - (signWidthCols + 2))
    );
    const rightSignEnd = lastCol;
    const rightSignStart = Math.max(leftSignEnd + 2, rightSignEnd - (signWidthCols - 1));

    const setMergedCenteredText = (row, startCol, endCol, text, font = {}) => {
      if (endCol <= startCol) {
        ws.getCell(row, startCol).value = text;
        ws.getCell(row, startCol).font = font;
        ws.getCell(row, startCol).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        return;
      }
      ws.mergeCells(row, startCol, row, endCol);
      const cell = ws.getCell(row, startCol);
      cell.value = text;
      cell.font = font;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    };

    for (let c = leftSignStart; c <= leftSignEnd; c += 1) {
      ws.getCell(signatureLineRow, c).border = {
        top: { style: "thin", color: { argb: "FF808080" } },
      };
    }
    for (let c = rightSignStart; c <= rightSignEnd; c += 1) {
      ws.getCell(signatureLineRow, c).border = {
        top: { style: "thin", color: { argb: "FF808080" } },
      };
    }

    setMergedCenteredText(signatureLabelRow, leftSignStart, leftSignEnd, "ELABORÓ", {
      bold: true,
      size: 11,
    });
    setMergedCenteredText(signatureLabelRow, rightSignStart, rightSignEnd, "Vo. Bo.", {
      bold: true,
      size: 11,
    });
    setMergedCenteredText(
      signatureNameRow,
      leftSignStart,
      leftSignEnd,
      "Mtro. Juan Jerónimo Centeno Quevedo",
      { size: 11 }
    );
    setMergedCenteredText(
      signatureNameRow,
      rightSignStart,
      rightSignEnd,
      "Arq. Héctor Cárdenas Monayo",
      { size: 11 }
    );
    setMergedCenteredText(
      signatureRoleRow,
      leftSignStart,
      leftSignEnd,
      "Jefe de la Unidad de Adquisiciones y Suministros",
      { size: 10 }
    );
    setMergedCenteredText(
      signatureRoleRow,
      rightSignStart,
      rightSignEnd,
      "Coordinador de Servicios Generales",
      { size: 10 }
    );

    ws.getRow(signatureLineRow).height = 16;
    ws.getRow(signatureLabelRow).height = 20;
    ws.getRow(signatureNameRow).height = 20;
    ws.getRow(signatureRoleRow).height = 22;

    ws.mergeCells("D1:I1");
    ws.mergeCells("D2:I2");
    ws.mergeCells("H4:I4");
    ws.mergeCells("I6:L6");
    providers.forEach((_, idx) => {
      const unitCol = 5 + idx * 2;
      const totalCol = unitCol + 1;
      ws.mergeCells(8, unitCol, 8, totalCol);
    });

    ws.getColumn(1).width = 8;
    ws.getColumn(2).width = 10;
    ws.getColumn(3).width = 12;
    ws.getColumn(4).width = 48;
    providers.forEach((_, idx) => {
      ws.getColumn(5 + idx * 2).width = 13;
      ws.getColumn(6 + idx * 2).width = 13;
    });

    ws.getCell("D1").font = { bold: true, size: 13 };
    ws.getCell("D2").font = { bold: true, size: 11 };
    ws.getCell("H4").font = { bold: true };
    ws.getCell("I4").font = { bold: true };
    ws.getCell("E6").font = { bold: true };
    ws.getCell("H6").font = { bold: true };
    ws.getRow(8).height = 26;
    ws.getRow(9).height = 24;

    const lastColLetter = excelColLetter(lastCol);
    const lastPrintRow = signatureRoleRow;
    ws.pageSetup.printArea = `A1:${lastColLetter}${lastPrintRow}`;
    for (let c = 1; c <= lastCol; c += 1) {
      ws.getCell(8, c).fill = tableHeaderFill;
      ws.getCell(9, c).fill = tableHeaderFill;
      ws.getCell(8, c).font = tableHeaderFont;
      ws.getCell(9, c).font = tableHeaderFont;
      ws.getCell(8, c).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      ws.getCell(9, c).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    }

    for (let r = 10; r < rowIndex; r += 1) {
      ws.getCell(r, 1).alignment = { vertical: "middle", horizontal: "center" };
      ws.getCell(r, 2).alignment = { vertical: "middle", horizontal: "center" };
      ws.getCell(r, 3).alignment = { vertical: "middle", horizontal: "center" };
      ws.getCell(r, 4).alignment = { vertical: "top", horizontal: "left", wrapText: true };
      if (r % 2 === 0) {
        for (let c = 1; c <= lastCol; c += 1) {
          if (!ws.getCell(r, c).fill) ws.getCell(r, c).fill = zebraFill;
        }
      }
      for (let c = 5; c <= lastCol; c += 1) {
        ws.getCell(r, c).alignment = { vertical: "middle", horizontal: "right" };
      }
    }

    for (let r = summaryStart; r <= summaryStart + 2; r += 1) {
      for (let c = 4; c <= lastCol; c += 1) {
        ws.getCell(r, c).fill = summaryFill;
      }
    }
    for (let r = assignedStart; r <= assignedStart + 2; r += 1) {
      for (let c = 4; c <= lastCol; c += 1) {
        ws.getCell(r, c).fill = summaryFill;
      }
    }

    for (let r = 8; r <= assignedStart + 2; r += 1) {
      for (let c = 1; c <= lastCol; c += 1) {
        ws.getCell(r, c).border = borderThin;
      }
    }

    ws.views = [{ state: "frozen", ySplit: 9 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `cuadro_comparativo_req_${id}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error) {
    console.error("Error downloadCotizacionExcel:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
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

    const { prices, selected_provider_ids } = req.body || {};
    const safePrices = Array.isArray(prices) ? prices : [];
    const selectedProviderIds = Array.isArray(selected_provider_ids)
      ? selected_provider_ids.map((x) => Number(x)).filter(Boolean)
      : [];

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
      new Set([
        ...safePrices.map((p) => Number(p.provider_id)).filter(Boolean),
        ...selectedProviderIds,
      ])
    );
    if (providerIdsIncoming.length === 0) {
      return res.status(400).json({ message: "No hay proveedores seleccionados para guardar" });
    }

    // Compatibilidad sin "invitación por correo":
    // si llegan proveedores en el cuadro comparativo, se registran en quotation_requests.
    await Promise.all(
      providerIdsIncoming.map((providerId) =>
        pool.query(
          `
          INSERT INTO quotation_requests (requisition_id, provider_id, status, invited_at, deadline_at)
          VALUES (?, ?, 'invited', NOW(), NULL)
          ON DUPLICATE KEY UPDATE
            status = IF(status = 'responded', status, status),
            invited_at = COALESCE(invited_at, NOW())
          `,
          [id, providerId]
        )
      )
    );

    const [invRows] = await pool.query(
      `SELECT provider_id FROM quotation_requests WHERE requisition_id = ?`,
      [id]
    );
    const invitedSet = new Set(invRows.map((r) => Number(r.provider_id)));

    const filtered = safePrices.filter((p) => invitedSet.has(Number(p.provider_id)));

    const insertQueries = filtered.map((p) => {
      const line_item_id = Number(p.line_item_id);
      const provider_id = Number(p.provider_id);

      const offered_description = "";

      const raw = p.unit_price;
      const unit_price =
        raw === "" || raw === null || raw === undefined
          ? null
          : Number.isFinite(Number(raw))
          ? Number(raw)
          : null;

      const vatRaw = p.vat_percentage;
      const vatPct =
        vatRaw === "" || vatRaw === null || vatRaw === undefined
          ? null
          : Number(vatRaw);
      if (vatPct != null && (!Number.isFinite(vatPct) || vatPct < 0 || vatPct > 100)) {
        return Promise.resolve();
      }

      const isrRaw = p.isr_percentage;
      const isrPct =
        isrRaw === "" || isrRaw === null || isrRaw === undefined
          ? null
          : Number(isrRaw);
      if (isrPct != null && (!Number.isFinite(isrPct) || isrPct < 0 || isrPct > 100)) {
        return Promise.resolve();
      }

      const notes = JSON.stringify({
        include_iva: vatPct != null,
        vat_percentage: vatPct,
        include_isr: isrPct != null,
        isr_percentage: isrPct,
      });
      const is_winner = Number(p.is_winner) ? 1 : 0;

      if (!line_item_id || !provider_id) return Promise.resolve();

      const hasPrice = unit_price !== null;
      if (!hasPrice) return Promise.resolve();

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
            const raw = p.unit_price;
            const hasPrice = !(raw === "" || raw === null || raw === undefined);
            return hasPrice;
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

    res.json({
      message: "Datos guardados correctamente",
      respondedProviderIds,
      selectedProviderIds: providerIdsIncoming,
    });
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

export const exportProvidersBasicExcel = async (req, res) => {
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
      SELECT p.id, p.name, p.razon_social, p.rfc, p.email, p.statuses_id
      FROM provider p
      WHERE ${where.join(" AND ")}
      ORDER BY p.name ASC
      LIMIT 10000
      `,
      params
    );

    let XLSX;
    try {
      const xlsxModule = await import("xlsx");
      XLSX = xlsxModule.default || xlsxModule;
    } catch {
      return res.status(500).json({
        message: "Falta dependencia para exportar Excel. Ejecuta npm install en backend.",
      });
    }

    const statusLabel = (id) => {
      const n = Number(id);
      if (n === 3) return "Activo";
      if (n === 4) return "Inactivo";
      if (n === 5) return "Verificado";
      if (n === 6) return "No verificado";
      return String(id || "");
    };

    const data = rows.map((r, idx) => ({
      "#": idx + 1,
      Nombre: r.name || "",
      "Razon social": r.razon_social || "",
      RFC: r.rfc || "",
      Email: r.email || "",
      Estatus: statusLabel(r.statuses_id),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 6 },
      { wch: 34 },
      { wch: 34 },
      { wch: 18 },
      { wch: 34 },
      { wch: 16 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Proveedores");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = "proveedores_basicos.xlsx";
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error) {
    console.error("Error exportProvidersBasicExcel:", error);
    return res.status(500).json({ message: "Error interno" });
  }
};

export const importProvidersFromExcel = async (req, res) => {
  try {
    const role = req.user?.role || "";
    if (role === "compras_lector") {
      return res.status(403).json({ message: "Acceso de solo lectura" });
    }

    if (!req.file?.buffer) {
      return res.status(400).json({ message: "Debes subir un archivo Excel (.xlsx/.xls/.csv)" });
    }

    let XLSX;
    try {
      const xlsxModule = await import("xlsx");
      XLSX = xlsxModule.default || xlsxModule;
    } catch {
      return res.status(500).json({
        message: "Falta dependencia para importar Excel. Ejecuta npm install en backend.",
      });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer", raw: false });
    const firstSheetName = workbook.SheetNames?.[0];
    if (!firstSheetName) {
      return res.status(400).json({ message: "El archivo no contiene hojas" });
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      raw: false,
      blankrows: false,
    });

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: "El archivo está vacío" });
    }

    if (rows.length > 5000) {
      return res.status(400).json({ message: "Máximo 5000 filas por importación" });
    }

    const parsedRows = [];
    const rowErrors = [];
    const seenRfcs = new Set();

    rows.forEach((row, idx) => {
      const normalized = {};
      Object.entries(row || {}).forEach(([key, value]) => {
        normalized[normalizeHeader(key)] = value;
      });

      const rowNumber = idx + 2;
      const nameRaw =
        normalized.nombre ||
        normalized.name ||
        normalized.proveedor ||
        normalized.nombrecomercial ||
        "";
      const razonRaw =
        normalized.razonsocial ||
        normalized.razonsoc ||
        normalized.razonsocialfiscal ||
        "";
      const rfcRaw = normalized.rfc || "";

      const name = String(nameRaw || "").trim();
      const razonSocial = String(razonRaw || "").trim();
      const rfc = String(rfcRaw || "").trim().toUpperCase();
      const finalName = name || razonSocial;

      if (!finalName && !rfc) return;

      if (!finalName) {
        rowErrors.push({ row: rowNumber, reason: "Nombre requerido" });
        return;
      }
      if (!rfc) {
        rowErrors.push({ row: rowNumber, reason: "RFC requerido" });
        return;
      }
      if (!RFC_REGEX.test(rfc)) {
        rowErrors.push({ row: rowNumber, reason: `RFC inválido (${rfc})` });
        return;
      }
      if (seenRfcs.has(rfc)) {
        rowErrors.push({ row: rowNumber, reason: `RFC repetido en archivo (${rfc})` });
        return;
      }
      seenRfcs.add(rfc);
      parsedRows.push({
        row: rowNumber,
        name: finalName,
        razon_social: razonSocial || null,
        rfc,
      });
    });

    if (!parsedRows.length) {
      return res.status(400).json({
        message: "No se encontraron filas válidas para importar",
        errors: rowErrors.slice(0, 50),
      });
    }

    const incomingRfcs = parsedRows.map((r) => r.rfc);
    const [existingRows] = await pool.query(
      `SELECT UPPER(TRIM(rfc)) AS rfc FROM provider WHERE rfc IN (${incomingRfcs.map(() => "?").join(",")})`,
      incomingRfcs
    );
    const existingSet = new Set(existingRows.map((r) => String(r.rfc || "").toUpperCase()));

    let created = 0;
    let skipped = 0;
    const importErrors = [...rowErrors];

    for (const entry of parsedRows) {
      if (existingSet.has(entry.rfc)) {
        skipped += 1;
        importErrors.push({ row: entry.row, reason: `RFC ya existe (${entry.rfc})` });
        continue;
      }
      try {
        await pool.query(
          `
          INSERT INTO provider (name, razon_social, email, rfc, statuses_id, address)
          VALUES (?, ?, ?, ?, 6, NULL)
          `,
          [entry.name, entry.razon_social, "", entry.rfc]
        );
        created += 1;
      } catch (error) {
        skipped += 1;
        importErrors.push({
          row: entry.row,
          reason: error?.code === "ER_DUP_ENTRY" ? `RFC duplicado (${entry.rfc})` : "Error al insertar fila",
        });
      }
    }

    return res.json({
      ok: true,
      created,
      skipped,
      totalRows: rows.length,
      errors: importErrors.slice(0, 200),
      message: `Importación completada. Creados: ${created}. Omitidos: ${skipped}.`,
    });
  } catch (error) {
    console.error("Error importProvidersFromExcel:", error);
    return res.status(500).json({ message: "Error al importar proveedores" });
  }
};

export const createProvider = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      name,
      razon_social = null,
      email = "",
      rfc,
      address = null,
      statuses_id = 6,
      categories = [],
      phones = [],
    } = req.body || {};

    const cleanName = String(name || "").trim();
    const cleanRazon = razon_social ? String(razon_social).trim() : null;
    const cleanEmail = email ? String(email).trim() : "";
    const cleanAddress = address ? String(address).trim() : null;
    let cleanRfc = normalizeRfc(rfc);

    if (!cleanName) {
      return res.status(400).json({ message: "name es requerido" });
    }
    if (cleanRfc && !RFC_REGEX.test(cleanRfc)) {
      return res.status(400).json({ message: "RFC inválido" });
    }

    const cleanStatus = normalizeProviderStatus(statuses_id);
    const cleanCategories = normalizeProviderCategories(categories);
    const cleanPhones = normalizeProviderPhones(phones);

    await conn.beginTransaction();

    if (!cleanRfc) {
      cleanRfc = await generateDraftRfc(conn);
    }

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
      [cleanName, cleanRazon, cleanEmail, cleanRfc, cleanStatus, cleanAddress]
    );

    const providerId = insert.insertId;

    if (cleanCategories.length > 0) {
      const values = cleanCategories.map((catId) => [providerId, catId]);
      await conn.query(
        `INSERT INTO provider_has_category (provider_id, categories_id) VALUES ?`,
        [values]
      );
    }

    if (cleanPhones.length > 0) {
      for (const value of cleanPhones) {
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
    const mapped = mapProviderMutationError(error);
    res.status(mapped.status).json({ message: mapped.message });
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
      email = "",
      rfc,
      address = null,
      statuses_id,
      categories = [],
      phones = [],
    } = req.body || {};

    const cleanName = String(name || "").trim();
    const cleanRazon = razon_social ? String(razon_social).trim() : null;
    const cleanEmail = email ? String(email).trim() : "";
    const cleanAddress = address ? String(address).trim() : null;
    let cleanRfc = normalizeRfc(rfc);

    if (!cleanName) {
      return res.status(400).json({ message: "name es requerido" });
    }
    const cleanStatus = normalizeProviderStatus(statuses_id);
    const cleanCategories = normalizeProviderCategories(categories);
    const cleanPhones = normalizeProviderPhones(phones);

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
    if (!cleanRfc) cleanRfc = currentRfc;
    const rfcChanged = currentRfc !== cleanRfc;
    if (rfcChanged && !RFC_REGEX.test(cleanRfc)) {
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
        cleanStatus,
        cleanAddress,
        providerId,
      ]
    );

    await conn.query(`DELETE FROM provider_has_category WHERE provider_id = ?`, [providerId]);
    if (cleanCategories.length > 0) {
      const values = cleanCategories.map((catId) => [providerId, catId]);
      await conn.query(
        `INSERT INTO provider_has_category (provider_id, categories_id) VALUES ?`,
        [values]
      );
    }

    await conn.query(`DELETE FROM provider_has_phones WHERE provider_id = ?`, [providerId]);
    if (cleanPhones.length > 0) {
      for (const value of cleanPhones) {
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
    const mapped = mapProviderMutationError(error);
    res.status(mapped.status).json({ message: mapped.message });
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
      SELECT id, statuses_id, quotation_closed_at, users_id
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

    const [[providersCountRow]] = await conn.query(
      `
      SELECT COUNT(DISTINCT provider_id) AS total_providers
      FROM quotation_requests
      WHERE requisition_id = ?
      `,
      [id]
    );
    const totalProviders = Number(providersCountRow?.total_providers || 0);
    if (totalProviders < 3) {
      await conn.rollback();
      return res.status(400).json({
        message: "Debes tener al menos 3 proveedores para cerrar recepción",
        total_providers: totalProviders,
      });
    }

    const [[capturedProvidersRow]] = await conn.query(
      `
      SELECT COUNT(DISTINCT provider_id) AS total_captured_providers
      FROM quotation_prices
      WHERE requisition_id = ?
        AND unit_price IS NOT NULL
      `,
      [id]
    );
    const totalCapturedProviders = Number(capturedProvidersRow?.total_captured_providers || 0);
    if (totalCapturedProviders < 3) {
      await conn.rollback();
      return res.status(400).json({
        message: "Debes capturar cotización de al menos 3 proveedores antes de cerrar recepción",
        total_captured_providers: totalCapturedProviders,
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

    const closedBy = Number(req.user?.id || 0) || null;

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
    const role = req.user?.role || "";
    if (!["compras_admin", "compras_operador"].includes(role)) {
      return res.status(403).json({ message: "Solo compras admin u operador puede enviar a revisión interna" });
    }
    const ok = await ensureAssignedOrAdmin(req, res, id);
    if (!ok) return;

    await conn.beginTransaction();

    const [reqRows] = await conn.query(
      `
      SELECT id, statuses_id, quotation_closed_at, users_id
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

    const [[providersCountRow]] = await conn.query(
      `
      SELECT COUNT(DISTINCT provider_id) AS total_providers
      FROM quotation_requests
      WHERE requisition_id = ?
      `,
      [id]
    );
    const totalProviders = Number(providersCountRow?.total_providers || 0);
    if (totalProviders < 3) {
      await conn.rollback();
      return res.status(400).json({
        message: "Debes tener al menos 3 proveedores para enviar a revisión",
        total_providers: totalProviders,
      });
    }

    const [[capturedProvidersRow]] = await conn.query(
      `
      SELECT COUNT(DISTINCT provider_id) AS total_captured_providers
      FROM quotation_prices
      WHERE requisition_id = ?
        AND unit_price IS NOT NULL
      `,
      [id]
    );
    const totalCapturedProviders = Number(capturedProvidersRow?.total_captured_providers || 0);
    if (totalCapturedProviders < 3) {
      await conn.rollback();
      return res.status(400).json({
        message: "Debes tener cotización capturada de al menos 3 proveedores para enviar a revisión",
        total_captured_providers: totalCapturedProviders,
      });
    }

    const [[totalItemsRow]] = await conn.query(
      `SELECT COUNT(*) AS total_items FROM line_items WHERE requisition_id = ?`,
      [id]
    );
    const totalItems = Number(totalItemsRow?.total_items || 0);
    if (totalItems <= 0) {
      await conn.rollback();
      return res.status(400).json({
        message: "La requisición no tiene partidas",
      });
    }

    const [[quotedItemsRow]] = await conn.query(
      `
      SELECT COUNT(DISTINCT line_item_id) AS quoted_items
      FROM quotation_prices
      WHERE requisition_id = ?
        AND unit_price IS NOT NULL
      `,
      [id]
    );
    const quotedItems = Number(quotedItemsRow?.quoted_items || 0);
    if (quotedItems < totalItems) {
      await conn.rollback();
      return res.status(400).json({
        message:
          "Faltan partidas por cotizar. Debes capturar al menos una cotización por cada partida antes de enviar a revisión",
        total_items: totalItems,
        quoted_items: quotedItems,
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
    await logRequisitionStatusChange(
      {
        requisitionId: id,
        fromStatusId: st,
        toStatusId: 14,
        changedBy: Number(req.user?.id || 0) || null,
        note: "Enviado a revisión interna de compras",
      },
      conn
    );

    const actorId = Number(req.user?.id || 0) || null;
    const adminIds = (await getComprasAdminIds(conn)).filter((uid) => uid !== actorId);
    const ownerId = Number(reqRow.users_id || 0) || null;
    await conn.commit();
    for (const adminId of adminIds) {
      await createNotification({
        recipientUserId: adminId,
        actorUserId: actorId,
        title: "Revisión interna de cotización",
        message: `La requisición #${id} está lista para revisión interna y selección final.`,
        entityType: "requisition",
        entityId: Number(id),
        actionPath: `/compras/revision/${id}`,
      });
    }
    if (ownerId && ownerId !== actorId) {
      await createNotification({
        recipientUserId: ownerId,
        actorUserId: actorId,
        title: "Requisición en revisión interna de Compras",
        message: `La requisición #${id} avanzó a revisión interna de cotizaciones.`,
        entityType: "requisition",
        entityId: Number(id),
        actionPath: `/unidad/mi-requisiciones?openReq=${id}`,
      });
    }
    const coordinatorIds = await getCoordinatorUsersForRequisition(id);
    await createNotificationsForUsers(coordinatorIds, {
      actorUserId: actorId,
      title: "Requisición en revisión interna de Compras",
      message: `La requisición #${id} cambió a revisión interna de Compras.`,
      entityType: "requisition",
      entityId: Number(id),
      actionPath: `/coordinador/requisiciones?openReq=${id}`,
    });
    const secretariaIds = await getUsersByRole("secretaria");
    await createNotificationsForUsers(secretariaIds, {
      actorUserId: actorId,
      title: "Requisición en revisión interna",
      message: `La requisición #${id} está en revisión interna de Compras.`,
      entityType: "requisition",
      entityId: Number(id),
      actionPath: `/secretaria/recibidas?openReq=${id}`,
    });
    res.json({ message: "Enviado a revisión interna de Compras", requisition_statuses_id: 14 });
  } catch (error) {
    await conn.rollback();
    console.error("Error enviando a revisión:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  } finally {
    conn.release();
  }
};

export const getComprasReviewData = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user?.role !== "compras_admin") {
      return res.status(403).json({ message: "Solo compras admin puede revisar y seleccionar" });
    }
    const ok = await ensureAssignedOrAdmin(req, res, id);
    if (!ok) return;

    const [reqRows] = await pool.query(
      `
      SELECT 
        r.id,
        r.request_name,
        r.users_id,
        r.statuses_id,
        r.quotation_closed_at,
        c.id as category_id,
        c.name as category_name
      FROM requisition r
      LEFT JOIN categories c ON r.categories_id = c.id
      WHERE r.id = ?
      `,
      [id]
    );

    if (reqRows.length === 0) {
      return res.status(404).json({ message: "Requisición no encontrada" });
    }

    const requisition = reqRows[0];
    if (Number(requisition.statuses_id) !== 14) {
      return res.status(400).json({
        message: "La requisición no está en revisión interna de compras",
        current_status: requisition.statuses_id,
      });
    }

    const [items] = await pool.query(
      `
      SELECT 
        li.id,
        li.quantity,
        li.description,
        un.name AS unidad_medida
      FROM line_items li
      LEFT JOIN units un ON li.units_id = un.id
      WHERE li.requisition_id = ?
      ORDER BY li.id ASC
      `,
      [id]
    );

    const [invitedProviders] = await pool.query(
      `
      SELECT 
        p.id, p.name, p.email, p.rfc,
        qr.status, qr.invited_at, qr.responded_at, qr.deadline_at
      FROM quotation_requests qr
      INNER JOIN provider p ON p.id = qr.provider_id
      WHERE qr.requisition_id = ?
      ORDER BY 
        FIELD(qr.status, 'responded', 'invited', 'expired', 'declined') ASC,
        qr.invited_at DESC
      `,
      [id]
    );

    const [savedPrices] = await pool.query(
      `
      SELECT 
        line_item_id,
        provider_id,
        unit_price,
        offered_description,
        notes,
        is_winner
      FROM quotation_prices
      WHERE requisition_id = ?
      `,
      [id]
    );

    const [selections] = await pool.query(
      `
      SELECT line_item_id, provider_id, selected_unit_price, selected_description
      FROM quotation_selections
      WHERE requisition_id = ?
      `,
      [id]
    );

    return res.json({
      requisition,
      items,
      invitedProviders,
      savedPrices,
      selections,
      canEdit: true,
    });
  } catch (error) {
    console.error("Error getComprasReviewData:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const getComprasRequisitionTimeline = async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await ensureAssignedOrAdmin(req, res, id);
    if (!ok) return;

    const [[reqRow]] = await pool.query(
      `
      SELECT id, created_at, sent_on, quotation_closed_at, statuses_id
      FROM requisition
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );
    if (!reqRow) {
      return res.status(404).json({ message: "Requisición no encontrada" });
    }

    const statusTimeline = await getRequisitionStatusTimeline(id);
    return res.json({
      requisition: reqRow,
      statusTimeline,
    });
  } catch (error) {
    console.error("Error getComprasRequisitionTimeline:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const submitComprasReviewSelection = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { selections } = req.body || {};
    if (req.user?.role !== "compras_admin") {
      return res.status(403).json({ message: "Solo compras admin puede seleccionar proveedores" });
    }
    const ok = await ensureAssignedOrAdmin(req, res, id);
    if (!ok) return;

    if (!Array.isArray(selections) || selections.length === 0) {
      return res.status(400).json({ message: "selections es requerido" });
    }

    await conn.beginTransaction();
    const withSelectionTaxCols = await hasSelectionTaxColumns(conn);

    const [reqRows] = await conn.query(
      `SELECT id, statuses_id, assigned_operator_id, users_id FROM requisition WHERE id = ? FOR UPDATE`,
      [id]
    );
    if (reqRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: "Requisición no encontrada" });
    }

    if (Number(reqRows[0].statuses_id) !== 14) {
      await conn.rollback();
      return res.status(400).json({
        message: "La requisición no está en revisión interna de compras",
        current_status: reqRows[0].statuses_id,
      });
    }

    const [validItems] = await conn.query(
      `SELECT id FROM line_items WHERE requisition_id = ?`,
      [id]
    );
    const validItemSet = new Set(validItems.map((x) => Number(x.id)));
    if (validItemSet.size === 0) {
      await conn.rollback();
      return res.status(400).json({ message: "La requisición no tiene partidas" });
    }

    const [validProviders] = await conn.query(
      `SELECT DISTINCT provider_id FROM quotation_requests WHERE requisition_id = ?`,
      [id]
    );
    const validProviderSet = new Set(validProviders.map((x) => Number(x.provider_id)));
    if (validProviderSet.size === 0) {
      await conn.rollback();
      return res.status(400).json({ message: "No hay proveedores invitados a esta requisición" });
    }

    for (const s of selections) {
      const line_item_id = Number(s.line_item_id);
      const provider_id = Number(s.provider_id);

      if (!line_item_id || !provider_id) {
        await conn.rollback();
        return res.status(400).json({ message: "line_item_id y provider_id son requeridos" });
      }
      if (!validItemSet.has(line_item_id)) {
        await conn.rollback();
        return res.status(400).json({ message: `Partida inválida: ${line_item_id}` });
      }
      if (!validProviderSet.has(provider_id)) {
        await conn.rollback();
        return res.status(400).json({ message: `Proveedor inválido/no invitado: ${provider_id}` });
      }

      const [priceRows] = await conn.query(
        `
        SELECT unit_price, offered_description, notes
        FROM quotation_prices
        WHERE requisition_id = ? AND line_item_id = ? AND provider_id = ?
        LIMIT 1
        `,
        [id, line_item_id, provider_id]
      );
      if (priceRows.length === 0) {
        await conn.rollback();
        return res.status(400).json({
          message: `No existe cotización para partida ${line_item_id} con proveedor ${provider_id}`,
        });
      }
      const selectedSource = priceRows[0];
      const { vatPct, isrPct } = parseSelectionTaxesFromNotes(selectedSource.notes);

      const selected_unit_price =
        selectedSource.unit_price === "" || selectedSource.unit_price == null
          ? null
          : Number(selectedSource.unit_price);
      const selected_description = (selectedSource.offered_description ?? "").toString();

      if (withSelectionTaxCols) {
        await conn.query(
          `
          INSERT INTO quotation_selections
            (
              requisition_id,
              line_item_id,
              provider_id,
              selected_unit_price,
              selected_description,
              selected_vat_percentage,
              selected_isr_percentage,
              created_at,
              updated_at
            )
          VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            provider_id = VALUES(provider_id),
            selected_unit_price = VALUES(selected_unit_price),
            selected_description = VALUES(selected_description),
            selected_vat_percentage = VALUES(selected_vat_percentage),
            selected_isr_percentage = VALUES(selected_isr_percentage),
            updated_at = NOW()
          `,
          [
            id,
            line_item_id,
            provider_id,
            selected_unit_price,
            selected_description,
            vatPct,
            isrPct,
          ]
        );
      } else {
        await conn.query(
          `
          INSERT INTO quotation_selections
            (requisition_id, line_item_id, provider_id, selected_unit_price, selected_description, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            provider_id = VALUES(provider_id),
            selected_unit_price = VALUES(selected_unit_price),
            selected_description = VALUES(selected_description),
            updated_at = NOW()
          `,
          [id, line_item_id, provider_id, selected_unit_price, selected_description]
        );
      }
    }

    const [[tot]] = await conn.query(
      `SELECT COUNT(*) AS total FROM line_items WHERE requisition_id = ?`,
      [id]
    );
    const [[sel]] = await conn.query(
      `
      SELECT COUNT(DISTINCT line_item_id) AS selected
      FROM quotation_selections
      WHERE requisition_id = ?
      `,
      [id]
    );

    const total = Number(tot.total || 0);
    const selected = Number(sel.selected || 0);
    const missing = Math.max(0, total - selected);
    let sent_to_purchase = false;

    if (total > 0 && selected === total) {
      await conn.query(`UPDATE requisition SET statuses_id = 13 WHERE id = ?`, [id]);
      await logRequisitionStatusChange(
        {
          requisitionId: id,
          fromStatusId: 14,
          toStatusId: 13,
          changedBy: Number(req.user?.id || 0) || null,
          note: "Selección final completa en cuadro comparativo",
        },
        conn
      );
      sent_to_purchase = true;
    }

    await conn.commit();

    if (sent_to_purchase) {
      const actorId = Number(req.user?.id || 0) || null;
      const operatorId = Number(reqRows[0].assigned_operator_id || 0);
      const ownerId = Number(reqRows[0].users_id || 0);
      if (operatorId > 0) {
        await createNotification({
          recipientUserId: operatorId,
          actorUserId: actorId,
          title: "Selección aprobada por Compras Admin",
          message: `La requisición #${id} ya tiene selección completa y pasó a proceso de compra.`,
          entityType: "requisition",
          entityId: Number(id),
          actionPath: "/compras/dashboard",
        });
      }
      if (ownerId > 0 && ownerId !== actorId) {
        await createNotification({
          recipientUserId: ownerId,
          actorUserId: actorId,
          title: "Requisición en proceso de compra",
          message: `La requisición #${id} pasó a proceso de compra.`,
          entityType: "requisition",
          entityId: Number(id),
          actionPath: `/unidad/mi-requisiciones?openReq=${id}`,
        });
      }
      const coordinatorIds = await getCoordinatorUsersForRequisition(id);
      await createNotificationsForUsers(coordinatorIds, {
        actorUserId: actorId,
        title: "Requisición en proceso de compra",
        message: `La requisición #${id} pasó a proceso de compra.`,
        entityType: "requisition",
        entityId: Number(id),
        actionPath: `/coordinador/requisiciones?openReq=${id}`,
      });
      const secretariaIds = await getUsersByRole("secretaria");
      await createNotificationsForUsers(secretariaIds, {
        actorUserId: actorId,
        title: "Requisición en proceso de compra",
        message: `La requisición #${id} avanzó a proceso de compra.`,
        entityType: "requisition",
        entityId: Number(id),
        actionPath: `/secretaria/recibidas?openReq=${id}`,
      });
    }

    return res.json({
      ok: true,
      sent_to_purchase,
      total,
      selected,
      missing,
      message: sent_to_purchase
        ? "Selección completa. Enviada a proceso de compra."
        : `Selección guardada. Faltan ${missing} partida(s) por seleccionar.`,
    });
  } catch (error) {
    await conn.rollback();
    console.error("Error submitComprasReviewSelection:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
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
      `SELECT id, statuses_id, quotation_closed_at, assigned_operator_id, users_id FROM requisition WHERE id = ?`,
      [id]
    );
    if (reqRows.length === 0) {
      return res.status(404).json({ message: "Requisición no encontrada" });
    }

    const st = Number(reqRows[0].statuses_id);
    const changedFromReview = st === 14;

    await pool.query(
      `
      UPDATE requisition
      SET quotation_closed_at = NULL,
          quotation_closed_by = NULL,
          quotation_close_note = NULL,
          statuses_id = CASE WHEN statuses_id = 14 THEN 12 ELSE statuses_id END
      WHERE id = ?
      `,
      [id]
    );

    if (changedFromReview) {
      const actorId = Number(req.user?.id || 0) || null;
      const operatorId = Number(reqRows[0].assigned_operator_id || 0) || null;
      const ownerId = Number(reqRows[0].users_id || 0) || null;

      await logRequisitionStatusChange({
        requisitionId: id,
        fromStatusId: 14,
        toStatusId: 12,
        changedBy: actorId,
        note: "Regresada de revisión interna a cotización",
      });

      if (operatorId && operatorId !== actorId) {
        await createNotification({
          recipientUserId: operatorId,
          actorUserId: actorId,
          title: "Requisición regresada a cotización",
          message: `La requisición #${id} regresó desde revisión interna para ajustes de cotización.`,
          entityType: "requisition",
          entityId: Number(id),
          actionPath: `/compras/cotizar/${id}`,
        });
      }

      if (ownerId && ownerId !== actorId) {
        await createNotification({
          recipientUserId: ownerId,
          actorUserId: actorId,
          title: "Requisición regresada a cotización",
          message: `La requisición #${id} regresó a cotización para ajustes en Compras.`,
          entityType: "requisition",
          entityId: Number(id),
          actionPath: `/unidad/mi-requisiciones?openReq=${id}`,
        });
      }

      const coordinatorIds = await getCoordinatorUsersForRequisition(id);
      await createNotificationsForUsers(coordinatorIds, {
        actorUserId: actorId,
        title: "Requisición regresada a cotización",
        message: `La requisición #${id} regresó de revisión interna a cotización.`,
        entityType: "requisition",
        entityId: Number(id),
        actionPath: `/coordinador/requisiciones?openReq=${id}`,
      });

      const secretariaIds = await getUsersByRole("secretaria");
      await createNotificationsForUsers(secretariaIds, {
        actorUserId: actorId,
        title: "Requisición regresada a cotización",
        message: `La requisición #${id} regresó a cotización para ajustes de Compras.`,
        entityType: "requisition",
        entityId: Number(id),
        actionPath: `/secretaria/recibidas?openReq=${id}`,
      });
    }

    res.json({
      message: changedFromReview
        ? "Requisición regresada a cotización para ajustes"
        : "Recepción reabierta",
      requisition_statuses_id: changedFromReview ? 12 : st,
    });
  } catch (error) {
    console.error("Error reabriendo recepción:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
