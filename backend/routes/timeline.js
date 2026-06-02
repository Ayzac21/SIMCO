import express from "express";
import { pool } from "../db/connection.js";
import { getRequisitionStatusTimeline } from "../services/statusHistory.js";
import { getRequisitionAssignmentTimeline } from "../services/assignmentHistory.js";

const router = express.Router();

const parseUserId = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

const isFinanceRole = (role) =>
  ["finanzas", "finanzas_admin", "finanzas_analista", "finanzas_lector"].includes(String(role || ""));

const buildLegacyMilestones = async (requisitionId) => {
  const [[reqRow]] = await pool.query(
    `
    SELECT id, created_at, sent_on, quotation_closed_at, statuses_id
    FROM requisition
    WHERE id = ?
    LIMIT 1
    `,
    [requisitionId]
  );
  if (!reqRow) return [];

  const [[agg]] = await pool.query(
    `
    SELECT
      MIN(qp.created_at) AS first_quote_at,
      MAX(qs.updated_at) AS selection_completed_at,
      MAX(ocm.updated_at) AS order_meta_updated_at
    FROM requisition r
    LEFT JOIN quotation_prices qp ON qp.requisition_id = r.id
    LEFT JOIN quotation_selections qs ON qs.requisition_id = r.id
    LEFT JOIN orden_compra_meta ocm ON ocm.requisition_id = r.id
    WHERE r.id = ?
    `,
    [requisitionId]
  );

  const out = [];
  let idx = 1;
  const pushMilestone = (changedAt, toStatusName, note, toStatusId = null) => {
    if (!changedAt) return;
    out.push({
      id: `legacy-${idx++}`,
      requisition_id: requisitionId,
      from_status_id: null,
      from_status_name: null,
      to_status_id: toStatusId,
      to_status_name: toStatusName,
      changed_by: null,
      changed_by_name: "Sistema",
      changed_by_role: "sistema",
      change_note: note,
      changed_at: changedAt,
    });
  };

  pushMilestone(reqRow.created_at, "Creada", "Hito reconstruido desde datos existentes", 7);
  pushMilestone(reqRow.sent_on, "Enviada", "Hito reconstruido desde datos existentes");
  pushMilestone(agg?.first_quote_at, "Inicio de cotización", "Primera cotización capturada", 12);
  pushMilestone(reqRow.quotation_closed_at, "Cierre de recepción", "Se cerró la recepción de cotizaciones", 14);
  pushMilestone(agg?.selection_completed_at, "Selección completada", "Partidas seleccionadas en comparativo", 13);

  if (Number(reqRow.statuses_id) === 11) {
    const estimatedFinalAt =
      agg?.order_meta_updated_at || agg?.selection_completed_at || reqRow.quotation_closed_at || reqRow.sent_on;
    pushMilestone(
      estimatedFinalAt,
      "Compra finalizada",
      "Fecha estimada para históricos sin trazabilidad completa",
      11
    );
  }

  out.sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());
  return out;
};

router.get("/timeline/requisiciones/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const requisitionId = Number(id);
    if (!requisitionId) return res.status(400).json({ message: "id inválido" });

    const role = String(req.user?.role || "");
    const authUserId = parseUserId(req.user?.id);
    if (!authUserId) return res.status(401).json({ message: "No autorizado" });

    const [[requisition]] = await pool.query(
      `
      SELECT
        r.id,
        r.users_id,
        r.statuses_id,
        r.assigned_operator_id,
        r.created_at,
        r.sent_on,
        r.quotation_closed_at,
        owner.ure AS owner_ure
      FROM requisition r
      LEFT JOIN users owner ON owner.id = r.users_id
      WHERE r.id = ?
      LIMIT 1
      `,
      [requisitionId]
    );

    if (!requisition) return res.status(404).json({ message: "Requisición no encontrada" });

    let allowed = false;
    if (role === "head_office") {
      allowed = Number(requisition.users_id) === authUserId;
    } else if (role === "coordinador") {
      const [[coord]] = await pool.query(`SELECT ure FROM users WHERE id = ? LIMIT 1`, [authUserId]);
      const coordUre = String(coord?.ure || "").trim();
      const ownerUre = String(requisition.owner_ure || "").trim();
      allowed = Boolean(coordUre && ownerUre && ownerUre.startsWith(coordUre));
    } else if (role === "secretaria") {
      allowed = true;
    } else if (role === "compras_admin" || role === "compras_lector") {
      allowed = true;
    } else if (role === "compras_operador") {
      allowed = Number(requisition.assigned_operator_id || 0) === authUserId;
    } else if (isFinanceRole(role)) {
      allowed = true;
    }

    if (!allowed) return res.status(403).json({ message: "Acceso denegado" });

    let statusTimeline = await getRequisitionStatusTimeline(requisitionId);
    let assignmentTimeline = [];
    try {
      assignmentTimeline = await getRequisitionAssignmentTimeline(requisitionId);
    } catch (assignmentError) {
      console.error("WARN timeline assignment history fallback:", assignmentError?.message || assignmentError);
      assignmentTimeline = [];
    }
    let inferred = false;
    if (!statusTimeline.length) {
      statusTimeline = await buildLegacyMilestones(requisitionId);
      inferred = true;
    }
    return res.json({
      requisition: {
        id: requisition.id,
        statuses_id: requisition.statuses_id,
        created_at: requisition.created_at,
        sent_on: requisition.sent_on,
        quotation_closed_at: requisition.quotation_closed_at,
      },
      statusTimeline,
      assignmentTimeline,
      inferred,
    });
  } catch (error) {
    console.error("Error timeline/requisiciones/:id", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
});

export default router;
