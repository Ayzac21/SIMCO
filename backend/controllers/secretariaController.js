import { pool } from "../db/connection.js";
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

// --- 1. OBTENER REQUISICIONES  ---
export const getRequisicionesSecretaria = async (req, res) => {
    try {
        if (!ensureSameSecretaria(req, res, req.params.id)) return;
        await ensureStatusHistoryTable();

        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)));
        const offset = (page - 1) * limit;

        const q = String(req.query.q || "").trim();
        const status = String(req.query.status || "todos");

        const whereParts = [
            "(r.statuses_id IN (9, 11, 12, 13, 14) OR (r.statuses_id = 10 AND COALESCE(ru.role, '') = 'secretaria'))",
        ];
        const params = [];

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

        const [[current]] = await pool.query(
            `SELECT statuses_id, users_id FROM requisition WHERE id = ? LIMIT 1`,
            [id]
        );
        if (!current) {
            return res.status(404).json({ message: "Requisición no encontrada" });
        }
        const currentStatus = Number(current.statuses_id);
        if (currentStatus === 11 || currentStatus === 13) {
            return res.status(400).json({ message: "La requisición ya no puede modificarse en secretaría" });
        }
        if (currentStatus !== 9) {
            return res.status(400).json({ message: "Solo se puede gestionar cuando está en secretaría (9)" });
        }
        
        const query = `
            UPDATE requisition 
            SET statuses_id = ?, notes = ?
            WHERE id = ?
        `;

        const [result] = await pool.query(query, [targetStatus, comentarios, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Requisición no encontrada" });
        }

        await logRequisitionStatusChange({
            requisitionId: id,
            fromStatusId: currentStatus,
            toStatusId: targetStatus,
            changedBy: getAuthUserId(req),
            note: comentarios || null,
        });

        const actorId = getAuthUserId(req);
        const ownerId = parseUserId(current.users_id);
        if (targetStatus === 8) {
            const coordinatorIds = await getCoordinatorUsersForRequisition(id);
            await createNotificationsForUsers(coordinatorIds, {
                actorUserId: actorId,
                title: "Secretaría solicitó ajustes",
                message: `La requisición #${id} necesita revisión de Coordinación antes de volver a URE.`,
                entityType: "requisition",
                entityId: Number(id),
                actionPath: `/coordinador/requisiciones?openReq=${id}`,
            });
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

        res.json({ message: "Estatus actualizado correctamente" });
    } catch (error) {
        console.error("Error actualizando estatus:", error);
        res.status(500).json({ message: "Error al actualizar estatus" });
    }
};

// --- 3. OBTENER ITEMS  ---
export const getSecretariaItems = async (req, res) => {
    try {
        const { id } = req.params;
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
