import { pool } from "../db/connection.js";

const parseUserId = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

let ensureNotificationsTablePromise = null;

export const ensureNotificationsTable = async () => {
  if (!ensureNotificationsTablePromise) {
    ensureNotificationsTablePromise = pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        recipient_user_id BIGINT NOT NULL,
        actor_user_id BIGINT NULL,
        title VARCHAR(180) NOT NULL,
        message VARCHAR(600) NOT NULL,
        entity_type VARCHAR(40) NULL,
        entity_id INT NULL,
        action_path VARCHAR(255) NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        read_at DATETIME NULL,
        INDEX idx_notif_recipient_created (recipient_user_id, created_at),
        INDEX idx_notif_recipient_read (recipient_user_id, is_read)
      )
    `);
  }
  await ensureNotificationsTablePromise;
};

export const createNotification = async (
  {
    recipientUserId,
    actorUserId = null,
    title,
    message,
    entityType = null,
    entityId = null,
    actionPath = null,
  },
  connOrPool = pool
) => {
  const recipientId = parseUserId(recipientUserId);
  if (!recipientId || !String(title || "").trim()) return;
  await ensureNotificationsTable();

  await connOrPool.query(
    `
    INSERT INTO notifications
      (recipient_user_id, actor_user_id, title, message, entity_type, entity_id, action_path, is_read, created_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, 0, NOW())
    `,
    [
      recipientId,
      parseUserId(actorUserId) || null,
      String(title || "").trim(),
      String(message || "").trim(),
      entityType,
      entityId == null ? null : Number(entityId),
      actionPath ? String(actionPath) : null,
    ]
  );
};

export const createNotificationsForUsers = async (userIds, payload, connOrPool = pool) => {
  const ids = Array.from(new Set((userIds || []).map(parseUserId).filter(Boolean)));
  if (!ids.length) return;
  await Promise.all(ids.map((uid) => createNotification({ ...payload, recipientUserId: uid }, connOrPool)));
};

export const getUsersByRole = async (role, connOrPool = pool) => {
  const [rows] = await connOrPool.query(
    `SELECT id FROM users WHERE role = ? AND COALESCE(statuses_id, 1) = 1`,
    [String(role || "")]
  );
  return rows.map((r) => parseUserId(r.id)).filter(Boolean);
};

export const getUsersByRolePrefix = async (prefix, connOrPool = pool) => {
  const [rows] = await connOrPool.query(
    `SELECT id FROM users WHERE role LIKE ? AND COALESCE(statuses_id, 1) = 1`,
    [`${String(prefix || "").trim()}%`]
  );
  return rows.map((r) => parseUserId(r.id)).filter(Boolean);
};

export const getRequisitionOwnerId = async (requisitionId, connOrPool = pool) => {
  const [[row]] = await connOrPool.query(
    `SELECT users_id FROM requisition WHERE id = ? LIMIT 1`,
    [requisitionId]
  );
  return parseUserId(row?.users_id);
};

export const getCoordinatorUsersForRequisition = async (requisitionId, connOrPool = pool) => {
  const [[ownerRow]] = await connOrPool.query(
    `
    SELECT u.ure
    FROM requisition r
    JOIN users u ON u.id = r.users_id
    WHERE r.id = ?
    LIMIT 1
    `,
    [requisitionId]
  );
  const ownerUre = String(ownerRow?.ure || "").trim();
  if (!ownerUre) return [];

  const [rows] = await connOrPool.query(
    `
    SELECT id
    FROM users
    WHERE role = 'coordinador'
      AND COALESCE(statuses_id, 1) = 1
      AND ? LIKE CONCAT(TRIM(ure), '%')
    `,
    [ownerUre]
  );
  return rows.map((r) => parseUserId(r.id)).filter(Boolean);
};

export const getSecretariaUsersForRequisition = async (requisitionId, connOrPool = pool) => {
  const [[scopeRow]] = await connOrPool.query(
    `
    SELECT TRIM(UPPER(sec_scope.ure)) AS secretaria_ure
    FROM requisition r
    JOIN users u ON u.id = r.users_id
    LEFT JOIN coordination c2
      ON c2.id = (
        SELECT c3.id
        FROM coordination c3
        WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(c3.ure)), '%')
        ORDER BY LENGTH(TRIM(c3.ure)) DESC
        LIMIT 1
      )
    LEFT JOIN secretary sec_scope
      ON sec_scope.id = (
        SELECT s2.id
        FROM secretary s2
        WHERE
          (c2.ure IS NOT NULL AND TRIM(UPPER(s2.ure)) = TRIM(UPPER(c2.ure)))
          OR TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(s2.ure)), '%')
        ORDER BY
          CASE WHEN c2.ure IS NOT NULL AND TRIM(UPPER(s2.ure)) = TRIM(UPPER(c2.ure)) THEN 0 ELSE 1 END,
          LENGTH(TRIM(s2.ure)) DESC
        LIMIT 1
      )
    WHERE r.id = ?
    LIMIT 1
    `,
    [requisitionId]
  );

  const secretariaUre = String(scopeRow?.secretaria_ure || "").trim();
  if (!secretariaUre) return [];

  const [rows] = await connOrPool.query(
    `
    SELECT id
    FROM users
    WHERE role = 'secretaria'
      AND COALESCE(statuses_id, 1) = 1
      AND TRIM(UPPER(COALESCE(ure, ''))) = ?
    `,
    [secretariaUre]
  );

  return rows.map((r) => parseUserId(r.id)).filter(Boolean);
};
