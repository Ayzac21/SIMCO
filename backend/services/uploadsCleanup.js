import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../db/connection.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const requisitionUploadsDir = path.resolve(__dirname, "..", "uploads", "requisiciones");

const toPositiveInt = (value, fallback) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

const normalizeInUploadsDir = (rawPath) => {
  if (!rawPath) return null;
  const absPath = path.resolve(String(rawPath));
  if (!absPath.startsWith(requisitionUploadsDir)) return null;
  return absPath;
};

const getReferencedUploadPaths = async () => {
  const referenced = new Set();

  // Puede no existir en instalaciones antiguas; ignoramos si falla.
  try {
    const [attachmentRows] = await pool.query(
      `SELECT file_path FROM requisition_attachments WHERE file_path IS NOT NULL`
    );
    for (const row of attachmentRows || []) {
      const normalized = normalizeInUploadsDir(row?.file_path);
      if (normalized) referenced.add(normalized);
    }
  } catch {}

  // Puede no existir columna en instalaciones antiguas; ignoramos si falla.
  try {
    const [lineItemRows] = await pool.query(
      `SELECT image_file_path FROM line_items WHERE image_file_path IS NOT NULL`
    );
    for (const row of lineItemRows || []) {
      const normalized = normalizeInUploadsDir(row?.image_file_path);
      if (normalized) referenced.add(normalized);
    }
  } catch {}

  return referenced;
};

export const cleanupOrphanRequisitionUploads = async ({
  dryRun = true,
  graceMinutes = 120,
  maxDelete = 200,
  logger = console,
} = {}) => {
  const graceMs = toPositiveInt(graceMinutes, 120) * 60 * 1000;
  const maxDeleteCount = toPositiveInt(maxDelete, 200);
  const now = Date.now();

  const summary = {
    scanned: 0,
    referenced: 0,
    orphanCandidates: 0,
    deleted: 0,
    skippedRecent: 0,
    errors: 0,
    dryRun: Boolean(dryRun),
  };

  let dirEntries = [];
  try {
    dirEntries = await fs.readdir(requisitionUploadsDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      logger.info?.("[cleanup] uploads dir no existe; nada que limpiar");
      return summary;
    }
    throw error;
  }

  const referenced = await getReferencedUploadPaths();
  summary.referenced = referenced.size;

  for (const entry of dirEntries) {
    if (!entry.isFile()) continue;
    summary.scanned += 1;

    const absPath = path.resolve(requisitionUploadsDir, entry.name);
    if (referenced.has(absPath)) continue;

    let stat;
    try {
      stat = await fs.stat(absPath);
    } catch {
      summary.errors += 1;
      continue;
    }

    if (now - stat.mtimeMs < graceMs) {
      summary.skippedRecent += 1;
      continue;
    }

    summary.orphanCandidates += 1;
    if (summary.deleted >= maxDeleteCount) continue;
    if (dryRun) continue;

    try {
      await fs.unlink(absPath);
      summary.deleted += 1;
    } catch {
      summary.errors += 1;
    }
  }

  const mode = dryRun ? "DRY_RUN" : "DELETE";
  logger.info?.(
    `[cleanup:${mode}] scanned=${summary.scanned} referenced=${summary.referenced} candidates=${summary.orphanCandidates} deleted=${summary.deleted} skippedRecent=${summary.skippedRecent} errors=${summary.errors}`
  );

  return summary;
};
