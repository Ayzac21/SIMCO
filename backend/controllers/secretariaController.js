import { pool } from "../db/connection.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
    createNotification,
    createNotificationsForUsers,
    getCoordinatorUsersForRequisition,
    getUsersByRolePrefix,
} from "../services/notifications.js";
import { ensureStatusHistoryTable, logRequisitionStatusChange } from "../services/statusHistory.js";

const parseUserId = (value) => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : 0;
};

const getAuthUserId = (req) => parseUserId(req.user?.id);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const requisitionUploadsDir = path.resolve(__dirname, "..", "uploads", "requisiciones");
const resolveStoredRequisitionImagePath = (storedPath) => {
    if (!storedPath) return null;
    const raw = String(storedPath || "");
    const normalized = raw.replace(/\\/g, "/");
    const fileName = path.basename(normalized);
    const candidates = [];
    if (path.isAbsolute(raw)) candidates.push(path.resolve(raw));
    if (fileName) candidates.push(path.resolve(requisitionUploadsDir, fileName));

    for (const candidate of candidates) {
        if (!candidate.startsWith(requisitionUploadsDir)) continue;
        if (fs.existsSync(candidate)) return candidate;
    }
    return null;
};
const secretariaScopeRejectedJoin = `
    LEFT JOIN (
        SELECT h.requisition_id, h.changed_by
        FROM requisition_status_history h
        INNER JOIN (
            SELECT requisition_id, MAX(id) AS max_id
            FROM requisition_status_history
            WHERE to_status_id = 10
            GROUP BY requisition_id
        ) last_rej ON last_rej.max_id = h.id
    ) rh ON rh.requisition_id = r.id
    LEFT JOIN users ru ON ru.id = rh.changed_by
`;

const ensureSameSecretaria = (req, res, requestedId) => {
    const authId = getAuthUserId(req);
    if (!authId) {
        res.status(401).json({ message: "No autorizado" });
        return false;
    }
    if (requestedId != null && authId !== parseUserId(requestedId)) {
        res.status(403).json({ message: "Acceso denegado" });
        return false;
    }
    return true;
};

const getSecretariaUreByUserId = async (userId, connOrPool = pool) => {
    const uid = parseUserId(userId);
    if (!uid) return "";
    const [[row]] = await connOrPool.query(
        `SELECT TRIM(UPPER(ure)) AS ure FROM users WHERE id = ? AND role = 'secretaria' LIMIT 1`,
        [uid]
    );
    return String(row?.ure || "").trim();
};

const canSecretariaAccessRequisition = async (requisitionId, secretariaUserId) => {
    const reqId = parseUserId(requisitionId);
    if (!reqId) return false;
    const secUre = await getSecretariaUreByUserId(secretariaUserId);
    if (!secUre) return false;
    await ensureStatusHistoryTable();
    const [rows] = await pool.query(
        `
        SELECT r.id
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
        ${secretariaScopeRejectedJoin}
        WHERE r.id = ?
          AND TRIM(UPPER(COALESCE(sec_scope.ure, ''))) = ?
          AND (
            r.statuses_id IN (9, 11, 12, 13, 14)
            OR (r.statuses_id = 10 AND COALESCE(ru.role, '') = 'secretaria')
          )
        LIMIT 1
        `,
        [reqId, secUre]
    );
    return Array.isArray(rows) && rows.length > 0;
};

// --- 1. OBTENER REQUISICIONES  ---
export const getRequisicionesSecretaria = async (req, res) => {
    try {
        if (!ensureSameSecretaria(req, res, req.params.id)) return;
        const authId = getAuthUserId(req);
        const secretariaUre = await getSecretariaUreByUserId(authId);
        if (!secretariaUre) {
            return res.status(403).json({ message: "No se encontró URE para la secretaría autenticada" });
        }
        await ensureStatusHistoryTable();

        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)));
        const offset = (page - 1) * limit;

        const q = String(req.query.q || "").trim();
        const status = String(req.query.status || "todos");

        const whereParts = [
            "(r.statuses_id IN (9, 11, 12, 13, 14) OR (r.statuses_id = 10 AND COALESCE(ru.role, '') = 'secretaria'))",
            "TRIM(UPPER(COALESCE(sec_scope.ure, ''))) = ?",
        ];
        const params = [secretariaUre];

        if (status === "pendientes") whereParts.push("r.statuses_id = 9");
        if (status === "aprobadas") whereParts.push("r.statuses_id IN (12, 13, 14, 11)");
        if (status === "rechazadas") whereParts.push("r.statuses_id = 10 AND COALESCE(ru.role, '') = 'secretaria'");

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

        const whereClause = `WHERE ${whereParts.join(" AND ")}`;

        const countQuery = `
            SELECT COUNT(DISTINCT r.id) AS total
            FROM requisition r
            JOIN statuses s ON r.statuses_id = s.id
            JOIN users u ON r.users_id = u.id

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
            LEFT JOIN (
                SELECT h.requisition_id, h.changed_by, h.change_note, h.changed_at
                FROM requisition_status_history h
                INNER JOIN (
                    SELECT requisition_id, MAX(id) AS max_id
                    FROM requisition_status_history
                    WHERE to_status_id = 10
                    GROUP BY requisition_id
                ) last_rej ON last_rej.max_id = h.id
            ) rh ON rh.requisition_id = r.id
            LEFT JOIN users ru ON ru.id = rh.changed_by
            ${whereClause}
        `;

        const [countRows] = await pool.query(countQuery, params);
        const total = Number(countRows?.[0]?.total || 0);

        const query = `
            SELECT DISTINCT
                r.id,
                r.request_name,
                r.created_at,
                r.statuses_id,
                s.name as nombre_estatus,
                r.observation as observaciones,
                r.justification as justificacion,
                COALESCE(NULLIF(TRIM(rh.change_note), ''), r.notes) as notas,
                ru.name as rejected_by_name,
                ru.role as rejected_by_role,
                rh.changed_at as rejected_at,

                u.name as solicitante,
                u.role as solicitante_role,
                u.ure as ure_solicitante,

                COALESCE(NULLIF(TRIM(ho.name), ''), NULLIF(TRIM(c2.name), ''), u.ure) as nombre_unidad,
                COALESCE(NULLIF(TRIM(c.name), ''), NULLIF(TRIM(c2.name), ''), 'General') as coordinacion

            FROM requisition r
            JOIN statuses s ON r.statuses_id = s.id
            JOIN users u ON r.users_id = u.id

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
            LEFT JOIN (
                SELECT h.requisition_id, h.changed_by, h.change_note, h.changed_at
                FROM requisition_status_history h
                INNER JOIN (
                    SELECT requisition_id, MAX(id) AS max_id
                    FROM requisition_status_history
                    WHERE to_status_id = 10
                    GROUP BY requisition_id
                ) last_rej ON last_rej.max_id = h.id
            ) rh ON rh.requisition_id = r.id
            LEFT JOIN users ru ON ru.id = rh.changed_by

            ${whereClause}
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const [rows] = await pool.query(query, [...params, limit, offset]);
        res.json({ rows, total, page, limit });

    } catch (error) {
        console.error("Error en Lista Secretaria:", error.message);
        res.status(200).json({ rows: [], total: 0, page: 1, limit: 10 }); 
    }
};

// --- 2. ACTUALIZAR ESTATUS  ---
export const updateEstatusSecretaria = async (req, res) => {
    let conn = null;
    try {
        const { id } = req.params; 
        const { status_id, comentarios } = req.body; 
        const targetStatus = Number(status_id);

        if (!targetStatus) {
            return res.status(400).json({ message: "Falta status_id" });
        }
        if (![8, 10, 12].includes(targetStatus)) {
            return res.status(400).json({ message: "status_id no permitido para secretaría" });
        }
        if ((targetStatus === 10 || targetStatus === 8) && !String(comentarios || "").trim()) {
            return res.status(400).json({ message: "Debes incluir comentarios para esta acción" });
        }

        await ensureStatusHistoryTable();
        conn = await pool.getConnection();
        await conn.beginTransaction();

        const authId = getAuthUserId(req);
        const secretariaUre = await getSecretariaUreByUserId(authId, conn);
        if (!secretariaUre) {
            await conn.rollback();
            return res.status(403).json({ message: "No se encontró URE para la secretaría autenticada" });
        }
        const [[current]] = await conn.query(
            `
            SELECT r.statuses_id, r.users_id, u.role AS owner_role
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
              AND TRIM(UPPER(COALESCE(sec_scope.ure, ''))) = ?
            LIMIT 1
            FOR UPDATE
            `,
            [id, secretariaUre]
        );
        if (!current) {
            await conn.rollback();
            return res.status(404).json({ message: "Requisición no encontrada" });
        }
        const currentStatus = Number(current.statuses_id);
        const ownerRole = String(current.owner_role || "").trim().toLowerCase();
        const shouldReturnToComprasOwner = targetStatus === 8 && ownerRole.startsWith("compras_");
        const nextStatus = shouldReturnToComprasOwner ? 7 : targetStatus;
        if (currentStatus === 11 || currentStatus === 13) {
            await conn.rollback();
            return res.status(400).json({ message: "La requisición ya no puede modificarse en secretaría" });
        }
        if (currentStatus !== 9) {
            await conn.rollback();
            return res.status(400).json({ message: "Solo se puede gestionar cuando está en secretaría (9)" });
        }
        
        const query = `
            UPDATE requisition 
            SET statuses_id = ?, notes = ?
            WHERE id = ?
        `;

        const [result] = await conn.query(query, [nextStatus, comentarios, id]);

        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ message: "Requisición no encontrada" });
        }

        await logRequisitionStatusChange({
            requisitionId: id,
            fromStatusId: currentStatus,
            toStatusId: nextStatus,
            changedBy: getAuthUserId(req),
            note: comentarios || null,
        }, conn);

        await conn.commit();
        conn.release();
        conn = null;

        const actorId = getAuthUserId(req);
        const ownerId = parseUserId(current.users_id);
        try {
            if (targetStatus === 8) {
                if (shouldReturnToComprasOwner) {
                    if (ownerId) {
                        await createNotification({
                            recipientUserId: ownerId,
                            actorUserId: actorId,
                            title: "Secretaría solicitó ajustes",
                            message: `La requisición #${id} regresó a Compras para corrección.`,
                            entityType: "requisition",
                            entityId: Number(id),
                            actionPath: `/compras/mi-requisiciones?openReq=${id}`,
                        });
                    }
                } else {
                    const coordinatorIds = await getCoordinatorUsersForRequisition(id);
                    await createNotificationsForUsers(coordinatorIds, {
                        actorUserId: actorId,
                        title: "Secretaría solicitó ajustes",
                        message: `La requisición #${id} necesita revisión de Coordinación antes de volver a URE.`,
                        entityType: "requisition",
                        entityId: Number(id),
                        actionPath: `/coordinador/requisiciones?openReq=${id}`,
                    });
                    if (ownerId) {
                        await createNotification({
                            recipientUserId: ownerId,
                            actorUserId: actorId,
                            title: "Secretaría solicitó ajustes",
                            message: `La requisición #${id} regresó a Coordinación para ajustes previos.`,
                            entityType: "requisition",
                            entityId: Number(id),
                            actionPath: `/unidad/mi-requisiciones?openReq=${id}`,
                        });
                    }
                }
            } else if (targetStatus === 12) {
                const comprasIds = await getUsersByRolePrefix("compras_");
                await createNotificationsForUsers(comprasIds, {
                    actorUserId: actorId,
                    title: "Nueva requisición en Compras",
                    message: `La requisición #${id} fue autorizada en Secretaría y está lista para cotización.`,
                    entityType: "requisition",
                    entityId: Number(id),
                    actionPath: `/compras/dashboard`,
                });
                const coordinatorIds = await getCoordinatorUsersForRequisition(id);
                await createNotificationsForUsers(coordinatorIds, {
                    actorUserId: actorId,
                    title: "Secretaría autorizó requisición",
                    message: `La requisición #${id} fue validada en Secretaría y enviada a Compras.`,
                    entityType: "requisition",
                    entityId: Number(id),
                    actionPath: `/coordinador/dashboard`,
                });
                if (ownerId) {
                    await createNotification({
                        recipientUserId: ownerId,
                        actorUserId: actorId,
                        title: "Requisición autorizada por Secretaría",
                        message: `La requisición #${id} pasó a Compras para cotización.`,
                        entityType: "requisition",
                        entityId: Number(id),
                        actionPath: `/unidad/mi-requisiciones?openReq=${id}`,
                    });
                }
            } else if (targetStatus === 10 && ownerId) {
                await createNotification({
                    recipientUserId: ownerId,
                    actorUserId: actorId,
                    title: "Requisición rechazada en Secretaría",
                    message: `La requisición #${id} fue rechazada. Revisa el motivo en el detalle.`,
                    entityType: "requisition",
                    entityId: Number(id),
                    actionPath: `/unidad/mi-requisiciones?openReq=${id}`,
                });
            }
        } catch (notificationError) {
            console.error("Estatus actualizado, pero fallaron notificaciones de Secretaría:", notificationError);
        }

        res.json({ message: "Estatus actualizado correctamente" });
    } catch (error) {
        if (conn) {
            try { await conn.rollback(); } catch {}
            conn.release();
        }
        console.error("Error actualizando estatus:", error);
        res.status(500).json({ message: "Error al actualizar estatus" });
    }
};

// --- 3. OBTENER ITEMS  ---
export const getSecretariaItems = async (req, res) => {
    try {
        const { id } = req.params;
        const authId = getAuthUserId(req);
        if (!authId) return res.status(401).json({ message: "No autorizado" });
        const allowed = await canSecretariaAccessRequisition(id, authId);
        if (!allowed) return res.status(403).json({ message: "Acceso denegado" });
        const query = `
            SELECT 
                li.*, 
                un.name AS unidad
            FROM line_items li
            LEFT JOIN units un ON li.units_id = un.id
            WHERE li.requisition_id = ?
        `;
        const [rows] = await pool.query(query, [id]);
        res.json(rows);
    } catch (error) {
        console.error("Error obteniendo items:", error.message);
        res.status(200).json([]);
    }
};

export const getSecretariaItemImage = async (req, res) => {
    try {
        const { id, line_item_id } = req.params;
        const authId = getAuthUserId(req);
        if (!authId) return res.status(401).json({ message: "No autorizado" });
        const allowed = await canSecretariaAccessRequisition(id, authId);
        if (!allowed) return res.status(403).json({ message: "Acceso denegado" });
        const [[itemRow]] = await pool.query(
            `
            SELECT id, image_file_path, image_mime_type, image_original_name
            FROM line_items
            WHERE id = ? AND requisition_id = ?
            LIMIT 1
            `,
            [line_item_id, id]
        );

        if (!itemRow || !itemRow.image_file_path) {
            return res.status(404).json({ message: "Imagen no encontrada" });
        }

        const absPath = resolveStoredRequisitionImagePath(itemRow.image_file_path);
        if (!absPath) {
            return res.status(404).json({ message: "Archivo no disponible" });
        }

        const mime = itemRow.image_mime_type || "application/octet-stream";
        const fileName = encodeURIComponent(itemRow.image_original_name || "imagen");
        res.setHeader("Content-Type", mime);
        res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${fileName}`);
        return res.sendFile(absPath);
    } catch (error) {
        if (error?.code === "ER_BAD_FIELD_ERROR") {
            return res.status(404).json({ message: "Imagen no disponible" });
        }
        console.error("Error obteniendo imagen de partida (Secretaría):", error);
        return res.status(500).json({ message: "Error interno del servidor" });
    }
};
