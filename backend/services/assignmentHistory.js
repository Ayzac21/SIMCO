import { pool } from "../db/connection.js";

let ensureAssignmentHistoryTablePromise = null;

export const ensureAssignmentHistoryTable = async (connOrPool = pool) => {
  if (!ensureAssignmentHistoryTablePromise) {
    ensureAssignmentHistoryTablePromise = (async () => {
      await connOrPool.query(`
        CREATE TABLE IF NOT EXISTS requisition_assignment_history (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          requisition_id INT NOT NULL,
          previous_operator_id INT NULL,
          new_operator_id INT NULL,
          changed_by INT NULL,
          change_note VARCHAR(500) NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_req_assign_hist_req (requisition_id),
          INDEX idx_req_assign_hist_created (created_at),
          CONSTRAINT fk_req_assign_hist_req
            FOREIGN KEY (requisition_id) REFERENCES requisition(id) ON DELETE CASCADE,
          CONSTRAINT fk_req_assign_hist_prev_user
            FOREIGN KEY (previous_operator_id) REFERENCES users(id) ON DELETE SET NULL,
          CONSTRAINT fk_req_assign_hist_new_user
            FOREIGN KEY (new_operator_id) REFERENCES users(id) ON DELETE SET NULL,
          CONSTRAINT fk_req_assign_hist_actor_user
            FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `);
    })().catch((error) => {
      ensureAssignmentHistoryTablePromise = null;
      throw error;
    });
  }
  await ensureAssignmentHistoryTablePromise;
};

export const logRequisitionAssignmentChange = async (
  { requisitionId, previousOperatorId = null, newOperatorId = null, changedBy = null, note = null },
  connOrPool = pool
) => {
  await ensureAssignmentHistoryTable(connOrPool);
  await connOrPool.query(
    `
      INSERT INTO requisition_assignment_history
        (requisition_id, previous_operator_id, new_operator_id, changed_by, change_note)
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      Number(requisitionId),
      previousOperatorId ? Number(previousOperatorId) : null,
      newOperatorId ? Number(newOperatorId) : null,
      changedBy ? Number(changedBy) : null,
      note ? String(note).trim() : null,
    ]
  );
};

export const getRequisitionAssignmentTimeline = async (requisitionId, connOrPool = pool) => {
  await ensureAssignmentHistoryTable(connOrPool);
  const [rows] = await connOrPool.query(
    `
      SELECT
        h.id,
        h.requisition_id,
        h.previous_operator_id,
        h.new_operator_id,
        h.changed_by,
        actor.name AS changed_by_name,
        actor.role AS changed_by_role,
        prev_u.name AS previous_operator_name,
        new_u.name AS new_operator_name,
        h.change_note,
        h.created_at AS changed_at
      FROM requisition_assignment_history h
      LEFT JOIN users actor ON actor.id = h.changed_by
      LEFT JOIN users prev_u ON prev_u.id = h.previous_operator_id
      LEFT JOIN users new_u ON new_u.id = h.new_operator_id
      WHERE h.requisition_id = ?
      ORDER BY h.created_at ASC, h.id ASC
    `,
    [Number(requisitionId)]
  );

  return (rows || []).map((row) => ({
    ...row,
    event_type: "assignment",
  }));
};

