import { pool } from "../db/connection.js";
import {
  createNotification,
  createNotificationsForUsers,
  getCoordinatorUsersForRequisition,
  getSecretariaUsersForRequisition,
  getUsersByRole,
} from "../services/notifications.js";
import { logRequisitionStatusChange } from "../services/statusHistory.js";

const FINANZAS_STATUS = 15;
const FINANZAS_APPROVED_STATUS = 16;
const FINANZAS_REJECTED_STATUS = 17;
const COMPRA_STATUS = 13;

const cleanText = (value) => String(value || "").trim();
const parsePositiveId = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

let ensureFinanceWorkflowSchemaPromise = null;

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

export const getFinanzasRecibidas = async (req, res) => {
  try {
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
        fr.project,
        fr.fund,
        fr.strategic_program,
        fr.budget_available,
        fr.finance_observation,
        COALESCE(SUM(COALESCE(li.quantity, 0) * COALESCE(qs.selected_unit_price, 0)), 0) AS selected_total
      FROM requisition r
      JOIN users u ON u.id = r.users_id
      JOIN statuses s ON s.id = r.statuses_id
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
        s.name,
        u.name,
        u.ure,
        fr.project,
        fr.fund,
        fr.strategic_program,
        fr.budget_available,
        fr.finance_observation
      ORDER BY COALESCE(r.sent_on, r.created_at) DESC, r.id DESC
      `,
      [FINANZAS_STATUS]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error getFinanzasRecibidas:", error);
    res.status(500).json({ message: "Error al obtener requisiciones de Finanzas" });
  }
};

export const getFinanzasHistorial = async (req, res) => {
  try {
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

    res.json(rows);
  } catch (error) {
    console.error("Error getFinanzasHistorial:", error);
    res.status(500).json({ message: "Error al obtener historial de Finanzas" });
  }
};

export const getFinanzasDetalle = async (req, res) => {
  try {
    await ensureFinanceWorkflowSchema();
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
        fr.reviewed_at
      FROM requisition r
      JOIN users u ON u.id = r.users_id
      JOIN statuses s ON s.id = r.statuses_id
      LEFT JOIN requisition_finance_review fr ON fr.requisition_id = r.id
      WHERE r.id = ?
      LIMIT 1
      `,
      [reqId]
    );

    if (!requisition) return res.status(404).json({ message: "Requisición no encontrada" });

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
        qs.selected_description,
        (COALESCE(li.quantity, 0) * COALESCE(qs.selected_unit_price, 0)) AS selected_total
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

    res.json({ requisition, items });
  } catch (error) {
    console.error("Error getFinanzasDetalle:", error);
    res.status(500).json({ message: "Error al obtener detalle de Finanzas" });
  }
};

export const resolveFinanzasRevision = async (req, res) => {
  let conn;
  try {
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
