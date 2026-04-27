import express from "express";
import { pool } from "../db/connection.js";
import { requireRoles } from "../middleware/auth.js";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";
import {
  createNotificationsForUsers,
  getCoordinatorUsersForRequisition,
  getUsersByRole,
  getUsersByRolePrefix,
} from "../services/notifications.js";
import {
  getRequisitionStatusTimeline,
  logRequisitionStatusChange,
} from "../services/statusHistory.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "..", "uploads", "requisiciones");
const requisitionHeaderLogoPngPath = path.resolve(__dirname, "..", "templates", "logo-requisi.png");
const requisitionHeaderLogoJpegPath = path.resolve(__dirname, "..", "templates", "logo-requisi.jpeg");
const arialRegularPath = "/System/Library/Fonts/Supplemental/Arial.ttf";
const arialBoldPath = "/System/Library/Fonts/Supplemental/Arial Bold.ttf";
const maxAttachmentSizeBytes = 8 * 1024 * 1024;
const maxLineItemImageSizeBytes = 8 * 1024 * 1024;
const requisitionPrintLayout = {
  size: "A4",
  margins: { top: 32, right: 12, bottom: 34, left: 12 },
  bodyMargins: { right: 34, left: 34 },
  header: {
    markerY: 20,
    markerHeight: 18,
    markerRedWidth: 34,
    markerBlueWidth: 18,
    titleY: 76,
    titleFontSize: 14,
    logoY: 9,
    logoWidth: 142,
    logoHeight: 52,
  },
  contentStartY: 106,
  tableStartYOnNewPage: 106,
  footerYOffset: 10,
};

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

let ensureAttachmentsTablePromise = null;
let ensureLineItemImageColumnsPromise = null;

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

const ensureLineItemImageColumns = async () => {
  if (!ensureLineItemImageColumnsPromise) {
    ensureLineItemImageColumnsPromise = (async () => {
      const requiredColumns = [
        ["image_original_name", "VARCHAR(255) NULL"],
        ["image_mime_type", "VARCHAR(120) NULL"],
        ["image_size_bytes", "INT NULL"],
        ["image_file_path", "VARCHAR(500) NULL"],
      ];

      for (const [columnName, columnType] of requiredColumns) {
        const [existsRows] = await pool.query(
          `SHOW COLUMNS FROM line_items LIKE ?`,
          [columnName]
        );
        if (!Array.isArray(existsRows) || !existsRows.length) {
          await pool.query(
            `ALTER TABLE line_items ADD COLUMN ${columnName} ${columnType}`
          );
        }
      }
    })().catch((error) => {
      ensureLineItemImageColumnsPromise = null;
      throw error;
    });
  }

  await ensureLineItemImageColumnsPromise;
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeExt = ext || ".bin";
      const unique = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
      cb(null, `req-${unique}${safeExt}`);
    },
  }),
  limits: {
    fileSize: maxAttachmentSizeBytes,
    files: 5,
  },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || "").toLowerCase();
    const ext = path.extname(String(file.originalname || "")).toLowerCase();
    const isPdf = mime.includes("pdf") || ext === ".pdf";
    const isImage =
      mime.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp"].includes(ext);
    const ok = isPdf || isImage;
    if (!ok) {
      return cb(new Error("Solo se permiten archivos PDF o imágenes (PNG/JPG/WEBP)"));
    }
    return cb(null, true);
  },
});

const lineItemImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeExt = ext || ".bin";
      const unique = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
      cb(null, `line-item-${unique}${safeExt}`);
    },
  }),
  limits: {
    fileSize: maxLineItemImageSizeBytes,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || "").toLowerCase();
    const ext = path.extname(String(file.originalname || "")).toLowerCase();
    const isImage =
      mime.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp"].includes(ext);
    if (!isImage) {
      return cb(new Error("Solo se permiten imágenes (PNG/JPG/WEBP)"));
    }
    return cb(null, true);
  },
});

const resolveStoredUploadPath = (maybePath) => {
  if (!maybePath) return null;
  const raw = String(maybePath || "");
  const normalized = raw.replace(/\\/g, "/");
  const fileName = path.basename(normalized);
  const candidates = [];
  if (path.isAbsolute(raw)) candidates.push(path.resolve(raw));
  if (fileName) candidates.push(path.resolve(uploadsDir, fileName));

  for (const candidate of candidates) {
    if (!candidate.startsWith(uploadsDir)) continue;
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

const safeUnlinkUpload = (maybePath) => {
  try {
    if (!maybePath) return;
    const absPath = resolveStoredUploadPath(maybePath);
    if (!absPath) return;
    if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
  } catch (error) {
    console.error("WARN unlink upload:", error);
  }
};

const parseUserId = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

const getAuthUserId = (req) => parseUserId(req.user?.id);

const ensureSelf = (req, res, requestedUserId) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    res.status(401).json({ ok: false, message: "No autorizado" });
    return false;
  }
  if (authUserId !== parseUserId(requestedUserId)) {
    res.status(403).json({ ok: false, message: "Acceso denegado" });
    return false;
  }
  return true;
};

const getRequisitionOwnerId = async (id, connOrPool = pool) => {
  const [[ownerRow]] = await connOrPool.query(
    `SELECT users_id FROM requisition WHERE id = ? LIMIT 1`,
    [id]
  );
  return parseUserId(ownerRow?.users_id);
};

const ensureOwnsRequisition = async (req, res, requisitionId, connOrPool = pool) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    res.status(401).json({ ok: false, message: "No autorizado" });
    return false;
  }
  const ownerId = await getRequisitionOwnerId(requisitionId, connOrPool);
  if (!ownerId) {
    res.status(404).json({ ok: false, message: "Requisición no encontrada" });
    return false;
  }
  if (ownerId !== authUserId) {
    res.status(403).json({ ok: false, message: "Acceso denegado" });
    return false;
  }
  return true;
};

const ensureCanDownloadSignaturePdf = async (req, res, requisitionId, connOrPool = pool) => {
  const role = String(req.user?.role || "");
  if (role === "head_office" || role === "secretaria") {
    const ownsReq = await ensureOwnsRequisition(req, res, requisitionId, connOrPool);
    if (!ownsReq) return false;

    const [[statusRow]] = await connOrPool.query(
      `
      SELECT r.statuses_id, COALESCE(s.name, '') AS status_name
      FROM requisition r
      LEFT JOIN statuses s ON s.id = r.statuses_id
      WHERE r.id = ?
      LIMIT 1
      `,
      [requisitionId]
    );
    const st = Number(statusRow?.statuses_id || 0);
    const statusName = String(statusRow?.status_name || "").toLowerCase();
    if (st === 11 || statusName.includes("comprad")) {
      res.status(400).json({
        ok: false,
        message: "La requisición ya está en estado comprado/finalizado y no requiere PDF de firmas",
      });
      return false;
    }
    return true;
  }

  if (role === "coordinador") {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      res.status(401).json({ ok: false, message: "No autorizado" });
      return false;
    }

    const [[coordRow]] = await connOrPool.query(
      `SELECT TRIM(ure) AS ure FROM users WHERE id = ? LIMIT 1`,
      [authUserId]
    );
    const coordinatorUre = String(coordRow?.ure || "").trim();
    if (!coordinatorUre) {
      res.status(403).json({ ok: false, message: "Acceso denegado" });
      return false;
    }

    const [[scopeRow]] = await connOrPool.query(
      `
      SELECT r.id, r.statuses_id, COALESCE(s.name, '') AS status_name
      FROM requisition r
      JOIN users u ON u.id = r.users_id
      LEFT JOIN statuses s ON s.id = r.statuses_id
      WHERE r.id = ?
        AND TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(?)), '%')
      LIMIT 1
      `,
      [requisitionId, coordinatorUre]
    );

    if (!scopeRow?.id) {
      res.status(403).json({ ok: false, message: "Acceso denegado" });
      return false;
    }

    const st = Number(scopeRow?.statuses_id || 0);
    const statusName = String(scopeRow?.status_name || "").toLowerCase();
    if (st === 11 || statusName.includes("comprad")) {
      res.status(400).json({
        ok: false,
        message: "La requisición ya está en estado comprado/finalizado y no requiere PDF de firmas",
      });
      return false;
    }
    return true;
  }

  res.status(403).json({ ok: false, message: "Acceso denegado" });
  return false;
};

router.use((req, res, next) => {
  const role = String(req.user?.role || "");
  if (role === "head_office" || role === "coordinador" || role === "secretaria") {
    return next();
  }
  return res.status(403).json({ ok: false, message: "Acceso denegado" });
});

/* Crear requisición */
async function createRequisitionHandler(req, res) {
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
    const folioCorto = `AF-${Math.floor(1000 + Math.random() * 9000)}`;

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
        requisitionId: requisitionId,
        fromStatusId: null,
        toStatusId: 7,
        changedBy: users_id,
        note: "Creación de requisición en borrador",
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
    console.error("ERROR crear requisición:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  } finally {
    conn.release();
  }
}

router.get("/:id/attachments", async (req, res) => {
  try {
    const { id } = req.params;
    const ownsReq = await ensureOwnsRequisition(req, res, id);
    if (!ownsReq) return;
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
  } catch (err) {
    console.error("ERROR list attachments:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
});

router.post("/:id/attachments", upload.array("files", 5), async (req, res) => {
  try {
    const { id } = req.params;
    const ownsReq = await ensureOwnsRequisition(req, res, id);
    if (!ownsReq) return;
    await ensureAttachmentsTable();

    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      return res.status(400).json({ ok: false, message: "No se recibieron archivos" });
    }

    const uploadedBy = getAuthUserId(req);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const f of files) {
        await conn.query(
          `
          INSERT INTO requisition_attachments
            (requisition_id, original_name, stored_name, mime_type, size_bytes, file_path, uploaded_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            Number(id),
            f.originalname || f.filename,
            f.filename,
            String(f.mimetype || "application/octet-stream"),
            Number(f.size || 0),
            f.path,
            uploadedBy || 0,
          ]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    return res.json({ ok: true, uploaded: files.length });
  } catch (err) {
    console.error("ERROR upload attachments:", err);
    const message = err?.message?.includes("Solo se permiten")
      ? err.message
      : "No se pudieron subir los archivos";
    return res.status(400).json({ ok: false, message });
  }
});

router.get("/:id/attachments/:attachmentId/download", async (req, res) => {
  try {
    const { id, attachmentId } = req.params;
    const ownsReq = await ensureOwnsRequisition(req, res, id);
    if (!ownsReq) return;
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
      return res.status(404).json({ ok: false, message: "Adjunto no encontrado" });
    }

    const absPath = path.resolve(String(row.file_path || ""));
    if (!absPath.startsWith(uploadsDir) || !fs.existsSync(absPath)) {
      return res.status(404).json({ ok: false, message: "Archivo no disponible" });
    }

    res.setHeader("Content-Type", row.mime_type || "application/octet-stream");
    return res.download(absPath, row.original_name || "adjunto");
  } catch (err) {
    console.error("ERROR download attachment:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
});

router.delete("/:id/attachments/:attachmentId", async (req, res) => {
  try {
    const { id, attachmentId } = req.params;
    const ownsReq = await ensureOwnsRequisition(req, res, id);
    if (!ownsReq) return;
    await ensureAttachmentsTable();

    const [[row]] = await pool.query(
      `
      SELECT id, file_path
      FROM requisition_attachments
      WHERE id = ? AND requisition_id = ?
      LIMIT 1
      `,
      [attachmentId, id]
    );

    if (!row) {
      return res.status(404).json({ ok: false, message: "Adjunto no encontrado" });
    }

    await pool.query(
      `DELETE FROM requisition_attachments WHERE id = ? AND requisition_id = ?`,
      [attachmentId, id]
    );
    safeUnlinkUpload(row.file_path);

    return res.json({ ok: true });
  } catch (err) {
    console.error("ERROR delete attachment:", err);
    return res.status(500).json({ ok: false, message: "No se pudo eliminar el adjunto" });
  }
});

router.post("/:id/partidas/:lineItemId/image", lineItemImageUpload.single("file"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id, lineItemId } = req.params;
    await ensureLineItemImageColumns();
    const ownsReq = await ensureOwnsRequisition(req, res, id, conn);
    if (!ownsReq) {
      if (req.file?.path) safeUnlinkUpload(req.file.path);
      return;
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ ok: false, message: "Falta la imagen" });
    }

    const [[lineItem]] = await conn.query(
      `
      SELECT id, image_file_path
      FROM line_items
      WHERE id = ? AND requisition_id = ?
      LIMIT 1
      `,
      [lineItemId, id]
    );

    if (!lineItem) {
      safeUnlinkUpload(file.path);
      return res.status(404).json({ ok: false, message: "Partida no encontrada" });
    }

    await conn.query(
      `
      UPDATE line_items
      SET
        image_original_name = ?,
        image_mime_type = ?,
        image_size_bytes = ?,
        image_file_path = ?
      WHERE id = ? AND requisition_id = ?
      `,
      [
        file.originalname || "imagen",
        file.mimetype || "image/*",
        Number(file.size || 0),
        file.path,
        lineItemId,
        id,
      ]
    );

    safeUnlinkUpload(lineItem.image_file_path);

    return res.json({
      ok: true,
      image: {
        original_name: file.originalname || "imagen",
        mime_type: file.mimetype || "image/*",
        size_bytes: Number(file.size || 0),
      },
    });
  } catch (err) {
    if (req.file?.path) safeUnlinkUpload(req.file.path);
    console.error("ERROR upload line item image:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  } finally {
    conn.release();
  }
});

router.get("/:id/partidas/:lineItemId/image", async (req, res) => {
  try {
    const { id, lineItemId } = req.params;
    await ensureLineItemImageColumns();
    const ownsReq = await ensureOwnsRequisition(req, res, id);
    if (!ownsReq) return;

    const [[lineItem]] = await pool.query(
      `
      SELECT image_file_path, image_mime_type, image_original_name
      FROM line_items
      WHERE id = ? AND requisition_id = ?
      LIMIT 1
      `,
      [lineItemId, id]
    );

    if (!lineItem || !lineItem.image_file_path) {
      return res.status(404).json({ ok: false, message: "Imagen no encontrada" });
    }

    const absPath = resolveStoredUploadPath(lineItem.image_file_path);
    if (!absPath) {
      return res.status(404).json({ ok: false, message: "Archivo no disponible" });
    }

    const mime = lineItem.image_mime_type || "application/octet-stream";
    const filename = encodeURIComponent(lineItem.image_original_name || "imagen");
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${filename}`);
    return res.sendFile(absPath);
  } catch (err) {
    console.error("ERROR download line item image:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
});

router.delete("/:id/partidas/:lineItemId/image", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id, lineItemId } = req.params;
    await ensureLineItemImageColumns();
    const ownsReq = await ensureOwnsRequisition(req, res, id, conn);
    if (!ownsReq) return;

    const [[lineItem]] = await conn.query(
      `
      SELECT image_file_path
      FROM line_items
      WHERE id = ? AND requisition_id = ?
      LIMIT 1
      `,
      [lineItemId, id]
    );

    if (!lineItem) {
      return res.status(404).json({ ok: false, message: "Partida no encontrada" });
    }

    await conn.query(
      `
      UPDATE line_items
      SET
        image_original_name = NULL,
        image_mime_type = NULL,
        image_size_bytes = NULL,
        image_file_path = NULL
      WHERE id = ? AND requisition_id = ?
      `,
      [lineItemId, id]
    );

    safeUnlinkUpload(lineItem.image_file_path);

    return res.json({ ok: true });
  } catch (err) {
    console.error("ERROR remove line item image:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  } finally {
    conn.release();
  }
});

router.use("/revision", requireRoles("head_office"));

/* Revisión: data */
router.get("/revision/:id/data", async (req, res) => {
  try {
    return res.status(403).json({
      message: "La revisión de cotización ahora se realiza internamente en Compras.",
    });

    const { id } = req.params;
    const ownsReq = await ensureOwnsRequisition(req, res, id);
    if (!ownsReq) return;
    const [reqRows] = await pool.query(
      `
      SELECT 
        r.id,
        r.request_name,
        r.users_id,
        r.statuses_id,
        r.quotation_closed_at,
        r.quotation_closed_by,
        r.quotation_close_note,
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
        message: "La requisición no está en revisión",
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
    });
  } catch (error) {
    console.error("Error /revision/:id/data:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
});

/* Revisión: guardar selección */
router.post("/revision/:id/select", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    return res.status(403).json({
      message: "La selección de proveedores ahora la realiza Compras Admin.",
    });

    const { id } = req.params;
    const { selections } = req.body;
    const ownsReq = await ensureOwnsRequisition(req, res, id, conn);
    if (!ownsReq) return;

    if (!Array.isArray(selections) || selections.length === 0) {
      return res.status(400).json({ message: "selections es requerido" });
    }

    await conn.beginTransaction();

    const [reqRows] = await conn.query(
      `SELECT id, statuses_id FROM requisition WHERE id = ? FOR UPDATE`,
      [id]
    );

    if (reqRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: "Requisición no encontrada" });
    }

    if (Number(reqRows[0].statuses_id) !== 14) {
      await conn.rollback();
      return res.status(400).json({
        message: "La requisición no está en revisión",
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
      `SELECT provider_id FROM quotation_requests WHERE requisition_id = ?`,
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

      const selected_unit_price =
        s.selected_unit_price === "" || s.selected_unit_price == null
          ? null
          : Number(s.selected_unit_price);

      const selected_description = (s.selected_description ?? "").toString();

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
          changedBy: getAuthUserId(req),
          note: "Selección por partida completa",
        },
        conn
      );
      sent_to_purchase = true;
    }

    await conn.commit();

    if (sent_to_purchase) {
      const comprasIds = await getUsersByRolePrefix("compras_");
      await createNotificationsForUsers(comprasIds, {
        actorUserId: getAuthUserId(req),
        title: "Requisición en proceso de compra",
        message: `La requisición #${id} ya tiene selección completa por partida y pasó a proceso de compra.`,
        entityType: "requisition",
        entityId: Number(id),
        actionPath: `/compras/dashboard`,
      });
    }

    return res.json({
      ok: true,
      sent_to_purchase,
      total,
      selected,
      missing,
      message: sent_to_purchase
        ? "Selección completa. Enviada a compras (proceso de compra)."
        : `Selección guardada. Faltan ${missing} partida(s) por seleccionar.`,
    });
  } catch (error) {
    await conn.rollback();
    console.error("Error /revision/:id/select:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  } finally {
    conn.release();
  }
});

/* Dashboard stats simple */
router.get("/dashboard/:users_id/stats", async (req, res) => {
  try {
    const { users_id } = req.params;
    if (!ensureSelf(req, res, users_id)) return;

    const [rows] = await pool.query(
      `
      SELECT
        SUM(CASE WHEN r.statuses_id = 10 THEN 1 ELSE 0 END) AS rechazadas,
        SUM(CASE WHEN r.statuses_id IN (11, 13) THEN 1 ELSE 0 END) AS aprobadas,
        SUM(CASE WHEN r.statuses_id NOT IN (10, 11, 13) THEN 1 ELSE 0 END) AS pendientes,
        COUNT(*) AS total
      FROM requisition r
      WHERE r.users_id = ?
      `,
      [users_id]
    );

    const stats = rows?.[0] || {};
    return res.json({
      ok: true,
      pendientes: Number(stats.pendientes || 0),
      aprobadas: Number(stats.aprobadas || 0),
      rechazadas: Number(stats.rechazadas || 0),
      total: Number(stats.total || 0),
    });
  } catch (err) {
    console.error("ERROR dashboard stats:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
});

/* Crear */
router.post("/", createRequisitionHandler);

/* Mis requisiciones */
router.get("/mis-requisiciones/:users_id", async (req, res) => {
  try{
    const { users_id } = req.params;
    if (!ensureSelf(req, res, users_id)) return;

    const [rows] = await pool.query(
      `
      SELECT
        r.id,
        r.area_folio,
        r.created_at,
        c.name AS categoria,
        s.id AS statuses_id,
        s.name AS estatus
      FROM requisition r
      JOIN categories c ON r.categories_id = c.id
      JOIN statuses s ON r.statuses_id = s.id
      WHERE r.users_id = ?
      ORDER BY r.created_at DESC
      `,
      [users_id]
    );
    return res.json(rows);
  } catch (err) {
    console.error("ERROR mis-requisiciones:", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

/* Enviar (solo borrador -> coordinación) */
router.patch("/:id/enviar", async (req, res) => {
  try {
    const { id } = req.params;
    const ownsReq = await ensureOwnsRequisition(req, res, id);
    if (!ownsReq) return;

    const [[row]] = await pool.query(
      `SELECT notes FROM requisition WHERE id = ? AND statuses_id = 7 LIMIT 1`,
      [id]
    );
    const currentNote = String(row?.notes || "");
    const requestedResume = Number(req.body?.resume_to || 0);
    const actorRole = String(req.user?.role || "");

    let resumeTo = 8;
    if (actorRole === "secretaria") {
      // Flujo de Secretaría: sale de borrador directo a Compras.
      resumeTo = 12;
    } else if (currentNote.startsWith("AJUSTE_COORDINACION:")) {
      resumeTo = 8;
    } else if (currentNote.startsWith("AJUSTE_SECRETARIA:")) {
      resumeTo = 9;
    } else if (currentNote.startsWith("AJUSTE_COMPRAS:")) {
      resumeTo = 12;
    } else if (!currentNote.startsWith("AJUSTE_")) {
      if (requestedResume === 12) resumeTo = 12;
      else if (requestedResume === 9) resumeTo = 9;
      else resumeTo = 8;
    }

    const [result] = await pool.query(
      `
      UPDATE requisition
      SET statuses_id = ?, notes = NULL, sent_on = COALESCE(sent_on, NOW())
      WHERE id = ? AND statuses_id = 7
      `,
      [resumeTo, id]
    );

    if (!result.affectedRows) {
      return res.status(400).json({ ok: false, message: "No se puede enviar" });
    }

    await logRequisitionStatusChange({
      requisitionId: id,
      fromStatusId: 7,
      toStatusId: resumeTo,
      changedBy: getAuthUserId(req),
      note: "Envío de borrador",
    });

    const actorId = getAuthUserId(req);
    if (resumeTo === 8) {
      const coordinatorIds = await getCoordinatorUsersForRequisition(id);
      await createNotificationsForUsers(coordinatorIds, {
        actorUserId: actorId,
        title: "Requisición en Coordinación",
        message: `La requisición #${id} fue enviada para revisión de Coordinación.`,
        entityType: "requisition",
        entityId: Number(id),
        actionPath: `/coordinador/requisiciones?openReq=${id}`,
      });
    } else if (resumeTo === 9) {
      const secretariaIds = await getUsersByRole("secretaria");
      await createNotificationsForUsers(secretariaIds, {
        actorUserId: actorId,
        title: "Requisición en Secretaría",
        message: `La requisición #${id} fue reenviada a Secretaría para revisión.`,
        entityType: "requisition",
        entityId: Number(id),
        actionPath: `/secretaria/recibidas?openReq=${id}`,
      });
    } else if (resumeTo === 12) {
      const comprasIds = await getUsersByRolePrefix("compras_");
      await createNotificationsForUsers(comprasIds, {
        actorUserId: actorId,
        title: "Requisición en Compras",
        message: `La requisición #${id} fue reenviada a Compras para cotización.`,
        entityType: "requisition",
        entityId: Number(id),
        actionPath: "/compras/dashboard",
      });
    }

    return res.json({
      ok: true,
      statuses_id: resumeTo,
      status:
        resumeTo === 12
          ? "En cotización"
          : resumeTo === 9
          ? "En secretaría"
          : "En coordinación",
    });
  } catch (err) {
    console.error("ERROR enviar:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
});

/* PDF para firma (URE solicitante) */
router.get("/:id/pdf-firma", async (req, res) => {
  try {
    const { id } = req.params;
    const canDownload = await ensureCanDownloadSignaturePdf(req, res, id);
    if (!canDownload) return;

    const [rows] = await pool.query(
      `
      SELECT
        r.id,
        r.request_name,
        r.justification,
        r.observation,
        r.notes,
        r.created_at,
        r.statuses_id,
        c.name AS categoria,
        s.name AS estatus,
        u.name AS solicitante,
        u.role AS solicitante_role,
        u.ure AS ure_solicitante,
        COALESCE(NULLIF(TRIM(ho.name), ''), u.ure, 'URE') AS dependencia_solicitante,
        COALESCE(NULLIF(TRIM(c2.name), ''), NULLIF(TRIM(c2.ure), ''), 'Área ejecutora') AS coordinacion_dependencia,
        COALESCE(NULLIF(TRIM(sec.name), ''), NULLIF(TRIM(sec.ure), ''), 'Secretaría administrativa') AS secretaria_dependencia,
        COALESCE(NULLIF(TRIM(coord_user.name), ''), NULLIF(TRIM(c.name), ''), 'Coordinación') AS coordinador_firma,
        COALESCE(NULLIF(TRIM(sec_user.name), ''), NULLIF(TRIM(sec.name), ''), 'Secretaría') AS secretaria_firma
      FROM requisition r
      JOIN categories c ON r.categories_id = c.id
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
      LEFT JOIN coordination c2
        ON c2.id = COALESCE(
          ho.coordination_id,
          (
            SELECT c3.id
            FROM coordination c3
            WHERE TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(c3.ure)), '%')
            ORDER BY LENGTH(TRIM(c3.ure)) DESC
            LIMIT 1
          )
        )
      LEFT JOIN users coord_user
        ON coord_user.id = (
          SELECT cu.id
          FROM users cu
          WHERE cu.role = 'coordinador'
            AND COALESCE(cu.statuses_id, 1) = 1
            AND (
              (c2.ure IS NOT NULL AND TRIM(UPPER(cu.ure)) = TRIM(UPPER(c2.ure)))
              OR TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(cu.ure)), '%')
            )
          ORDER BY
            CASE
              WHEN c2.ure IS NOT NULL AND TRIM(UPPER(cu.ure)) = TRIM(UPPER(c2.ure)) THEN 0
              ELSE 1
            END,
            LENGTH(TRIM(cu.ure)) DESC,
            cu.id ASC
          LIMIT 1
        )
      LEFT JOIN secretary sec
        ON sec.id = (
          SELECT s2.id
          FROM secretary s2
          WHERE
            (c2.ure IS NOT NULL AND TRIM(UPPER(s2.ure)) = TRIM(UPPER(c2.ure)))
            OR TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(s2.ure)), '%')
          ORDER BY
            CASE WHEN c2.ure IS NOT NULL AND TRIM(UPPER(s2.ure)) = TRIM(UPPER(c2.ure)) THEN 0 ELSE 1 END,
            LENGTH(TRIM(s2.ure)) DESC,
            s2.id ASC
          LIMIT 1
        )
      LEFT JOIN users sec_user
        ON sec_user.id = (
          SELECT su.id
          FROM users su
          WHERE su.role = 'secretaria'
            AND COALESCE(su.statuses_id, 1) = 1
            AND (
              (sec.ure IS NOT NULL AND TRIM(UPPER(su.ure)) = TRIM(UPPER(sec.ure)))
              OR (c2.ure IS NOT NULL AND TRIM(UPPER(su.ure)) = TRIM(UPPER(c2.ure)))
              OR TRIM(UPPER(u.ure)) LIKE CONCAT(TRIM(UPPER(su.ure)), '%')
            )
          ORDER BY
            CASE
              WHEN sec.ure IS NOT NULL AND TRIM(UPPER(su.ure)) = TRIM(UPPER(sec.ure)) THEN 0
              WHEN c2.ure IS NOT NULL AND TRIM(UPPER(su.ure)) = TRIM(UPPER(c2.ure)) THEN 1
              ELSE 2
            END,
            LENGTH(TRIM(su.ure)) DESC,
            su.id ASC
          LIMIT 1
        )
      WHERE r.id = ?
      LIMIT 1
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, message: "Requisición no encontrada" });
    }

    const reqRow = rows[0];
    const st = Number(reqRow.statuses_id || 0);
    const printableStatuses = new Set([12, 13, 14, 11]);
    if (!printableStatuses.has(st)) {
      return res.status(409).json({
        ok: false,
        message: "El PDF de firma se habilita cuando la requisición ya está en cotización o etapa posterior",
      });
    }

    const [items] = await pool.query(
      `
      SELECT li.product_name, li.description, li.quantity, un.name AS unidad
      FROM line_items li
      LEFT JOIN units un ON li.units_id = un.id
      WHERE li.requisition_id = ?
      ORDER BY li.id ASC
      `,
      [id]
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Requisicion_${Number(id)}_Firmas.pdf"`);

    const doc = new PDFDocument({
      size: requisitionPrintLayout.size,
      margins: requisitionPrintLayout.margins,
      bufferPages: true,
    });
    doc.pipe(res);
    const canUseArial = fs.existsSync(arialRegularPath) && fs.existsSync(arialBoldPath);
    if (canUseArial) {
      doc.registerFont("Simco-Regular", arialRegularPath);
      doc.registerFont("Simco-Bold", arialBoldPath);
    }
    const fontRegular = canUseArial ? "Simco-Regular" : "Helvetica";
    const fontBold = canUseArial ? "Simco-Bold" : "Helvetica-Bold";

    const safe = (v) => String(v || "").trim();
    const safeUpper = (v) => safe(v).toUpperCase();
    const createdAt = reqRow.created_at
      ? new Date(reqRow.created_at).toLocaleDateString("es-MX", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
      : "—";
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const headerX = 0;
    const headerW = pageWidth;
    const contentX = requisitionPrintLayout.bodyMargins.left;
    const contentW = pageWidth - requisitionPrintLayout.bodyMargins.left - requisitionPrintLayout.bodyMargins.right;
    const headerFill = "#002060";
    const border = "#3D3D3D";
    const text = "#111111";
    const brandBlue = "#002060";
    const brandRed = "#E20000";
    const mainTitleY = requisitionPrintLayout.header.titleY;

    const drawFixedHeader = () => {
      const markerX = headerX + 2;
      const markerY = requisitionPrintLayout.header.markerY;
      const markerH = requisitionPrintLayout.header.markerHeight;
      const markerRedW = requisitionPrintLayout.header.markerRedWidth;
      const markerBlueW = requisitionPrintLayout.header.markerBlueWidth;
      doc.rect(markerX, markerY, markerRedW, markerH).fill(brandRed);
      doc.rect(markerX + markerRedW, markerY, markerBlueW, markerH).fill(brandBlue);

      doc
        .fontSize(requisitionPrintLayout.header.titleFontSize)
        .fillColor(text)
        .font(fontBold)
        .text("REQUISICIÓN DE ARTÍCULOS Y/O SERVICIOS", headerX + 6, mainTitleY, {
          width: headerW - (requisitionPrintLayout.header.logoWidth + 18),
          align: "center",
        });

      const logoPath = fs.existsSync(requisitionHeaderLogoPngPath)
        ? requisitionHeaderLogoPngPath
        : fs.existsSync(requisitionHeaderLogoJpegPath)
        ? requisitionHeaderLogoJpegPath
        : null;
      if (logoPath) {
        try {
          doc.image(
            logoPath,
            headerX + headerW - requisitionPrintLayout.header.logoWidth - 2,
            requisitionPrintLayout.header.logoY,
            {
              fit: [requisitionPrintLayout.header.logoWidth, requisitionPrintLayout.header.logoHeight],
              align: "right",
              valign: "top",
            }
          );
          return;
        } catch {
          // fallback a texto
        }
      }

      doc
        .fontSize(10)
        .font(fontBold)
        .text("CUAltos", headerX + headerW - 94, mainTitleY - 2, { width: 90, align: "right" });
      doc
        .fontSize(7)
        .font(fontRegular)
        .fillColor("#666666")
        .text("Centro Universitario de los Altos", headerX + headerW - 118, mainTitleY + 11, {
          width: 114,
          align: "right",
        });
    };

    doc.rect(0, 0, pageWidth, pageHeight).fill("#FFFFFF");
    drawFixedHeader();
    doc.on("pageAdded", () => {
      drawFixedHeader();
    });

    const drawCell = (x, y, w, h, label, opts = {}) => {
      const fill = opts.fill || null;
      if (fill) {
        doc.rect(x, y, w, h).fill(fill);
      }
      doc.rect(x, y, w, h).lineWidth(1).strokeColor(border).stroke();
      const labelColor = opts.textColor || (fill ? "#FFFFFF" : text);
      doc
        .fillColor(labelColor)
        .font(opts.bold ? fontBold : fontRegular)
        .fontSize(opts.fontSize || 9)
        .text(String(label || ""), x + 4, y + 4, {
          width: w - 8,
          align: opts.align || "left",
        });
    };

    let y = requisitionPrintLayout.contentStartY;
    const leftW = Math.round(contentW * 0.79);
    const rightW = contentW - leftW - 10;
    const rightX = contentX + leftW + 10;

    drawCell(contentX, y, leftW, 18, safeUpper(reqRow.dependencia_solicitante || "DEPENDENCIA SOLICITANTE"), {
      fill: headerFill,
      bold: true,
      align: "center",
      fontSize: 8,
    });
    drawCell(contentX, y + 18, leftW, 18, safeUpper(reqRow.secretaria_dependencia || "SECRETARÍA ADMINISTRATIVA"), {
      bold: true,
      align: "center",
      fontSize: 8,
    });
    drawCell(contentX, y + 36, leftW, 18, safeUpper(reqRow.coordinacion_dependencia || "ÁREA EJECUTORA"), {
      fill: headerFill,
      bold: true,
      align: "center",
      fontSize: 8,
    });
    drawCell(rightX, y, rightW, 18, "SOLICITUD", {
      fill: headerFill,
      bold: true,
      align: "center",
      fontSize: 9,
    });
    drawCell(rightX, y + 18, rightW, 18, "", {
      bold: true,
      align: "center",
      fontSize: 8,
    });
    drawCell(rightX, y + 36, rightW, 18, createdAt, {
      bold: true,
      align: "center",
      fontSize: 8,
    });

    y += 74;
    const labelW = 74;
    drawCell(contentX, y, labelW, 18, "ETIQUETA", {
      fill: headerFill,
      bold: true,
      align: "center",
      fontSize: 8,
    });
    drawCell(contentX + labelW, y, contentW - labelW, 18, "", {
      fontSize: 9,
    });

    y += 32;
    const colPartida = 45;
    const colDesc = Math.round(contentW * 0.57);
    const colCant = 66;
    const colObs = contentW - colPartida - colDesc - colCant;
    const drawItemsTableHeader = (topY) => {
      drawCell(contentX, topY, colPartida, 30, "No\nPARTIDA", {
        fill: headerFill,
        bold: true,
        align: "center",
        fontSize: 8,
      });
      drawCell(contentX + colPartida, topY, colDesc, 30, "DESCRIPCIÓN", {
        fill: headerFill,
        bold: true,
        align: "center",
        fontSize: 8,
      });
      drawCell(contentX + colPartida + colDesc, topY, colCant, 30, "CANTIDAD\n(UDM)", {
        fill: headerFill,
        bold: true,
        align: "center",
        fontSize: 8,
      });
      drawCell(contentX + colPartida + colDesc + colCant, topY, colObs, 30, "OBSERVACIÓN", {
        fill: headerFill,
        bold: true,
        align: "center",
        fontSize: 8,
      });
      return topY + 30;
    };
    y = drawItemsTableHeader(y);

    const maxRows = Math.max(5, items.length);
    const rowH = 24;
    const tableStartYOnNewPage = requisitionPrintLayout.tableStartYOnNewPage;
    const pageBottomLimit = pageHeight - doc.page.margins.bottom - 20;
    for (let i = 0; i < maxRows; i += 1) {
      if (y + rowH > pageBottomLimit) {
        doc.addPage();
        y = drawItemsTableHeader(tableStartYOnNewPage);
      }
      const it = items[i];
      const desc = it ? safe(it.description) || safe(it.product_name) || "—" : "";
      const qtyRaw = it ? Number(it.quantity || 0) : "";
      const qty = qtyRaw === "" ? "" : Number.isFinite(qtyRaw) ? String(qtyRaw) : "";
      drawCell(contentX, y, colPartida, rowH, it ? String(i + 1) : "", {
        align: "center",
        fontSize: 9,
      });
      drawCell(contentX + colPartida, y, colDesc, rowH, desc, { fontSize: 8 });
      drawCell(contentX + colPartida + colDesc, y, colCant, rowH, qty, {
        align: "center",
        fontSize: 9,
      });
      drawCell(contentX + colPartida + colDesc + colCant, y, colObs, rowH, "", {
        fontSize: 8,
      });
      y += rowH;
    }

    const requiredAfterTable = 280;
    if (y + requiredAfterTable > pageBottomLimit) {
      doc.addPage();
      y = requisitionPrintLayout.contentStartY;
    }

    const justificationText = safe(reqRow.justification) || "—";
    const reasonText = safe(reqRow.observation) || safe(reqRow.justification) || "—";

    y += 18;
    drawCell(contentX, y, contentW, 18, "JUSTIFICACIÓN", {
      fill: headerFill,
      bold: true,
      align: "center",
      fontSize: 11,
    });
    y += 18;
    drawCell(contentX, y, contentW, 34, justificationText, {
      fontSize: 9,
    });
    y += 42;

    drawCell(contentX, y, contentW, 18, "MOTIVO", {
      fill: headerFill,
      bold: true,
      align: "center",
      fontSize: 11,
    });
    y += 18;
    drawCell(contentX, y, contentW, 34, reasonText, {
      fontSize: 9,
    });
    y += 42;

    const drawLabeledValueRow = (topY, label, opts = {}) => {
      const leftW = opts.leftW || 92;
      const rowH = opts.rowH || 22;
      const labelFont = opts.labelFont || 9;
      drawCell(contentX, topY, leftW, rowH, label, {
        fill: headerFill,
        bold: true,
        align: "center",
        fontSize: labelFont,
      });
      drawCell(contentX + leftW, topY, contentW - leftW, rowH, "", {
        fontSize: 9,
      });
      return topY + rowH;
    };

    y += 8;
    y = drawLabeledValueRow(y, "PROYECTO");
    y = drawLabeledValueRow(y, "FONDO");
    y = drawLabeledValueRow(y, "PROGRAMA\nESTRATÉGICO", { rowH: 30, labelFont: 8 });
    y += 8;

    const dependenciaSolicitanteFirma =
      safe(reqRow.dependencia_solicitante) || "Unidad Solicitante";
    const coordinacionFirma =
      safe(reqRow.coordinacion_dependencia) || "Área Ejecutora";
    const secretariaFirma =
      safe(reqRow.secretaria_dependencia) || "Secretaría Administrativa";

    const requesterRole = safe(reqRow.solicitante_role).toLowerCase();
    const signatures = [];
    const addSignature = (name, role) => {
      const cleanName = safe(name);
      const cleanRole = safe(role);
      if (!cleanName || !cleanRole) return;
      const exists = signatures.some(
        (sig) =>
          safe(sig.name).toLowerCase() === cleanName.toLowerCase() &&
          safe(sig.role).toLowerCase() === cleanRole.toLowerCase()
      );
      if (!exists) signatures.push({ name: cleanName, role: cleanRole });
    };

    if (requesterRole === "coordinador") {
      addSignature(
        safe(reqRow.solicitante) || safe(reqRow.coordinador_firma) || "Coordinador",
        `Coordinador (${coordinacionFirma})`
      );
      addSignature(
        safe(reqRow.secretaria_firma) || "Secretario Académico",
        "Secretario Académico"
      );
    } else if (requesterRole === "secretaria") {
      addSignature(
        safe(reqRow.solicitante) || safe(reqRow.secretaria_firma) || "Secretario Académico",
        "Secretario Académico"
      );
    } else {
      addSignature(
        safe(reqRow.solicitante) || "Solicitante",
        `Jefe de Unidad (${dependenciaSolicitanteFirma})`
      );
      addSignature(
        safe(reqRow.coordinador_firma) || "Coordinador",
        `Coordinador (${coordinacionFirma})`
      );
      addSignature(
        safe(reqRow.secretaria_firma) || "Secretario Académico",
        "Secretario Académico"
      );
    }
    const fixedSignatures = [
      {
        name: "Mtro. Juan Jerónimo Centeno Quevedo",
        role: "Jefe de Unidad de Adquisiciones y Suministros",
      },
      {
        name: "Mtro. Fernando Falcón López",
        role: "Secretario Administrativo",
      },
    ];

    const drawSignatureRow = (list, top, width) => {
      const count = list.length;
      if (!count) return;
      const gap = count > 1 ? Math.round((contentW - width * count) / (count - 1)) : 0;
      list.forEach((sig, idx) => {
        const sx = contentX + idx * (width + gap);
        doc.moveTo(sx, top).lineTo(sx + width, top).strokeColor("#3A3A3A").lineWidth(1).stroke();
        doc
          .fontSize(8)
          .font(fontBold)
          .fillColor(text)
          .text(sig.name, sx, top + 6, { width, align: "center" });
        doc
          .fontSize(8)
          .font(fontRegular)
          .text(sig.role, sx, top + 18, { width, align: "center" });
      });
    };

    const firstRowTop = Math.max(y + 34, pageHeight - 220);
    drawSignatureRow(signatures, firstRowTop, 155);

    const secondRowTop = firstRowTop + 98;
    drawSignatureRow(fixedSignatures, secondRowTop, 220);

    const { start, count } = doc.bufferedPageRange();
    for (let i = 0; i < count; i += 1) {
      const pageIndex = start + i;
      const pageNumber = i + 1;
      doc.switchToPage(pageIndex);
      const footerY = doc.page.height - doc.page.margins.bottom - requisitionPrintLayout.footerYOffset;
      doc
        .font(fontRegular)
        .fontSize(8)
        .fillColor("#5A5A5A")
        .text(`Página ${pageNumber} de ${count}`, doc.page.margins.left, footerY, {
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
          align: "center",
          lineBreak: false,
        });
    }

    doc.end();
  } catch (err) {
    console.error("ERROR pdf-firma:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
});

/* Obtener requisición + partidas */
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const ownsReq = await ensureOwnsRequisition(req, res, id);
    if (!ownsReq) return;

    const [[requisicion]] = await pool.query(
      `
      SELECT
        r.id,
        r.notes,
        r.request_name,
        r.justification,
        r.observation,
        c.name AS categoria,
        r.statuses_id,
        s.name AS estatus,
        u.name AS solicitante,
        u.ure AS ure
      FROM requisition r
      JOIN categories c ON r.categories_id = c.id
      JOIN statuses s ON r.statuses_id = s.id
      JOIN users u ON r.users_id = u.id
      WHERE r.id = ?
      `,
      [id]
    );

    if (!requisicion) return res.status(404).json({ ok: false, message: "No encontrada" });

    await ensureLineItemImageColumns();
    const [partidas] = await pool.query(
      `
      SELECT
        id,
        product_name,
        description,
        quantity,
        units_id,
        image_original_name,
        image_mime_type,
        image_size_bytes
      FROM line_items
      WHERE requisition_id = ?
      `,
      [id]
    );

    await ensureAttachmentsTable();
    const [attachments] = await pool.query(
      `
      SELECT id, original_name, mime_type, size_bytes, created_at
      FROM requisition_attachments
      WHERE requisition_id = ?
      ORDER BY created_at DESC, id DESC
      `,
      [id]
    );

    return res.json({ ...requisicion, partidas, attachments });
  } catch (err) {
    console.error("ERROR get requisicion:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
});

router.get("/:id/timeline", async (req, res) => {
  try {
    const { id } = req.params;
    const ownsReq = await ensureOwnsRequisition(req, res, id);
    if (!ownsReq) return;

    const [[requisition]] = await pool.query(
      `
      SELECT id, created_at, sent_on, quotation_closed_at, statuses_id
      FROM requisition
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );
    if (!requisition) {
      return res.status(404).json({ ok: false, message: "No encontrada" });
    }

    const statusTimeline = await getRequisitionStatusTimeline(id);
    return res.json({ ok: true, requisition, statusTimeline });
  } catch (err) {
    console.error("ERROR timeline requisicion:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
});

/* Editar requisición + partidas (solo borrador) */
router.put("/:id", async (req, res) => {
  const conn = await pool.getConnection();
  const { id } = req.params;
  const { notes, request_name, justification, observation, partidas } = req.body;

  try {
    await ensureLineItemImageColumns();
    const ownsReq = await ensureOwnsRequisition(req, res, id, conn);
    if (!ownsReq) return;

    await conn.beginTransaction();

    const role = String(req.user?.role || "");
    const canEditInCoordination = role === "coordinador";
    const editableStatuses = canEditInCoordination ? [7, 8] : [7];
    const statusPlaceholders = editableStatuses.map(() => "?").join(", ");

    const [updateReqResult] = await conn.query(
      `
      UPDATE requisition
      SET
        notes = COALESCE(?, notes),
        request_name = ?,
        justification = ?,
        observation = ?
      WHERE id = ? AND statuses_id IN (${statusPlaceholders})
      `,
      [notes, request_name, justification, observation, id, ...editableStatuses]
    );

    if (!updateReqResult?.affectedRows) {
      await conn.rollback();
      return res.status(400).json({
        ok: false,
        message: "La requisición no está en un estatus editable para este perfil",
        editable_statuses: editableStatuses,
      });
    }

    const [actuales] = await conn.query(`SELECT id FROM line_items WHERE requisition_id = ?`, [id]);
    const idsActuales = actuales.map((p) => Number(p.id)).filter((v) => Number.isInteger(v) && v > 0);
    const idsRecibidos = (partidas || [])
      .map((p) => Number(p?.id || 0))
      .filter((v) => Number.isInteger(v) && v > 0);

    const eliminar = idsActuales.filter((x) => !idsRecibidos.includes(x));
    let deletedImagePaths = [];
    if (eliminar.length) {
      const [toDeleteRows] = await conn.query(
        `
        SELECT image_file_path
        FROM line_items
        WHERE requisition_id = ? AND id IN (?)
        `,
        [id, eliminar]
      );
      deletedImagePaths = (toDeleteRows || []).map((row) => row.image_file_path).filter(Boolean);
      await conn.query(`DELETE FROM line_items WHERE requisition_id = ? AND id IN (?)`, [id, eliminar]);
    }

    const orderedIds = [];
    for (const p of partidas || []) {
      if (p.id) {
        const partidaId = Number(p.id);
        if (!Number.isInteger(partidaId) || partidaId <= 0) {
          throw Object.assign(new Error("Partida inválida"), { statusCode: 400 });
        }
        const [updateResult] = await conn.query(
          `
          UPDATE line_items
          SET product_name=?, description=?, quantity=?, units_id=?
          WHERE id=? AND requisition_id=?
          `,
          [p.product_name, p.description, p.quantity, p.units_id, partidaId, id]
        );
        if (!updateResult?.affectedRows) {
          throw Object.assign(new Error("Partida no encontrada en la requisición"), { statusCode: 400 });
        }
        orderedIds.push(partidaId);
      } else {
        const [insertResult] = await conn.query(
          `
          INSERT INTO line_items
            (product_name, description, quantity, units_id, requisition_id)
          VALUES (?, ?, ?, ?, ?)
          `,
          [p.product_name, p.description, p.quantity, p.units_id, id]
        );
        orderedIds.push(Number(insertResult.insertId));
      }
    }

    let partidasActualizadas = [];
    if (orderedIds.length) {
      const [rows] = await conn.query(
        `
        SELECT
          id,
          product_name,
          description,
          quantity,
          units_id,
          image_original_name,
          image_mime_type,
          image_size_bytes
        FROM line_items
        WHERE requisition_id = ? AND id IN (?)
        `,
        [id, orderedIds]
      );

      const byId = new Map(rows.map((row) => [Number(row.id), row]));
      partidasActualizadas = orderedIds
        .map((lineId) => byId.get(Number(lineId)))
        .filter(Boolean);
    }

    await conn.commit();
    deletedImagePaths.forEach(safeUnlinkUpload);
    return res.json({ ok: true, partidas: partidasActualizadas });
  } catch (err) {
    await conn.rollback();
    if (Number(err?.statusCode) >= 400 && Number(err?.statusCode) < 500) {
      return res.status(err.statusCode).json({ ok: false, message: err.message || "Datos inválidos" });
    }
    console.error("ERROR editar requisición:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  } finally {
    conn.release();
  }
});

export default router;
