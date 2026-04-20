import { cleanupOrphanRequisitionUploads } from "../services/uploadsCleanup.js";
import { pool } from "../db/connection.js";

const argFlag = (name) => process.argv.includes(name);
const argValue = (name, fallback) => {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
};

const dryRun = !argFlag("--delete");
const graceMinutes = Number(argValue("--grace-minutes", process.env.CLEANUP_UPLOADS_GRACE_MINUTES || "120"));
const maxDelete = Number(argValue("--max-delete", process.env.CLEANUP_UPLOADS_MAX_DELETE || "200"));

try {
  const summary = await cleanupOrphanRequisitionUploads({
    dryRun,
    graceMinutes,
    maxDelete,
  });
  console.log("[cleanup] summary:", summary);
} catch (error) {
  console.error("[cleanup] error:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
