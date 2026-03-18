import { pool } from "../db/connection.js";

const parseId = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

let ensureStatusHistoryTablePromise = null;

export const ensureStatusHistoryTable = async () => {
  if (!ensureStatusHistoryTablePromise) {
    ensureStatusHistoryTablePromise = pool.query(`
      CREATE TABLE IF NOT EXISTS requisition_status_history (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        requisition_id INT NOT NULL,
        from_status_id INT NULL,
        to_status_id INT NOT NULL,
        changed_by INT UNSIGNED NULL,
        change_note TEXT NULL,
        changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_rsh_req_changed (requisition_id, changed_at),
        INDEX idx_rsh_to_status (to_status_id),
        CONSTRAINT fk_rsh_req FOREIGN KEY (requisition_id) REFERENCES requisition(id) ON DELETE CASCADE,
        CONSTRAINT fk_rsh_changed_by FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `).catch((error) => {
      ensureStatusHistoryTablePromise = null;
      throw error;
    });
  }
  await ensureStatusHistoryTablePromise;
};

export const logRequisitionStatusChange = async (
  {
    requisitionId,
    fromStatusId = null,
    toStatusId,
    changedBy = null,
    note = null,
  },
  connOrPool = pool
) => {
  const reqId = parseId(requisitionId);
  const toId = parseId(toStatusId);
  const fromId = parseId(fromStatusId) || null;
  const actorId = parseId(changedBy) || null;
  if (!reqId || !toId) return;
  if (fromId !== null && fromId === toId) return;

  await ensureStatusHistoryTable();
  await connOrPool.query(
    `
    INSERT INTO requisition_status_history
      (requisition_id, from_status_id, to_status_id, changed_by, change_note, changed_at)
    VALUES (?, ?, ?, ?, ?, NOW())
    `,
    [reqId, fromId, toId, actorId, note ? String(note) : null]
  );
};

export const getRequisitionStatusTimeline = async (requisitionId, connOrPool = pool) => {
  const reqId = parseId(requisitionId);
  if (!reqId) return [];

  await ensureStatusHistoryTable();
  const [rows] = await connOrPool.query(
    `
    SELECT
      h.id,
      h.requisition_id,
      h.from_status_id,
      sf.name AS from_status_name,
      h.to_status_id,
      st.name AS to_status_name,
      h.changed_by,
      u.name AS changed_by_name,
      u.role AS changed_by_role,
      h.change_note,
      h.changed_at
    FROM requisition_status_history h
    LEFT JOIN statuses sf ON sf.id = h.from_status_id
    LEFT JOIN statuses st ON st.id = h.to_status_id
    LEFT JOIN users u ON u.id = h.changed_by
    WHERE h.requisition_id = ?
    ORDER BY h.changed_at ASC, h.id ASC
    `,
    [reqId]
  );
  return rows;
};
