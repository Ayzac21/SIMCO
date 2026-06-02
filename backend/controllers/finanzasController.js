import { pool } from "../db/connection.js";
import bcrypt from "bcryptjs";
import {
  createNotification,
  createNotificationsForUsers,
  getCoordinatorUsersForRequisition,
  getSecretariaUsersForRequisition,
  getUsersByRole,
} from "../services/notifications.js";
import {
  ensureStatusHistoryTable,
  getRequisitionStatusTimeline,
  logRequisitionStatusChange,
} from "../services/statusHistory.js";

const FINANZAS_STATUS = 15;
const FINANZAS_APPROVED_STATUS = 16;
const FINANZAS_REJECTED_STATUS = 17;
const COMPRA_STATUS = 13;
const FINANCE_CATALOG_TYPES = new Set(["project", "fund", "program"]);
const DEFAULT_PASSWORD = process.env.DEFAULT_USER_PASSWORD || "";
const FINANCE_ROLES = new Set(["finanzas", "finanzas_admin", "finanzas_analista", "finanzas_lector"]);
const FINANCE_ADMIN_ROLES = new Set(["finanzas", "finanzas_admin"]);
const FINANCE_REVIEW_ROLES = new Set(["finanzas", "finanzas_admin", "finanzas_analista"]);

const cleanText = (value) => String(value || "").trim();
const parsePositiveId = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

export const isFinanceRole = (role) => FINANCE_ROLES.has(String(role || ""));
export const isFinanceAdminRole = (role) => FINANCE_ADMIN_ROLES.has(String(role || ""));
const isFinanceReviewRole = (role) => FINANCE_REVIEW_ROLES.has(String(role || ""));

const moneyNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

let ensureFinanceWorkflowSchemaPromise = null;
let ensureFinanceCatalogSchemaPromise = null;
let selectionTaxColumnsAvailableCache = null;

const ensureColumn = async (connOrPool, tableName, columnName, definition) => {
  const [columns] = await connOrPool.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  if (!Array.isArray(columns) || columns.length === 0) {
    await connOrPool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
};

const ensureFinanceWorkflowSchema = async (connOrPool = pool) => {
  if (!ensureFinanceWorkflowSchemaPromise) {
    ensureFinanceWorkflowSchemaPromise = (async () => {
      const [statusTypeColumns] = await connOrPool.query(`SHOW COLUMNS FROM statuses LIKE 'type'`);
      const hasStatusTypeColumn = Array.isArray(statusTypeColumns) && statusTypeColumns.length > 0;

      if (hasStatusTypeColumn) {
        await connOrPool.query(
          `
          INSERT INTO statuses (id, type, name) VALUES
            (?, 'Requisitions', 'Finanzas'),
            (?, 'Requisitions', 'Aprobada por Finanzas'),
            (?, 'Requisitions', 'Rechazada por Finanzas')
          ON DUPLICATE KEY UPDATE type = VALUES(type), name = VALUES(name)
          `,
          [FINANZAS_STATUS, FINANZAS_APPROVED_STATUS, FINANZAS_REJECTED_STATUS]
        );
      } else {
        await connOrPool.query(
          `
          INSERT INTO statuses (id, name) VALUES
            (?, 'Finanzas'),
            (?, 'Aprobada por Finanzas'),
            (?, 'Rechazada por Finanzas')
          ON DUPLICATE KEY UPDATE name = VALUES(name)
          `,
          [FINANZAS_STATUS, FINANZAS_APPROVED_STATUS, FINANZAS_REJECTED_STATUS]
        );
      }

      await connOrPool.query(`
        CREATE TABLE IF NOT EXISTS requisition_finance_review (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          requisition_id INT NOT NULL,
          project VARCHAR(180) NULL,
          fund VARCHAR(180) NULL,
          strategic_program VARCHAR(180) NULL,
          budget_available TINYINT(1) NOT NULL DEFAULT 0,
          finance_observation TEXT NULL,
          reviewed_by BIGINT NULL,
          reviewed_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_rfr_requisition (requisition_id),
          INDEX idx_rfr_reviewed_by (reviewed_by),
          CONSTRAINT fk_rfr_requisition
            FOREIGN KEY (requisition_id) REFERENCES requisition(id)
            ON DELETE CASCADE
        )
      `);

      await ensureColumn(connOrPool, "requisition_finance_review", "project", "VARCHAR(180) NULL");
      await ensureColumn(connOrPool, "requisition_finance_review", "fund", "VARCHAR(180) NULL");
      await ensureColumn(connOrPool, "requisition_finance_review", "strategic_program", "VARCHAR(180) NULL");
      await ensureColumn(
        connOrPool,
        "requisition_finance_review",
        "budget_available",
        "TINYINT(1) NOT NULL DEFAULT 0"
      );
      await ensureColumn(connOrPool, "requisition_finance_review", "finance_observation", "TEXT NULL");
      await ensureColumn(connOrPool, "requisition_finance_review", "reviewed_by", "BIGINT NULL");
      await ensureColumn(connOrPool, "requisition_finance_review", "reviewed_at", "DATETIME NULL");
      await ensureColumn(
        connOrPool,
        "requisition_finance_review",
        "created_at",
        "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
      );
      await ensureColumn(
        connOrPool,
        "requisition_finance_review",
        "updated_at",
        "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
      );
    })().catch((error) => {
      ensureFinanceWorkflowSchemaPromise = null;
      throw error;
    });
  }
  await ensureFinanceWorkflowSchemaPromise;
};

const getFinanzasHistorialRows = async () => {
  await ensureFinanceWorkflowSchema();
  const [rows] = await pool.query(
    `
    SELECT
      r.id,
      r.folio,
      r.area_folio,
      r.request_name,
      r.justification,
      r.observation,
      r.notes,
      r.statuses_id,
      r.created_at,
      r.sent_on,
      s.name AS nombre_estatus,
      u.name AS solicitante,
      u.ure AS solicitante_ure,
      reviewer.name AS revisado_por,
      fr.project,
      fr.fund,
      fr.strategic_program,
      fr.budget_available,
      fr.finance_observation,
      fr.reviewed_at,
      CASE
        WHEN r.statuses_id IN (?, 11) THEN 'aprobada'
        WHEN r.statuses_id = ? THEN 'rechazada'
        WHEN r.statuses_id = ? THEN 'devuelta'
        ELSE 'revisada'
      END AS finance_result,
      COALESCE(SUM(COALESCE(li.quantity, 0) * COALESCE(qs.selected_unit_price, 0)), 0) AS selected_total
    FROM requisition_finance_review fr
    JOIN requisition r ON r.id = fr.requisition_id
    JOIN users u ON u.id = r.users_id
    JOIN statuses s ON s.id = r.statuses_id
    LEFT JOIN users reviewer ON reviewer.id = fr.reviewed_by
    LEFT JOIN line_items li ON li.requisition_id = r.id
    LEFT JOIN quotation_selections qs
      ON qs.requisition_id = r.id
     AND qs.line_item_id = li.id
    WHERE fr.reviewed_at IS NOT NULL
    GROUP BY
      r.id,
      r.folio,
      r.area_folio,
      r.request_name,
      r.justification,
      r.observation,
      r.notes,
      r.statuses_id,
      r.created_at,
      r.sent_on,
      s.name,
      u.name,
      u.ure,
      reviewer.name,
      fr.project,
      fr.fund,
      fr.strategic_program,
      fr.budget_available,
      fr.finance_observation,
      fr.reviewed_at
    ORDER BY fr.reviewed_at DESC, r.id DESC
    `,
    [FINANZAS_APPROVED_STATUS, FINANZAS_REJECTED_STATUS, COMPRA_STATUS]
  );
  return rows;
};

const filterFinanzasHistorialRows = (rows, filters = {}) => {
  const needle = cleanText(filters.query).toLowerCase();
  const resultFilter = cleanText(filters.result || "all");
  const monthFilter = cleanText(filters.month || "all");
  const projectFilter = cleanText(filters.project || "all");
  const fundFilter = cleanText(filters.fund || "all");
  const programFilter = cleanText(filters.program || "all");
  const onlyWithObservation = String(filters.onlyWithObservation || "") === "true";
  const sortBy = cleanText(filters.sort || "newest");

  const result = rows.filter((row) => {
    if (resultFilter !== "all" && row.finance_result !== resultFilter) return false;
    if (projectFilter !== "all" && cleanText(row.project) !== projectFilter) return false;
    if (fundFilter !== "all" && cleanText(row.fund) !== fundFilter) return false;
    if (programFilter !== "all" && cleanText(row.strategic_program) !== programFilter) return false;
    if (onlyWithObservation && !cleanText(row.finance_observation)) return false;
    if (monthFilter !== "all") {
      const date = new Date(row.reviewed_at);
      const key = Number.isNaN(date.getTime())
        ? ""
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (key !== monthFilter) return false;
    }
    if (!needle) return true;
    return [
      row.id,
      row.folio,
      row.area_folio,
      row.request_name,
      row.solicitante,
      row.solicitante_ure,
      row.project,
      row.fund,
      row.strategic_program,
      row.finance_observation,
    ]
      .map((value) => String(value || "").toLowerCase())
      .some((value) => value.includes(needle));
  });

  result.sort((a, b) => {
    if (sortBy === "oldest") return new Date(a.reviewed_at) - new Date(b.reviewed_at);
    if (sortBy === "amount_desc") return moneyNumber(b.selected_total) - moneyNumber(a.selected_total);
    if (sortBy === "amount_asc") return moneyNumber(a.selected_total) - moneyNumber(b.selected_total);
    if (sortBy === "project") return cleanText(a.project).localeCompare(cleanText(b.project), "es");
    return new Date(b.reviewed_at) - new Date(a.reviewed_at);
  });

  return result;
};

const ensureFinanceCatalogSchema = async (connOrPool = pool) => {
  if (!ensureFinanceCatalogSchemaPromise) {
    ensureFinanceCatalogSchemaPromise = connOrPool.query(`
      CREATE TABLE IF NOT EXISTS finance_catalog_entries (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        catalog_type ENUM('project', 'fund', 'program') NOT NULL,
        code VARCHAR(60) NULL,
        name VARCHAR(180) NOT NULL,
        fiscal_year INT NULL,
        budget_amount DECIMAL(14,2) NULL,
        description TEXT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_finance_catalog_type_name (catalog_type, name),
        INDEX idx_finance_catalog_type_active (catalog_type, is_active),
        INDEX idx_finance_catalog_code (catalog_type, code)
      )
    `).catch((error) => {
      ensureFinanceCatalogSchemaPromise = null;
      throw error;
    });
  }
  await ensureFinanceCatalogSchemaPromise;
};

const hasSelectionTaxColumns = async (connOrPool = pool) => {
  if (selectionTaxColumnsAvailableCache !== null) return selectionTaxColumnsAvailableCache;
  const [vatColumns] = await connOrPool.query(
    `SHOW COLUMNS FROM quotation_selections LIKE 'selected_vat_percentage'`
  );
  const [isrColumns] = await connOrPool.query(
    `SHOW COLUMNS FROM quotation_selections LIKE 'selected_isr_percentage'`
  );
  selectionTaxColumnsAvailableCache =
    Array.isArray(vatColumns) &&
    vatColumns.length > 0 &&
    Array.isArray(isrColumns) &&
    isrColumns.length > 0;
  return selectionTaxColumnsAvailableCache;
};

const cleanNullableText = (value) => {
  const text = cleanText(value);
  return text || null;
};

const parseCatalogType = (value) => {
  const type = cleanText(value);
  return FINANCE_CATALOG_TYPES.has(type) ? type : "";
};

const parseOptionalYear = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : null;
};

const parseOptionalAmount = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const mapDuplicateCatalogError = (error) => {
  if (error?.code === "ER_DUP_ENTRY") {
    return { status: 409, message: "Ya existe un registro con ese nombre en este catálogo" };
  }
  return { status: 500, message: "Error al guardar catálogo financiero" };
};

const getApprovalValidationError = async (conn, reqId, { project, fund, strategicProgram, budgetAvailable }) => {
  const missing = [];
  if (!project) missing.push("proyecto");
  if (!fund) missing.push("fondo");
  if (!strategicProgram) missing.push("programa estratégico");
  if (!budgetAvailable) missing.push("presupuesto disponible");

  if (missing.length > 0) {
    return {
      message: `Para aprobar falta: ${missing.join(", ")}.`,
      details: missing,
    };
  }

  await ensureFinanceCatalogSchema(conn);
  const catalogChecks = [
    { type: "project", name: project, label: "proyecto" },
    { type: "fund", name: fund, label: "fondo" },
    { type: "program", name: strategicProgram, label: "programa estratégico" },
  ];

  for (const check of catalogChecks) {
    const [[entry]] = await conn.query(
      `
      SELECT id, is_active
      FROM finance_catalog_entries
      WHERE catalog_type = ? AND name = ?
      LIMIT 1
      `,
      [check.type, check.name]
    );

    if (!entry) {
      return {
        message: `No se puede aprobar: el ${check.label} seleccionado ya no existe en Catálogos de Finanzas.`,
        details: [check.label],
      };
    }
    if (Number(entry.is_active || 0) !== 1) {
      return {
        message: `No se puede aprobar: el ${check.label} seleccionado está desactivado en Catálogos de Finanzas.`,
        details: [check.label],
      };
    }
  }

  const [items] = await conn.query(
    `
    SELECT
      li.id,
      li.product_name,
      COALESCE(li.quantity, 0) AS quantity,
      qs.provider_id,
      qs.selected_unit_price
    FROM line_items li
    LEFT JOIN quotation_selections qs
      ON qs.requisition_id = li.requisition_id
     AND qs.line_item_id = li.id
    WHERE li.requisition_id = ?
    ORDER BY li.id ASC
    `,
    [reqId]
  );

  if (!Array.isArray(items) || items.length === 0) {
    return {
      message: "No se puede aprobar: la requisición no tiene artículos para validar.",
      details: ["artículos"],
    };
  }

  const itemIssues = [];
  items.forEach((item) => {
    const label = cleanText(item.product_name) || `artículo #${item.id}`;
    const quantity = Number(item.quantity || 0);
    const price = Number(item.selected_unit_price || 0);
    const providerId = parsePositiveId(item.provider_id);

    if (quantity <= 0) itemIssues.push(`${label}: cantidad inválida`);
    if (!providerId) itemIssues.push(`${label}: proveedor no seleccionado`);
    if (!(price > 0)) itemIssues.push(`${label}: precio seleccionado inválido`);
  });

  if (itemIssues.length > 0) {
    return {
      message: `No se puede aprobar: ${itemIssues.join("; ")}.`,
      details: itemIssues,
    };
  }

  const selectedTotal = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.selected_unit_price || 0),
    0
  );
  if (!(selectedTotal > 0)) {
    return {
      message: "No se puede aprobar: el monto seleccionado debe ser mayor a $0.00.",
      details: ["monto"],
    };
  }

  return null;
};

const getFinanceStatusTimeline = async (reqId) => {
  const rows = await getRequisitionStatusTimeline(reqId);
  return rows
    .filter((row) => {
      const fromStatus = Number(row.from_status_id || 0);
      const toStatus = Number(row.to_status_id || 0);
      return (
        fromStatus === FINANZAS_STATUS ||
        [FINANZAS_STATUS, FINANZAS_APPROVED_STATUS, FINANZAS_REJECTED_STATUS, COMPRA_STATUS].includes(toStatus)
      );
    })
    .map((row) => {
      const fromStatus = Number(row.from_status_id || 0);
      const toStatus = Number(row.to_status_id || 0);
      let finance_event = "movimiento";
      if (toStatus === FINANZAS_STATUS) finance_event = "recibida";
      if (fromStatus === FINANZAS_STATUS && toStatus === FINANZAS_APPROVED_STATUS) finance_event = "aprobada";
      if (fromStatus === FINANZAS_STATUS && toStatus === COMPRA_STATUS) finance_event = "devuelta";
      if (fromStatus === FINANZAS_STATUS && toStatus === FINANZAS_REJECTED_STATUS) finance_event = "rechazada";

      return {
        ...row,
        finance_event,
      };
    });
};

export const getFinanceCatalogOptions = async (_req, res) => {
  try {
    await ensureFinanceCatalogSchema();
    const [rows] = await pool.query(
      `
      SELECT id, catalog_type, code, name, fiscal_year, budget_amount, description
      FROM finance_catalog_entries
      WHERE is_active = 1
      ORDER BY catalog_type ASC, COALESCE(fiscal_year, 9999) ASC, name ASC
      `
    );

    res.json({
      project: rows.filter((row) => row.catalog_type === "project"),
      fund: rows.filter((row) => row.catalog_type === "fund"),
      program: rows.filter((row) => row.catalog_type === "program"),
    });
  } catch (error) {
    console.error("Error getFinanceCatalogOptions:", error);
    res.status(500).json({ message: "Error al obtener opciones financieras" });
  }
};

export const listFinanceCatalogEntries = async (req, res) => {
  try {
    if (!isFinanceAdminRole(req.user?.role)) {
      return res.status(403).json({ message: "Solo Finanzas Admin puede administrar catálogos" });
    }
    await ensureFinanceCatalogSchema();
    await ensureFinanceWorkflowSchema();
    const type = parseCatalogType(req.query.type || "project") || "project";
    const includeInactive = String(req.query.include_inactive || "1") === "1";
    const q = cleanText(req.query.q).toLowerCase();

    const params = [type];
    const where = ["f.catalog_type = ?"];
    if (!includeInactive) where.push("f.is_active = 1");
    if (q) {
      where.push(
        "(LOWER(f.name) LIKE ? OR LOWER(COALESCE(f.code, '')) LIKE ? OR LOWER(COALESCE(f.description, '')) LIKE ?)"
      );
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    const [rows] = await pool.query(
      `
      SELECT
        f.id,
        f.catalog_type,
        f.code,
        f.name,
        f.fiscal_year,
        f.budget_amount,
        f.description,
        f.is_active,
        f.created_at,
        f.updated_at,
        COUNT(DISTINCT fr.requisition_id) AS usage_count,
        MAX(fr.reviewed_at) AS last_used_at
      FROM finance_catalog_entries f
      LEFT JOIN requisition_finance_review fr
        ON (f.catalog_type = 'project' AND fr.project = f.name)
        OR (f.catalog_type = 'fund' AND fr.fund = f.name)
        OR (f.catalog_type = 'program' AND fr.strategic_program = f.name)
      WHERE ${where.join(" AND ")}
      GROUP BY
        f.id,
        f.catalog_type,
        f.code,
        f.name,
        f.fiscal_year,
        f.budget_amount,
        f.description,
        f.is_active,
        f.created_at,
        f.updated_at
      ORDER BY f.is_active DESC, COALESCE(f.fiscal_year, 9999) ASC, f.name ASC
      `,
      params
    );
    res.json(rows);
  } catch (error) {
    console.error("Error listFinanceCatalogEntries:", error);
    res.status(500).json({ message: "Error al listar catálogo financiero" });
  }
};

export const createFinanceCatalogEntry = async (req, res) => {
  try {
    if (!isFinanceAdminRole(req.user?.role)) {
      return res.status(403).json({ message: "Solo Finanzas Admin puede crear catálogos" });
    }
    await ensureFinanceCatalogSchema();
    const type = parseCatalogType(req.body?.catalog_type);
    const name = cleanText(req.body?.name);
    if (!type) return res.status(400).json({ message: "Tipo de catálogo inválido" });
    if (!name) return res.status(400).json({ message: "Nombre requerido" });

    const [result] = await pool.query(
      `
      INSERT INTO finance_catalog_entries
        (catalog_type, code, name, fiscal_year, budget_amount, description, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        type,
        cleanNullableText(req.body?.code),
        name,
        parseOptionalYear(req.body?.fiscal_year),
        parseOptionalAmount(req.body?.budget_amount),
        cleanNullableText(req.body?.description),
        req.body?.is_active === false ? 0 : 1,
      ]
    );
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (error) {
    console.error("Error createFinanceCatalogEntry:", error);
    const mapped = mapDuplicateCatalogError(error);
    res.status(mapped.status).json({ message: mapped.message });
  }
};

export const updateFinanceCatalogEntry = async (req, res) => {
  try {
    if (!isFinanceAdminRole(req.user?.role)) {
      return res.status(403).json({ message: "Solo Finanzas Admin puede editar catálogos" });
    }
    await ensureFinanceCatalogSchema();
    const id = parsePositiveId(req.params.id);
    const type = parseCatalogType(req.body?.catalog_type);
    const name = cleanText(req.body?.name);
    if (!id) return res.status(400).json({ message: "ID inválido" });
    if (!type) return res.status(400).json({ message: "Tipo de catálogo inválido" });
    if (!name) return res.status(400).json({ message: "Nombre requerido" });

    const [result] = await pool.query(
      `
      UPDATE finance_catalog_entries
      SET catalog_type = ?,
          code = ?,
          name = ?,
          fiscal_year = ?,
          budget_amount = ?,
          description = ?,
          is_active = ?
      WHERE id = ?
      `,
      [
        type,
        cleanNullableText(req.body?.code),
        name,
        parseOptionalYear(req.body?.fiscal_year),
        parseOptionalAmount(req.body?.budget_amount),
        cleanNullableText(req.body?.description),
        req.body?.is_active === false || Number(req.body?.is_active) === 0 ? 0 : 1,
        id,
      ]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Registro no encontrado" });
    res.json({ ok: true });
  } catch (error) {
    console.error("Error updateFinanceCatalogEntry:", error);
    const mapped = mapDuplicateCatalogError(error);
    res.status(mapped.status).json({ message: mapped.message });
  }
};

export const updateFinanceCatalogEntryStatus = async (req, res) => {
  try {
    if (!isFinanceAdminRole(req.user?.role)) {
      return res.status(403).json({ message: "Solo Finanzas Admin puede cambiar catálogos" });
    }
    await ensureFinanceCatalogSchema();
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido" });
    const isActive = Number(req.body?.is_active) === 1 || req.body?.is_active === true ? 1 : 0;

    const [result] = await pool.query(
      `UPDATE finance_catalog_entries SET is_active = ? WHERE id = ?`,
      [isActive, id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Registro no encontrado" });
    res.json({ ok: true });
  } catch (error) {
    console.error("Error updateFinanceCatalogEntryStatus:", error);
    res.status(500).json({ message: "Error al actualizar estatus del catálogo" });
  }
};

export const listFinanzasPersonal = async (req, res) => {
  try {
    if (!isFinanceAdminRole(req.user?.role)) {
      return res.status(403).json({ message: "Solo Finanzas Admin puede ver personal" });
    }
    const [rows] = await pool.query(
      `
      SELECT id, name, user_name, ure, statuses_id, email, role
      FROM users
      WHERE role IN ('finanzas', 'finanzas_admin', 'finanzas_analista', 'finanzas_lector')
      ORDER BY statuses_id ASC, id DESC
      `
    );
    res.json(rows);
  } catch (error) {
    console.error("Error listFinanzasPersonal:", error);
    res.status(500).json({ message: "Error al listar personal de Finanzas" });
  }
};

export const createFinanzasPersonal = async (req, res) => {
  try {
    if (!isFinanceAdminRole(req.user?.role)) {
      return res.status(403).json({ message: "Solo Finanzas Admin puede crear personal" });
    }
    const name = cleanText(req.body?.name);
    const userName = cleanText(req.body?.user_name);
    const email = cleanNullableText(req.body?.email);
    const role = ["finanzas_admin", "finanzas_analista", "finanzas_lector"].includes(req.body?.role)
      ? req.body.role
      : "finanzas_analista";
    const nextPassword = req.body?.password || DEFAULT_PASSWORD;

    if (!name || !userName) return res.status(400).json({ message: "Nombre y usuario son requeridos" });
    if (!nextPassword) {
      return res.status(400).json({ message: "Debes proporcionar password o configurar DEFAULT_USER_PASSWORD" });
    }

    const [exists] = await pool.query(`SELECT 1 FROM users WHERE user_name = ? LIMIT 1`, [userName]);
    if (exists.length > 0) return res.status(409).json({ message: "El usuario ya existe" });

    const [result] = await pool.query(
      `
      INSERT INTO users (name, user_name, ure, statuses_id, email, password, role)
      VALUES (?, ?, NULL, 1, ?, ?, ?)
      `,
      [name, userName, email, await bcrypt.hash(String(nextPassword), 10), role]
    );
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (error) {
    console.error("Error createFinanzasPersonal:", error);
    res.status(500).json({ message: "Error al crear personal de Finanzas" });
  }
};

export const updateFinanzasPersonal = async (req, res) => {
  try {
    if (!isFinanceAdminRole(req.user?.role)) {
      return res.status(403).json({ message: "Solo Finanzas Admin puede editar personal" });
    }
    const id = parsePositiveId(req.params.id);
    const name = cleanText(req.body?.name);
    const userName = cleanText(req.body?.user_name);
    const email = cleanNullableText(req.body?.email);
    const role = ["finanzas_admin", "finanzas_analista", "finanzas_lector"].includes(req.body?.role)
      ? req.body.role
      : "finanzas_analista";

    if (!id) return res.status(400).json({ message: "ID inválido" });
    if (!name || !userName) return res.status(400).json({ message: "Nombre y usuario son requeridos" });

    const [target] = await pool.query(`SELECT role FROM users WHERE id = ? LIMIT 1`, [id]);
    if (target.length === 0) return res.status(404).json({ message: "Usuario no encontrado" });
    if (!isFinanceRole(target[0].role)) return res.status(403).json({ message: "Solo puedes editar personal de Finanzas" });
    if (id === Number(req.user?.id || 0) && role !== "finanzas_admin") {
      return res.status(400).json({ message: "No puedes quitarte permisos de administrador a ti mismo" });
    }

    const [exists] = await pool.query(`SELECT 1 FROM users WHERE user_name = ? AND id != ? LIMIT 1`, [userName, id]);
    if (exists.length > 0) return res.status(409).json({ message: "El usuario ya existe" });

    const nextPassword = cleanText(req.body?.password);
    const passwordSql = nextPassword ? ", password = ?" : "";
    const passwordHash = nextPassword ? await bcrypt.hash(nextPassword, 10) : null;

    const [result] = await pool.query(
      `
      UPDATE users
      SET name = ?, user_name = ?, ure = NULL, email = ?, role = ?${passwordSql}
      WHERE id = ? AND role IN ('finanzas', 'finanzas_admin', 'finanzas_analista', 'finanzas_lector')
      `,
      nextPassword
        ? [name, userName, email, role, passwordHash, id]
        : [name, userName, email, role, id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Usuario no encontrado" });
    res.json({ ok: true });
  } catch (error) {
    console.error("Error updateFinanzasPersonal:", error);
    res.status(500).json({ message: "Error al actualizar personal de Finanzas" });
  }
};

export const updateFinanzasPersonalStatus = async (req, res) => {
  try {
    if (!isFinanceAdminRole(req.user?.role)) {
      return res.status(403).json({ message: "Solo Finanzas Admin puede cambiar estatus de personal" });
    }
    const id = parsePositiveId(req.params.id);
    const statusesId = Number(req.body?.statuses_id);
    if (!id) return res.status(400).json({ message: "ID inválido" });
    if (![1, 2].includes(statusesId)) return res.status(400).json({ message: "Estatus inválido" });
    if (id === Number(req.user?.id || 0) && statusesId !== 1) {
      return res.status(400).json({ message: "No puedes desactivar tu propio usuario" });
    }

    const [result] = await pool.query(
      `UPDATE users SET statuses_id = ? WHERE id = ? AND role IN ('finanzas', 'finanzas_admin', 'finanzas_analista', 'finanzas_lector')`,
      [statusesId, id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Usuario no encontrado" });
    res.json({ ok: true });
  } catch (error) {
    console.error("Error updateFinanzasPersonalStatus:", error);
    res.status(500).json({ message: "Error al actualizar estatus de personal de Finanzas" });
  }
};

export const resetFinanzasPersonalPassword = async (req, res) => {
  try {
    if (!isFinanceAdminRole(req.user?.role)) {
      return res.status(403).json({ message: "Solo Finanzas Admin puede restablecer contraseñas" });
    }
    const id = parsePositiveId(req.params.id);
    const nextPassword = req.body?.password || DEFAULT_PASSWORD;
    if (!id) return res.status(400).json({ message: "ID inválido" });
    if (!nextPassword) {
      return res.status(400).json({ message: "Debes proporcionar password o configurar DEFAULT_USER_PASSWORD" });
    }

    const [result] = await pool.query(
      `UPDATE users SET password = ? WHERE id = ? AND role IN ('finanzas', 'finanzas_admin', 'finanzas_analista', 'finanzas_lector')`,
      [await bcrypt.hash(String(nextPassword), 10), id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Usuario no encontrado" });
    res.json({ ok: true });
  } catch (error) {
    console.error("Error resetFinanzasPersonalPassword:", error);
    res.status(500).json({ message: "Error al resetear contraseña de Finanzas" });
  }
};

export const getFinanzasRecibidas = async (req, res) => {
  try {
    await ensureFinanceWorkflowSchema();
    await ensureStatusHistoryTable();
    const [rows] = await pool.query(
      `
      SELECT
        r.id,
        r.folio,
        r.area_folio,
        r.request_name,
        r.justification,
        r.observation,
        r.notes,
        r.statuses_id,
        r.created_at,
        r.sent_on,
        finance_entry.entered_finanzas_at,
        s.name AS nombre_estatus,
        u.name AS solicitante,
        u.ure AS solicitante_ure,
        fr.project,
        fr.fund,
        fr.strategic_program,
        fr.budget_available,
        fr.finance_observation,
        COALESCE(SUM(COALESCE(li.quantity, 0) * COALESCE(qs.selected_unit_price, 0)), 0) AS selected_total
      FROM requisition r
      JOIN users u ON u.id = r.users_id
      JOIN statuses s ON s.id = r.statuses_id
      LEFT JOIN (
        SELECT requisition_id, MAX(changed_at) AS entered_finanzas_at
        FROM requisition_status_history
        WHERE to_status_id = ?
        GROUP BY requisition_id
      ) finance_entry ON finance_entry.requisition_id = r.id
      LEFT JOIN requisition_finance_review fr ON fr.requisition_id = r.id
      LEFT JOIN line_items li ON li.requisition_id = r.id
      LEFT JOIN quotation_selections qs
        ON qs.requisition_id = r.id
       AND qs.line_item_id = li.id
      WHERE r.statuses_id = ?
      GROUP BY
        r.id,
        r.folio,
        r.area_folio,
        r.request_name,
        r.justification,
        r.observation,
        r.notes,
        r.statuses_id,
        r.created_at,
        r.sent_on,
        finance_entry.entered_finanzas_at,
        s.name,
        u.name,
        u.ure,
        fr.project,
        fr.fund,
        fr.strategic_program,
        fr.budget_available,
        fr.finance_observation
      ORDER BY COALESCE(finance_entry.entered_finanzas_at, r.sent_on, r.created_at) DESC, r.id DESC
      `,
      [FINANZAS_STATUS, FINANZAS_STATUS]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error getFinanzasRecibidas:", error);
    res.status(500).json({ message: "Error al obtener requisiciones de Finanzas" });
  }
};

export const getFinanzasHistorial = async (req, res) => {
  try {
    const rows = await getFinanzasHistorialRows();
    res.json(rows);
  } catch (error) {
    console.error("Error getFinanzasHistorial:", error);
    res.status(500).json({ message: "Error al obtener historial de Finanzas" });
  }
};

export const downloadFinanzasHistorialExcel = async (req, res) => {
  try {
    const ExcelJSModule = await import("exceljs");
    const ExcelJS = ExcelJSModule.default || ExcelJSModule;
    const rows = filterFinanzasHistorialRows(await getFinanzasHistorialRows(), req.query);
    const resultLabel = {
      aprobada: "Aprobada",
      devuelta: "Devuelta",
      rechazada: "Rechazada",
      revisada: "Revisada",
    };
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SIMCO Finanzas";
    workbook.created = new Date();
    workbook.modified = new Date();

    const titleFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8B1D35" } };
    const softFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F2F4" } };
    const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    const border = { style: "thin", color: { argb: "FFE5E7EB" } };
    const currencyFormat = '"$"#,##0.00;[Red]-"$"#,##0.00';

    const styleHeaderRow = (row) => {
      row.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FF111827" } };
        cell.fill = headerFill;
        cell.border = { top: border, left: border, bottom: border, right: border };
        cell.alignment = { vertical: "middle" };
      });
    };

    const addTitle = (sheet, title, subtitle) => {
      sheet.mergeCells("A1:F1");
      sheet.getCell("A1").value = title;
      sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
      sheet.getCell("A1").fill = titleFill;
      sheet.getCell("A1").alignment = { vertical: "middle" };
      sheet.getRow(1).height = 26;
      sheet.mergeCells("A2:F2");
      sheet.getCell("A2").value = subtitle;
      sheet.getCell("A2").font = { color: { argb: "FF4B5563" } };
      sheet.getCell("A2").fill = softFill;
    };

    const summary = {
      total: rows.length,
      amount: rows.reduce((acc, row) => acc + moneyNumber(row.selected_total), 0),
      aprobada: rows.filter((row) => row.finance_result === "aprobada").length,
      devuelta: rows.filter((row) => row.finance_result === "devuelta").length,
      rechazada: rows.filter((row) => row.finance_result === "rechazada").length,
    };

    const filters = [
      ["Resultado", cleanText(req.query.result || "all") === "all" ? "Todos" : resultLabel[req.query.result] || req.query.result],
      ["Mes", cleanText(req.query.month || "all") === "all" ? "Todos" : req.query.month],
      ["Proyecto", cleanText(req.query.project || "all") === "all" ? "Todos" : req.query.project],
      ["Fondo", cleanText(req.query.fund || "all") === "all" ? "Todos" : req.query.fund],
      ["Programa", cleanText(req.query.program || "all") === "all" ? "Todos" : req.query.program],
      ["Busqueda", cleanText(req.query.query) || "Sin busqueda"],
      ["Solo con observacion", String(req.query.onlyWithObservation || "") === "true" ? "Si" : "No"],
    ];

    const summarySheet = workbook.addWorksheet("Resumen");
    addTitle(summarySheet, "Historial de Finanzas", "Resumen del historial exportado con filtros aplicados.");
    summarySheet.addRow([]);
    summarySheet.addRow(["Indicador", "Valor"]);
    styleHeaderRow(summarySheet.getRow(4));
    [
      ["Revisiones", summary.total],
      ["Monto total", summary.amount],
      ["Aprobadas", summary.aprobada],
      ["Devueltas", summary.devuelta],
      ["Rechazadas", summary.rechazada],
      ["Generado", new Date()],
    ].forEach((item) => summarySheet.addRow(item));
    summarySheet.getCell("B6").numFmt = currencyFormat;
    summarySheet.getCell("B10").numFmt = "dd/mm/yyyy hh:mm";
    summarySheet.addRow([]);
    summarySheet.addRow(["Filtros aplicados", ""]);
    styleHeaderRow(summarySheet.getRow(12));
    filters.forEach((item) => summarySheet.addRow(item));
    summarySheet.columns = [{ width: 26 }, { width: 42 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];

    const makeDistribution = (field, fallback) => {
      const map = new Map();
      rows.forEach((row) => {
        const key = cleanText(row[field]) || fallback;
        const current = map.get(key) || { label: key, count: 0, amount: 0 };
        current.count += 1;
        current.amount += moneyNumber(row.selected_total);
        map.set(key, current);
      });
      return [...map.values()].sort((a, b) => b.amount - a.amount);
    };

    const distributionSheet = workbook.addWorksheet("Distribucion");
    addTitle(distributionSheet, "Distribucion del resultado", "Montos agrupados por proyecto, fondo y programa.");
    let rowIndex = 4;
    [
      ["Proyectos", makeDistribution("project", "Sin proyecto")],
      ["Fondos", makeDistribution("fund", "Sin fondo")],
      ["Programas", makeDistribution("strategic_program", "Sin programa")],
    ].forEach(([title, items]) => {
      distributionSheet.getCell(`A${rowIndex}`).value = title;
      distributionSheet.getCell(`A${rowIndex}`).font = { bold: true, color: { argb: "FF8B1D35" } };
      rowIndex += 1;
      distributionSheet.getRow(rowIndex).values = ["Nombre", "Revisiones", "Monto"];
      styleHeaderRow(distributionSheet.getRow(rowIndex));
      rowIndex += 1;
      if (items.length === 0) {
        distributionSheet.getRow(rowIndex).values = ["Sin datos", 0, 0];
        rowIndex += 1;
      } else {
        items.forEach((item) => {
          distributionSheet.getRow(rowIndex).values = [item.label, item.count, item.amount];
          distributionSheet.getCell(`C${rowIndex}`).numFmt = currencyFormat;
          rowIndex += 1;
        });
      }
      rowIndex += 2;
    });
    distributionSheet.columns = [{ width: 42 }, { width: 14 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 16 }];

    const detailSheet = workbook.addWorksheet("Detalle");
    detailSheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Resultado", key: "finance_result", width: 16 },
      { header: "Requisicion", key: "request_name", width: 34 },
      { header: "Solicitante", key: "solicitante", width: 28 },
      { header: "URE", key: "solicitante_ure", width: 28 },
      { header: "Proyecto", key: "project", width: 26 },
      { header: "Fondo", key: "fund", width: 20 },
      { header: "Programa", key: "strategic_program", width: 26 },
      { header: "Monto", key: "selected_total", width: 16 },
      { header: "Reviso", key: "revisado_por", width: 24 },
      { header: "Fecha revision", key: "reviewed_at", width: 20 },
      { header: "Observacion", key: "finance_observation", width: 44 },
    ];
    styleHeaderRow(detailSheet.getRow(1));
    rows.forEach((row) => {
      detailSheet.addRow({
        id: row.id,
        finance_result: resultLabel[row.finance_result] || "Revisada",
        request_name: row.request_name || "Sin nombre",
        solicitante: row.solicitante || "",
        solicitante_ure: row.solicitante_ure || "",
        project: row.project || "",
        fund: row.fund || "",
        strategic_program: row.strategic_program || "",
        selected_total: moneyNumber(row.selected_total),
        revisado_por: row.revisado_por || "Finanzas",
        reviewed_at: row.reviewed_at ? new Date(row.reviewed_at) : null,
        finance_observation: row.finance_observation || "",
      });
    });
    detailSheet.getColumn("selected_total").numFmt = currencyFormat;
    detailSheet.getColumn("reviewed_at").numFmt = "dd/mm/yyyy hh:mm";
    detailSheet.views = [{ state: "frozen", ySplit: 1 }];

    workbook.eachSheet((sheet) => {
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = cell.border || { top: border, left: border, bottom: border, right: border };
          cell.alignment = { vertical: "middle", wrapText: true };
        });
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `historial_finanzas_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Error downloadFinanzasHistorialExcel:", error);
    res.status(500).json({ message: "Error al generar Excel de Finanzas" });
  }
};

export const getFinanzasDetalle = async (req, res) => {
  try {
    await ensureFinanceWorkflowSchema();
    await ensureStatusHistoryTable();
    const reqId = parsePositiveId(req.params.id);
    if (!reqId) return res.status(400).json({ message: "ID inválido" });

    const [[requisition]] = await pool.query(
      `
      SELECT
        r.*,
        s.name AS nombre_estatus,
        u.name AS solicitante,
        u.ure AS solicitante_ure,
        fr.project,
        fr.fund,
        fr.strategic_program,
        fr.budget_available,
        fr.finance_observation,
        fr.reviewed_by,
        fr.reviewed_at,
        reviewer.name AS revisado_por,
        CASE
          WHEN r.statuses_id IN (?, 11) THEN 'aprobada'
          WHEN r.statuses_id = ? THEN 'rechazada'
          WHEN r.statuses_id = ? THEN 'devuelta'
          WHEN r.statuses_id = ? THEN 'pendiente'
          ELSE 'revisada'
        END AS finance_result
      FROM requisition r
      JOIN users u ON u.id = r.users_id
      JOIN statuses s ON s.id = r.statuses_id
      LEFT JOIN requisition_finance_review fr ON fr.requisition_id = r.id
      LEFT JOIN users reviewer ON reviewer.id = fr.reviewed_by
      WHERE r.id = ?
      LIMIT 1
      `,
      [FINANZAS_APPROVED_STATUS, FINANZAS_REJECTED_STATUS, COMPRA_STATUS, FINANZAS_STATUS, reqId]
    );

    if (!requisition) return res.status(404).json({ message: "Requisición no encontrada" });

    const withSelectionTaxes = await hasSelectionTaxColumns();
    const selectedVatExpr = withSelectionTaxes ? "qs.selected_vat_percentage" : "0";
    const selectedIsrExpr = withSelectionTaxes ? "qs.selected_isr_percentage" : "0";

    const [items] = await pool.query(
      `
      SELECT
        li.id,
        li.product_name,
        li.description,
        li.quantity,
        un.name AS unit,
        qs.provider_id,
        p.name AS provider_name,
        qs.selected_unit_price,
        ${selectedVatExpr} AS selected_vat_percentage,
        ${selectedIsrExpr} AS selected_isr_percentage,
        qs.selected_description,
        (COALESCE(li.quantity, 0) * COALESCE(qs.selected_unit_price, 0)) AS selected_subtotal,
        (
          COALESCE(li.quantity, 0)
          * COALESCE(qs.selected_unit_price, 0)
          * COALESCE(${selectedVatExpr}, 0)
          / 100
        ) AS selected_vat_amount,
        (
          COALESCE(li.quantity, 0)
          * COALESCE(qs.selected_unit_price, 0)
          * COALESCE(${selectedIsrExpr}, 0)
          / 100
        ) AS selected_isr_amount,
        (
          (COALESCE(li.quantity, 0) * COALESCE(qs.selected_unit_price, 0))
          + (
            COALESCE(li.quantity, 0)
            * COALESCE(qs.selected_unit_price, 0)
            * COALESCE(${selectedVatExpr}, 0)
            / 100
          )
          - (
            COALESCE(li.quantity, 0)
            * COALESCE(qs.selected_unit_price, 0)
            * COALESCE(${selectedIsrExpr}, 0)
            / 100
          )
        ) AS selected_total
      FROM line_items li
      LEFT JOIN units un ON un.id = li.units_id
      LEFT JOIN quotation_selections qs
        ON qs.requisition_id = li.requisition_id
       AND qs.line_item_id = li.id
      LEFT JOIN provider p ON p.id = qs.provider_id
      WHERE li.requisition_id = ?
      ORDER BY li.id ASC
      `,
      [reqId]
    );

    const financeTimeline = await getFinanceStatusTimeline(reqId);

    res.json({ requisition, items, finance_timeline: financeTimeline });
  } catch (error) {
    console.error("Error getFinanzasDetalle:", error);
    res.status(500).json({ message: "Error al obtener detalle de Finanzas" });
  }
};

export const resolveFinanzasRevision = async (req, res) => {
  let conn;
  try {
    if (!isFinanceReviewRole(req.user?.role)) {
      return res.status(403).json({ message: "Tu perfil de Finanzas es solo lectura" });
    }
    const reqId = parsePositiveId(req.params.id);
    const action = cleanText(req.body?.action);
    const comment = cleanText(req.body?.comment || req.body?.comentarios);
    const project = cleanText(req.body?.project);
    const fund = cleanText(req.body?.fund);
    const strategicProgram = cleanText(req.body?.strategic_program);
    const budgetAvailable = Boolean(req.body?.budget_available);
    const actorId = parsePositiveId(req.user?.id) || null;

    if (!reqId) return res.status(400).json({ message: "ID inválido" });
    if (!["aprobar", "devolver_a_compras", "rechazar"].includes(action)) {
      return res.status(400).json({ message: "Acción financiera no permitida" });
    }

    if (action === "aprobar" && (!project || !fund || !strategicProgram || !budgetAvailable)) {
      return res.status(400).json({
        message: "Proyecto, fondo, programa estratégico y presupuesto disponible son obligatorios para aprobar",
      });
    }
    if ((action === "devolver_a_compras" || action === "rechazar") && !comment) {
      return res.status(400).json({ message: "Comentario obligatorio para devolver o rechazar" });
    }

    await ensureFinanceWorkflowSchema();
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [[current]] = await conn.query(
      `SELECT id, statuses_id, users_id, assigned_operator_id FROM requisition WHERE id = ? FOR UPDATE`,
      [reqId]
    );
    if (!current) {
      await conn.rollback();
      return res.status(404).json({ message: "Requisición no encontrada" });
    }

    const currentStatusId = Number(current.statuses_id || 0);
    if (currentStatusId !== FINANZAS_STATUS) {
      await conn.rollback();
      return res.status(400).json({
        message: "La requisición no está en revisión de Finanzas",
        current_status: currentStatusId,
      });
    }

    if (action === "aprobar") {
      const approvalError = await getApprovalValidationError(conn, reqId, {
        project,
        fund,
        strategicProgram,
        budgetAvailable,
      });
      if (approvalError) {
        await conn.rollback();
        return res.status(400).json(approvalError);
      }
    }

    const nextStatusId =
      action === "aprobar"
        ? FINANZAS_APPROVED_STATUS
        : action === "devolver_a_compras"
          ? COMPRA_STATUS
          : FINANZAS_REJECTED_STATUS;

    await conn.query(
      `
      INSERT INTO requisition_finance_review
        (requisition_id, project, fund, strategic_program, budget_available, finance_observation, reviewed_by, reviewed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        project = VALUES(project),
        fund = VALUES(fund),
        strategic_program = VALUES(strategic_program),
        budget_available = VALUES(budget_available),
        finance_observation = VALUES(finance_observation),
        reviewed_by = VALUES(reviewed_by),
        reviewed_at = NOW()
      `,
      [
        reqId,
        project || null,
        fund || null,
        strategicProgram || null,
        budgetAvailable ? 1 : 0,
        comment || null,
        actorId,
      ]
    );

    await conn.query(`UPDATE requisition SET statuses_id = ?, notes = ? WHERE id = ?`, [
      nextStatusId,
      comment || null,
      reqId,
    ]);

    await logRequisitionStatusChange(
      {
        requisitionId: reqId,
        fromStatusId: currentStatusId,
        toStatusId: nextStatusId,
        changedBy: actorId,
        note: comment || (action === "aprobar" ? "Aprobada por Finanzas" : null),
      },
      conn
    );

    await conn.commit();

    const titleByAction = {
      aprobar: "Requisición aprobada por Finanzas",
      devolver_a_compras: "Requisición devuelta por Finanzas",
      rechazar: "Requisición rechazada por Finanzas",
    };
    const messageByAction = {
      aprobar: `La requisición #${reqId} fue aprobada por Finanzas y puede continuar a cierre.`,
      devolver_a_compras: `La requisición #${reqId} fue devuelta a Compras por Finanzas.`,
      rechazar: `La requisición #${reqId} fue rechazada por Finanzas.`,
    };

    const comprasIds = await getUsersByRole("compras_admin");
    const operatorId = parsePositiveId(current.assigned_operator_id);
    const comprasRecipients = operatorId ? [...comprasIds, operatorId] : comprasIds;
    await createNotificationsForUsers(comprasRecipients, {
      actorUserId: actorId,
      title: titleByAction[action],
      message: messageByAction[action],
      entityType: "requisition",
      entityId: reqId,
      actionPath: "/compras/dashboard",
    });

    if (action === "rechazar") {
      const ownerId = parsePositiveId(current.users_id);
      if (ownerId) {
        await createNotification({
          recipientUserId: ownerId,
          actorUserId: actorId,
          title: "Requisición rechazada por Finanzas",
          message: `La requisición #${reqId} fue rechazada por Finanzas. Revisa el motivo en el detalle.`,
          entityType: "requisition",
          entityId: reqId,
          actionPath: `/unidad/mi-requisiciones?openReq=${reqId}`,
        });
      }

      const coordinatorIds = await getCoordinatorUsersForRequisition(reqId);
      await createNotificationsForUsers(coordinatorIds, {
        actorUserId: actorId,
        title: "Requisición rechazada por Finanzas",
        message: `La requisición #${reqId} fue rechazada por Finanzas.`,
        entityType: "requisition",
        entityId: reqId,
        actionPath: `/coordinador/requisiciones?openReq=${reqId}`,
      });

      const secretariaIds = await getSecretariaUsersForRequisition(reqId);
      await createNotificationsForUsers(secretariaIds, {
        actorUserId: actorId,
        title: "Requisición rechazada por Finanzas",
        message: `La requisición #${reqId} fue rechazada por Finanzas.`,
        entityType: "requisition",
        entityId: reqId,
        actionPath: `/secretaria/recibidas?openReq=${reqId}`,
      });
    }

    res.json({
      message: "Revisión financiera actualizada correctamente",
      statuses_id: nextStatusId,
    });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        // rollback best-effort
      }
    }
    console.error("Error resolveFinanzasRevision:", error);
    res.status(500).json({ message: "Error al resolver revisión financiera" });
  } finally {
    if (conn) conn.release();
  }
};
