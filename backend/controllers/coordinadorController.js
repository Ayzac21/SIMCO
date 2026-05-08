import { pool } from "../db/connection.js"; 
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
    createNotification,
    createNotificationsForUsers,
    getSecretariaUsersForRequisition,
    getUsersByRole,
} from "../services/notifications.js";
import { logRequisitionStatusChange } from "../services/statusHistory.js";

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

const getCoordinatorUre = async (coordinadorId) => {
    const [rows] = await pool.query("SELECT ure FROM users WHERE id = ? LIMIT 1", [coordinadorId]);
    const ureBase = String(rows?.[0]?.ure || "").trim();
    return ureBase;
};

const ensureSameCoordinator = (req, res, requestedId) => {
    const authId = getAuthUserId(req);
    if (!authId) {
        res.status(401).json({ message: "No autorizado" });
        return false;
    }
    if (authId !== parseUserId(requestedId)) {
        res.status(403).json({ message: "Acceso denegado" });
        return false;
    }
    return true;
};

const ensureCoordinatorScopeByRequisition = async (req, res, requisitionId) => {
    const authId = getAuthUserId(req);
    if (!authId) {
        res.status(401).json({ message: "No autorizado" });
        return null;
    }

    const ureBase = await getCoordinatorUre(authId);
    if (!ureBase) {
        res.status(404).json({ message: "Coordinador no encontrado" });
        return null;
    }

    const [rows] = await pool.query(
        `
        SELECT r.id, r.statuses_id, r.users_id
        FROM requisition r
        JOIN users u ON r.users_id = u.id
        WHERE r.id = ? AND u.ure LIKE CONCAT(?, '%')
        LIMIT 1
        `,
        [requisitionId, ureBase]
    );

    if (rows.length === 0) {
        res.status(404).json({ message: "Requisición no encontrada o sin acceso" });
        return null;
    }

    const scoped = rows[0];
    if (Number(scoped.statuses_id) === 7 && Number(scoped.users_id) !== authId) {
        res.status(403).json({ message: "Borrador en ajuste por URE. Espera su reenvío a Coordinación." });
        return null;
    }

    return scoped;
};

export const getRequisicionItems = async (req, res) => {
    try {
        const { id } = req.params;
        const inScope = await ensureCoordinatorScopeByRequisition(req, res, id);
        if (!inScope) return;

        const query = `
            SELECT 
                li.*, 
                u.name AS nombre_unidad
            FROM line_items li
            LEFT JOIN units u ON li.units_id = u.id
            WHERE li.requisition_id = ?
        `;

        const [rows] = await pool.query(query, [id]);
        
        res.json(rows);

    } catch (error) {
        console.error("Error al obtener items:", error);
        res.status(500).json({ message: "Error al obtener partidas" });
    }
};


export const getRequisicionesCoordinador = async (req, res) => {
    try {
        const { coordinador_id } = req.params;
        if (!ensureSameCoordinator(req, res, coordinador_id)) return;
        const authId = getAuthUserId(req);

        const ureBase = await getCoordinatorUre(authId);
        if (!ureBase) {
            return res.status(404).json({ message: "Coordinador no encontrado" });
        }

        const [requisiciones] = await pool.query(
            `
            SELECT 
                r.id,
                r.request_name,
                r.created_at,
                r.statuses_id,
                r.users_id,
                r.area_folio,
                r.observation,
                r.justification,
                r.notes,       
                u.name AS solicitante,
                u.ure AS ure_solicitante,
                s.name AS nombre_estatus 
            FROM requisition r
            JOIN users u ON r.users_id = u.id
            JOIN statuses s ON r.statuses_id = s.id 
            WHERE u.ure LIKE CONCAT(?, '%')
              AND (r.statuses_id <> 7 OR r.users_id = ?)
            ORDER BY r.created_at DESC
            `,
            [ureBase, authId]
        );

        res.json(requisiciones);

    } catch (error) {
        console.error("ERROR FATAL:", error); 
        res.status(500).json({ message: error.message });
    }
};

export const getRequisicionItemImage = async (req, res) => {
    try {
        const { id, line_item_id } = req.params;
        const inScope = await ensureCoordinatorScopeByRequisition(req, res, id);
        if (!inScope) return;

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
        console.error("Error al descargar imagen de partida:", error);
        return res.status(500).json({ message: "Error interno del servidor" });
    }
};


export const updateEstatusRequisicion = async (req, res) => {
    try {
        const { id } = req.params;            
        const { status_id, comentarios } = req.body;
        const targetStatus = Number(status_id);
        const reqScope = await ensureCoordinatorScopeByRequisition(req, res, id);
        if (!reqScope) return;
        const currentStatus = Number(reqScope.statuses_id);
        
        if (!targetStatus) {
            return res.status(400).json({ message: "Falta el status_id" });
        }
        if (![7, 9, 10].includes(targetStatus)) {
            return res.status(400).json({ message: "status_id no permitido para coordinación" });
        }
        if (currentStatus === 11 || currentStatus === 13) {
            return res.status(400).json({ message: "La requisición ya no puede modificarse en coordinación" });
        }
        if ((targetStatus === 7 || targetStatus === 9 || targetStatus === 10) && currentStatus !== 8) {
            return res.status(400).json({ message: "Solo se puede gestionar cuando está en coordinación (8)" });
        }
        if ((targetStatus === 10 || targetStatus === 7) && !String(comentarios || "").trim()) {
            return res.status(400).json({ message: "Debes incluir comentarios para esta acción" });
        }

        const [result] = await pool.query(
            "UPDATE requisition SET statuses_id = ?, notes = ? WHERE id = ?",
            [targetStatus, comentarios || null, id]
        );

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
        const ownerId = parseUserId(reqScope.users_id);
        if (targetStatus === 7 && ownerId) {
            await createNotification({
                recipientUserId: ownerId,
                actorUserId: actorId,
                title: "Coordinación solicitó ajustes",
                message: `La requisición #${id} requiere correcciones. Revisa los comentarios y reenvía.`,
                entityType: "requisition",
                entityId: Number(id),
                actionPath: `/unidad/requisiciones/editar/${id}`,
            });
        } else if (targetStatus === 10 && ownerId) {
            await createNotification({
                recipientUserId: ownerId,
                actorUserId: actorId,
                title: "Requisición rechazada en Coordinación",
                message: `La requisición #${id} fue rechazada. Revisa el motivo en el detalle.`,
                entityType: "requisition",
                entityId: Number(id),
                actionPath: `/unidad/mi-requisiciones?openReq=${id}`,
            });
        } else if (targetStatus === 9) {
            if (ownerId) {
                await createNotification({
                    recipientUserId: ownerId,
                    actorUserId: actorId,
                    title: "Requisición autorizada por Coordinación",
                    message: `La requisición #${id} fue aprobada y enviada a Secretaría para su revisión.`,
                    entityType: "requisition",
                    entityId: Number(id),
                    actionPath: `/unidad/mi-requisiciones?openReq=${id}`,
                });
            }
            const secretariaIds = await getSecretariaUsersForRequisition(id);
            await createNotificationsForUsers(secretariaIds, {
                actorUserId: actorId,
                title: "Nueva requisición en Secretaría",
                message: `La requisición #${id} fue autorizada por Coordinación y está lista para revisión.`,
                entityType: "requisition",
                entityId: Number(id),
                actionPath: `/secretaria/recibidas?openReq=${id}`,
            });
        }

        res.json({ message: "Estatus actualizado correctamente" });

    } catch (error) {
        console.error("Error al actualizar:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
};

export const createRequisicionCoordinador = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const {
            categoria,
            articulos,
            notes = "",
            request_name = "",
            justification = "",
            observation = "",
        } = req.body;
        const users_id = getAuthUserId(req);

        if (!users_id || !Array.isArray(articulos) || articulos.length === 0) {
            return res.status(400).json({ ok: false, message: "Datos incompletos" });
        }

        await conn.beginTransaction();

        const now = new Date();
        const folioCorto = `CO-${Math.floor(1000 + Math.random() * 9000)}`;

        const [result] = await conn.query(
            `
            INSERT INTO requisition
            (
                folio,
                area_folio,
                notes,
                users_id,
                statuses_id,
                signatures,
                created_at,
                sent_on,
                categories_id,
                request_name,
                justification,
                observation
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                null,
                folioCorto,
                notes,
                users_id,
                7,
                "",
                now,
                null,
                categoria || 1,
                request_name,
                justification,
                observation,
            ]
        );

        const requisitionId = result.insertId;

        for (const art of articulos) {
            await conn.query(
                `
                INSERT INTO line_items
                    (product_name, description, quantity, units_id, requisition_id)
                VALUES (?, ?, ?, ?, ?)
                `,
                [
                    art.producto || "",
                    art.especificaciones || "",
                    Number(art.cantidad || 0),
                    art.units_id || 1,
                    requisitionId,
                ]
            );
        }

        await logRequisitionStatusChange(
            {
                requisitionId,
                fromStatusId: null,
                toStatusId: 7,
                changedBy: users_id,
                note: "Creación de requisición en borrador por coordinación",
            },
            conn
        );

        await conn.commit();
        return res.json({
            ok: true,
            id: requisitionId,
            folio: folioCorto,
            status: "En borrador",
        });
    } catch (err) {
        await conn.rollback();
        console.error("ERROR crear requisición (coordinador):", err);
        return res.status(500).json({ ok: false, message: "Error interno" });
    } finally {
        conn.release();
    }
};

export const enviarBorradorCoordinador = async (req, res) => {
    try {
        const { id } = req.params;
        const reqScope = await ensureCoordinatorScopeByRequisition(req, res, id);
        if (!reqScope) return;
        const currentStatus = Number(reqScope.statuses_id);
        if (![7, 8].includes(currentStatus)) {
            return res.status(400).json({ ok: false, message: "Solo se pueden enviar requisiciones en estatus editable (borrador/coordinación)" });
        }

        const [[row]] = await pool.query(
            `SELECT notes FROM requisition WHERE id = ? AND statuses_id IN (7, 8) LIMIT 1`,
            [id]
        );
        const currentNote = String(row?.notes || "");
        const requestedResume = Number(req.body?.resume_to || 0);

        let resumeTo = 9;
        if (currentNote.startsWith("AJUSTE_COMPRAS:")) resumeTo = 12;
        if (requestedResume === 9 && !currentNote.startsWith("AJUSTE_")) resumeTo = 9;

        const [result] = await pool.query(
            `
            UPDATE requisition
            SET statuses_id = ?, notes = NULL, sent_on = COALESCE(sent_on, NOW())
            WHERE id = ? AND statuses_id IN (7, 8)
            `,
            [resumeTo, id]
        );

        if (!result.affectedRows) {
            return res.status(400).json({ ok: false, message: "No se puede enviar" });
        }

        await logRequisitionStatusChange({
            requisitionId: id,
            fromStatusId: currentStatus,
            toStatusId: resumeTo,
            changedBy: getAuthUserId(req),
            note: "Envío de borrador por coordinación",
        });

        const actorId = getAuthUserId(req);
        const ownerId = parseUserId(reqScope.users_id);
        if (resumeTo === 9) {
            if (ownerId && ownerId !== actorId) {
                await createNotification({
                    recipientUserId: ownerId,
                    actorUserId: actorId,
                    title: "Requisición enviada a Secretaría",
                    message: `La requisición #${id} fue enviada a Secretaría para revisión.`,
                    entityType: "requisition",
                    entityId: Number(id),
                    actionPath: `/unidad/mi-requisiciones?openReq=${id}`,
                });
            }

            const secretariaIds = await getSecretariaUsersForRequisition(id);
            await createNotificationsForUsers(secretariaIds, {
                actorUserId: actorId,
                title: "Nueva requisición en Secretaría",
                message: `La requisición #${id} fue enviada por Coordinación y está lista para revisión.`,
                entityType: "requisition",
                entityId: Number(id),
                actionPath: `/secretaria/recibidas?openReq=${id}`,
            });
        } else if (resumeTo === 12) {
            if (ownerId && ownerId !== actorId) {
                await createNotification({
                    recipientUserId: ownerId,
                    actorUserId: actorId,
                    title: "Requisición enviada a Compras",
                    message: `La requisición #${id} fue reenviada a Compras para cotización.`,
                    entityType: "requisition",
                    entityId: Number(id),
                    actionPath: `/unidad/mi-requisiciones?openReq=${id}`,
                });
            }

            const [comprasAdminIds, comprasOperadorIds] = await Promise.all([
                getUsersByRole("compras_admin"),
                getUsersByRole("compras_operador"),
            ]);
            const comprasIds = Array.from(new Set([...comprasAdminIds, ...comprasOperadorIds]));
            await createNotificationsForUsers(comprasIds, {
                actorUserId: actorId,
                title: "Requisición en Compras",
                message: `La requisición #${id} fue reenviada por Coordinación para continuar cotización.`,
                entityType: "requisition",
                entityId: Number(id),
                actionPath: `/compras/dashboard`,
            });
        }

        return res.json({
            ok: true,
            statuses_id: resumeTo,
            status: resumeTo === 12 ? "En cotización" : "En secretaría",
        });
    } catch (err) {
        console.error("ERROR enviar borrador (coordinador):", err);
        return res.status(500).json({ ok: false, message: "Error interno" });
    }
};
