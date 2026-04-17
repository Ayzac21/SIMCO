import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const cwd = process.cwd();
dotenv.config({ path: path.resolve(cwd, ".env") });

const sourceDb = String(process.env.DB_NAME || "Compras");
const host = String(process.env.DB_HOST || "localhost")
  .trim()
  .replace(/^https?:\/\//, "")
  .replace(/\/+$/, "");
const port = Number.parseInt(process.env.DB_PORT || "3306", 10) || 3306;
const user = process.env.DB_USER || "root";
const password = process.env.DB_PASSWORD || "";

const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
const compactStamp = runStamp.replace(/[^0-9]/g, "").slice(0, 14);
const tempDb = `${sourceDb}_compat_${compactStamp}`;
const outDir = path.resolve(cwd, "sql");
const outFile = path.join(outDir, `902_local_full_compatible_${runStamp}.sql`);

const schemaBasePath = path.resolve(cwd, "sql", "001_schema_base.sql");

const qid = (name) => `\`${String(name).replace(/`/g, "``")}\``;

const conn = await mysql.createConnection({
  host,
  port,
  user,
  password,
  multipleStatements: true,
});

const hasTable = async (dbName, tableName) => {
  const [rows] = await conn.query(
    `
      SELECT 1
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      LIMIT 1
    `,
    [dbName, tableName]
  );
  return rows.length > 0;
};

const hasColumn = async (dbName, tableName, columnName) => {
  const [rows] = await conn.query(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [dbName, tableName, columnName]
  );
  return rows.length > 0;
};

const run = async (sql) => {
  await conn.query(sql);
};

try {
  if (!(await hasTable(sourceDb, "requisition"))) {
    throw new Error(`No se encontro la tabla requisition en la base origen "${sourceDb}".`);
  }

  await run(`DROP DATABASE IF EXISTS ${qid(tempDb)};`);
  await run(
    `CREATE DATABASE ${qid(tempDb)} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`
  );
  await run(`USE ${qid(tempDb)};`);

  const schemaBaseSql = await fs.readFile(schemaBasePath, "utf8");
  await run(schemaBaseSql);
  await run(`
    CREATE TABLE IF NOT EXISTS requisition_status_history (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      requisition_id INT NOT NULL,
      from_status_id INT NULL,
      to_status_id INT NOT NULL,
      changed_by BIGINT NULL,
      change_note TEXT NULL,
      changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_rsh_req_changed (requisition_id, changed_at),
      INDEX idx_rsh_to_status (to_status_id),
      CONSTRAINT fk_rsh_req FOREIGN KEY (requisition_id) REFERENCES requisition(id) ON DELETE CASCADE,
      CONSTRAINT fk_rsh_changed_by FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  const lineItemsReqCol =
    (await hasColumn(sourceDb, "line_items", "requisition_id")) ? "requisition_id" : "Requisition_id";
  const hasUserCreatedAt = await hasColumn(sourceDb, "users", "created_at");
  const hasProviderCreatedAt = await hasColumn(sourceDb, "provider", "created_at");
  const hasLineUnit = await hasColumn(sourceDb, "line_items", "unit");
  const hasLineEstimatedPrice = await hasColumn(sourceDb, "line_items", "estimated_price");
  const hasQrNotes = await hasColumn(sourceDb, "quotation_requests", "notes");
  const hasQrId = await hasColumn(sourceDb, "quotation_requests", "id");
  const hasQpOfferedDescription = await hasColumn(sourceDb, "quotation_prices", "offered_description");
  const hasQsVat = await hasColumn(sourceDb, "quotation_selections", "selected_vat_percentage");
  const hasQsIsr = await hasColumn(sourceDb, "quotation_selections", "selected_isr_percentage");
  const hasSecretaryCoordinationId = await hasColumn(sourceDb, "secretary", "coordination_id");
  const hasCoordinationSecretaryId = await hasColumn(sourceDb, "coordination", "secretary_id");

  await run(`
    INSERT INTO ${qid(tempDb)}.statuses (id, name)
    SELECT s.id, COALESCE(NULLIF(s.name, ''), CONCAT('Estatus ', s.id))
    FROM ${qid(sourceDb)}.statuses s
    ORDER BY s.id;
  `);

  await run(`
    CREATE TABLE ${qid(tempDb)}._map_categories AS
    SELECT c.id AS old_id, keepers.new_id
    FROM ${qid(sourceDb)}.categories c
    INNER JOIN (
      SELECT MIN(id) AS new_id, name
      FROM ${qid(sourceDb)}.categories
      GROUP BY name
    ) keepers ON keepers.name = c.name;
  `);

  await run(`
    CREATE TABLE ${qid(tempDb)}._map_units AS
    SELECT u.id AS old_id, keepers.new_id
    FROM ${qid(sourceDb)}.units u
    INNER JOIN (
      SELECT MIN(id) AS new_id, name
      FROM ${qid(sourceDb)}.units
      GROUP BY name
    ) keepers ON keepers.name = u.name;
  `);

  await run(`
    INSERT INTO ${qid(tempDb)}.categories (id, name)
    SELECT MIN(c.id) AS id, c.name
    FROM ${qid(sourceDb)}.categories c
    GROUP BY c.name
    ORDER BY id;
  `);

  await run(`
    INSERT INTO ${qid(tempDb)}.units (id, name)
    SELECT MIN(u.id) AS id, u.name
    FROM ${qid(sourceDb)}.units u
    GROUP BY u.name
    ORDER BY id;
  `);

  await run(`
    INSERT INTO ${qid(tempDb)}.coordination (id, ure, name)
    SELECT c.id, COALESCE(NULLIF(c.ure, ''), CONCAT('COOR-', c.id)), COALESCE(NULLIF(c.name, ''), CONCAT('Coordinacion ', c.id))
    FROM ${qid(sourceDb)}.coordination c
    ORDER BY c.id;
  `);

  await run(`
    INSERT INTO ${qid(tempDb)}.secretary (id, ure, name, coordination_id)
    SELECT
      s.id,
      COALESCE(NULLIF(s.ure, ''), CONCAT('SEC-', s.id)),
      COALESCE(NULLIF(s.name, ''), CONCAT('Secretaria ', s.id)),
      ${
        hasSecretaryCoordinationId
          ? "CASE WHEN c.id IS NULL THEN NULL ELSE s.coordination_id END"
          : hasCoordinationSecretaryId
            ? "CASE WHEN c.id IS NULL THEN NULL ELSE c.id END"
            : "NULL"
      }
    FROM ${qid(sourceDb)}.secretary s
    ${
      hasSecretaryCoordinationId
        ? `LEFT JOIN ${qid(tempDb)}.coordination c ON c.id = s.coordination_id`
        : hasCoordinationSecretaryId
          ? `LEFT JOIN (
      SELECT secretary_id, MIN(id) AS coordination_id
      FROM ${qid(sourceDb)}.coordination
      GROUP BY secretary_id
    ) src_c ON src_c.secretary_id = s.id
    LEFT JOIN ${qid(tempDb)}.coordination c ON c.id = src_c.coordination_id`
          : `LEFT JOIN ${qid(tempDb)}.coordination c ON 1 = 0`
    }
    ORDER BY s.id;
  `);

  await run(`
    INSERT INTO ${qid(tempDb)}.head_offices (id, ure, name, coordination_id)
    SELECT
      h.id,
      COALESCE(NULLIF(h.ure, ''), CONCAT('URE-', h.id)),
      COALESCE(NULLIF(h.name, ''), CONCAT('Unidad ', h.id)),
      CASE WHEN c.id IS NULL THEN NULL ELSE h.coordination_id END
    FROM ${qid(sourceDb)}.head_offices h
    LEFT JOIN ${qid(tempDb)}.coordination c ON c.id = h.coordination_id
    ORDER BY h.id;
  `);

  await run(`
    INSERT INTO ${qid(tempDb)}.users
      (id, name, user_name, ure, statuses_id, email, password, role, created_at)
    SELECT
      u.id,
      COALESCE(NULLIF(u.name, ''), CONCAT('Usuario ', u.id)),
      COALESCE(NULLIF(u.user_name, ''), CONCAT('user_', u.id)),
      u.ure,
      COALESCE(u.statuses_id, 1),
      u.email,
      COALESCE(NULLIF(u.password, ''), '123456'),
      COALESCE(NULLIF(u.role, ''), 'head_office'),
      ${hasUserCreatedAt ? "COALESCE(u.created_at, NOW())" : "NOW()"}
    FROM ${qid(sourceDb)}.users u
    ORDER BY u.id;
  `);

  await run(`
    INSERT INTO ${qid(tempDb)}.requisition
      (
        id, folio, area_folio, notes, users_id, statuses_id, signatures, created_at, sent_on,
        categories_id, request_name, justification, observation, assigned_operator_id,
        quotation_closed_at, quotation_closed_by, quotation_close_note, order_type
      )
    SELECT
      r.id,
      r.folio,
      COALESCE(NULLIF(r.area_folio, ''), CONCAT('AF-', r.id)),
      r.notes,
      r.users_id,
      COALESCE(r.statuses_id, 7),
      COALESCE(r.signatures, ''),
      COALESCE(r.created_at, NOW()),
      r.sent_on,
      COALESCE(cat_map.new_id, 1),
      COALESCE(NULLIF(r.request_name, ''), CONCAT('Requisicion ', r.id)),
      r.justification,
      r.observation,
      CASE WHEN ao.id IS NULL THEN NULL ELSE r.assigned_operator_id END,
      r.quotation_closed_at,
      CASE WHEN qb.id IS NULL THEN NULL ELSE r.quotation_closed_by END,
      r.quotation_close_note,
      COALESCE(NULLIF(r.order_type, ''), 'compra')
    FROM ${qid(sourceDb)}.requisition r
    INNER JOIN ${qid(tempDb)}.users u ON u.id = r.users_id
    LEFT JOIN ${qid(tempDb)}._map_categories cat_map ON cat_map.old_id = r.categories_id
    INNER JOIN ${qid(tempDb)}.categories cat ON cat.id = COALESCE(cat_map.new_id, 1)
    LEFT JOIN ${qid(tempDb)}.users ao ON ao.id = r.assigned_operator_id
    LEFT JOIN ${qid(tempDb)}.users qb ON qb.id = r.quotation_closed_by
    ORDER BY r.id;
  `);

  await run(`
    INSERT INTO ${qid(tempDb)}.line_items
      (id, requisition_id, product_name, description, quantity, units_id, unit, estimated_price)
    SELECT
      li.id,
      li.${qid(lineItemsReqCol)},
      li.product_name,
      li.description,
      li.quantity,
      CASE WHEN u.id IS NULL THEN NULL ELSE unit_map.new_id END,
      ${hasLineUnit ? "li.unit" : "NULL"},
      ${hasLineEstimatedPrice ? "li.estimated_price" : "NULL"}
    FROM ${qid(sourceDb)}.line_items li
    INNER JOIN ${qid(tempDb)}.requisition r ON r.id = li.${qid(lineItemsReqCol)}
    LEFT JOIN ${qid(tempDb)}._map_units unit_map ON unit_map.old_id = li.units_id
    LEFT JOIN ${qid(tempDb)}.units u ON u.id = unit_map.new_id
    ORDER BY li.id;
  `);

  await run(`
    INSERT INTO ${qid(tempDb)}.provider
      (id, name, razon_social, email, rfc, statuses_id, address, created_at)
    SELECT
      p.id,
      p.name,
      p.razon_social,
      p.email,
      p.rfc,
      COALESCE(p.statuses_id, 6),
      p.address,
      ${hasProviderCreatedAt ? "COALESCE(p.created_at, NOW())" : "NOW()"}
    FROM ${qid(sourceDb)}.provider p
    ORDER BY p.id;
  `);

  await run(`
    INSERT INTO ${qid(tempDb)}.phones (id, phone)
    SELECT ph.id, ph.phone
    FROM ${qid(sourceDb)}.phones ph
    ORDER BY ph.id;
  `);

  await run(`
    INSERT INTO ${qid(tempDb)}.provider_has_category (provider_id, categories_id)
    SELECT pc.provider_id, cat_map.new_id
    FROM ${qid(sourceDb)}.provider_has_category pc
    INNER JOIN ${qid(tempDb)}.provider p ON p.id = pc.provider_id
    INNER JOIN ${qid(tempDb)}._map_categories cat_map ON cat_map.old_id = pc.categories_id
    INNER JOIN ${qid(tempDb)}.categories c ON c.id = cat_map.new_id
    ORDER BY pc.provider_id, pc.categories_id;
  `);

  await run(`
    INSERT INTO ${qid(tempDb)}.provider_has_phones (provider_id, phones_id)
    SELECT pp.provider_id, pp.phones_id
    FROM ${qid(sourceDb)}.provider_has_phones pp
    INNER JOIN ${qid(tempDb)}.provider p ON p.id = pp.provider_id
    INNER JOIN ${qid(tempDb)}.phones ph ON ph.id = pp.phones_id
    ORDER BY pp.provider_id, pp.phones_id;
  `);

  if (hasQrId) {
    await run(`
      INSERT INTO ${qid(tempDb)}.quotation_requests
        (requisition_id, provider_id, status, invited_at, responded_at, deadline_at)
      SELECT
        qr.requisition_id,
        qr.provider_id,
        CASE
          WHEN qr.status IN ('invited','responded','declined','expired','disqualified')
            THEN qr.status
          ELSE 'invited'
        END,
        COALESCE(qr.invited_at, NOW()),
        qr.responded_at,
        qr.deadline_at
      FROM ${qid(sourceDb)}.quotation_requests qr
      INNER JOIN (
        SELECT requisition_id, provider_id, MAX(id) AS max_id
        FROM ${qid(sourceDb)}.quotation_requests
        GROUP BY requisition_id, provider_id
      ) last_qr ON last_qr.max_id = qr.id
      INNER JOIN ${qid(tempDb)}.requisition r ON r.id = qr.requisition_id
      INNER JOIN ${qid(tempDb)}.provider p ON p.id = qr.provider_id
      ORDER BY qr.requisition_id, qr.provider_id;
    `);
  } else {
    await run(`
      INSERT INTO ${qid(tempDb)}.quotation_requests
        (requisition_id, provider_id, status, invited_at, responded_at, deadline_at)
      SELECT
        qr.requisition_id,
        qr.provider_id,
        CASE
          WHEN qr.status IN ('invited','responded','declined','expired','disqualified')
            THEN qr.status
          ELSE 'invited'
        END,
        COALESCE(qr.invited_at, NOW()),
        qr.responded_at,
        qr.deadline_at
      FROM ${qid(sourceDb)}.quotation_requests qr
      INNER JOIN ${qid(tempDb)}.requisition r ON r.id = qr.requisition_id
      INNER JOIN ${qid(tempDb)}.provider p ON p.id = qr.provider_id
      GROUP BY qr.requisition_id, qr.provider_id
      ORDER BY qr.requisition_id, qr.provider_id;
    `);
  }

  await run(`
    INSERT INTO ${qid(tempDb)}.quotation_prices
      (
        id, requisition_id, line_item_id, provider_id, unit_price,
        offered_description, notes, is_winner, created_at
      )
    SELECT
      qp.id,
      qp.requisition_id,
      qp.line_item_id,
      qp.provider_id,
      qp.unit_price,
      ${hasQpOfferedDescription ? "qp.offered_description" : "NULL"},
      ${hasQrNotes ? "qp.notes" : "qp.notes"},
      COALESCE(qp.is_winner, 0),
      COALESCE(qp.created_at, NOW())
    FROM ${qid(sourceDb)}.quotation_prices qp
    INNER JOIN ${qid(tempDb)}.requisition r ON r.id = qp.requisition_id
    INNER JOIN ${qid(tempDb)}.line_items li ON li.id = qp.line_item_id
    INNER JOIN ${qid(tempDb)}.provider p ON p.id = qp.provider_id
    ORDER BY qp.id;
  `);

  await run(`
    INSERT INTO ${qid(tempDb)}.quotation_selections
      (
        id, requisition_id, line_item_id, provider_id, selected_unit_price,
        selected_description, selected_vat_percentage, selected_isr_percentage,
        created_at, updated_at
      )
    SELECT
      qs.id,
      qs.requisition_id,
      qs.line_item_id,
      qs.provider_id,
      qs.selected_unit_price,
      qs.selected_description,
      ${hasQsVat ? "qs.selected_vat_percentage" : "NULL"},
      ${hasQsIsr ? "qs.selected_isr_percentage" : "NULL"},
      COALESCE(qs.created_at, NOW()),
      COALESCE(qs.updated_at, NOW())
    FROM ${qid(sourceDb)}.quotation_selections qs
    INNER JOIN ${qid(tempDb)}.requisition r ON r.id = qs.requisition_id
    INNER JOIN ${qid(tempDb)}.line_items li ON li.id = qs.line_item_id
    INNER JOIN ${qid(tempDb)}.provider p ON p.id = qs.provider_id
    ORDER BY qs.id;
  `);

  await run(`
    INSERT INTO ${qid(tempDb)}.orden_compra_meta
      (id, requisition_id, provider_id, folio, oc_incluir_iva, oc_iva_porcentaje, created_at, updated_at)
    SELECT
      o.id,
      o.requisition_id,
      o.provider_id,
      o.folio,
      COALESCE(o.oc_incluir_iva, 0),
      o.oc_iva_porcentaje,
      COALESCE(o.created_at, NOW()),
      COALESCE(o.updated_at, NOW())
    FROM ${qid(sourceDb)}.orden_compra_meta o
    INNER JOIN ${qid(tempDb)}.requisition r ON r.id = o.requisition_id
    INNER JOIN ${qid(tempDb)}.provider p ON p.id = o.provider_id
    ORDER BY o.id;
  `);

  await run(`
    INSERT INTO ${qid(tempDb)}.notifications
      (
        id, recipient_user_id, actor_user_id, title, message, entity_type,
        entity_id, action_path, is_read, created_at, read_at
      )
    SELECT
      n.id,
      n.recipient_user_id,
      CASE WHEN a.id IS NULL THEN NULL ELSE n.actor_user_id END,
      n.title,
      n.message,
      n.entity_type,
      n.entity_id,
      n.action_path,
      COALESCE(n.is_read, 0),
      COALESCE(n.created_at, NOW()),
      n.read_at
    FROM ${qid(sourceDb)}.notifications n
    INNER JOIN ${qid(tempDb)}.users ru ON ru.id = n.recipient_user_id
    LEFT JOIN ${qid(tempDb)}.users a ON a.id = n.actor_user_id
    ORDER BY n.id;
  `);

  if (await hasTable(sourceDb, "requisition_attachments")) {
    await run(`
      INSERT INTO ${qid(tempDb)}.requisition_attachments
        (
          id, requisition_id, original_name, stored_name, mime_type, size_bytes,
          file_path, uploaded_by, created_at
        )
      SELECT
        ra.id,
        ra.requisition_id,
        ra.original_name,
        ra.stored_name,
        ra.mime_type,
        ra.size_bytes,
        ra.file_path,
        COALESCE(u.id, r.users_id),
        COALESCE(ra.created_at, NOW())
      FROM ${qid(sourceDb)}.requisition_attachments ra
      INNER JOIN ${qid(tempDb)}.requisition r ON r.id = ra.requisition_id
      LEFT JOIN ${qid(tempDb)}.users u ON u.id = ra.uploaded_by
      ORDER BY ra.id;
    `);
  }

  if (await hasTable(sourceDb, "requisition_status_history")) {
    await run(`
      INSERT INTO ${qid(tempDb)}.requisition_status_history
        (id, requisition_id, from_status_id, to_status_id, changed_by, change_note, changed_at)
      SELECT
        h.id,
        h.requisition_id,
        h.from_status_id,
        h.to_status_id,
        CASE WHEN u.id IS NULL THEN NULL ELSE h.changed_by END,
        h.change_note,
        COALESCE(h.changed_at, NOW())
      FROM ${qid(sourceDb)}.requisition_status_history h
      INNER JOIN ${qid(tempDb)}.requisition r ON r.id = h.requisition_id
      LEFT JOIN ${qid(tempDb)}.users u ON u.id = h.changed_by
      ORDER BY h.id;
    `);
  }

  await run(`
    DROP TABLE IF EXISTS ${qid(tempDb)}._map_categories;
    DROP TABLE IF EXISTS ${qid(tempDb)}._map_units;
  `);

  const dumpConn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database: tempDb,
    multipleStatements: false,
  });

  const [tableRows] = await dumpConn.query(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = ?
      AND TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME ASC
  `, [tempDb]);
  const tables = tableRows.map((r) => r.TABLE_NAME);

  let fullSql = "";
  fullSql += `-- SIMCO local full compatible snapshot (schema + data)\n`;
  fullSql += `-- Generated: ${new Date().toISOString()}\n`;
  fullSql += `-- Source database: ${sourceDb}\n`;
  fullSql += `-- Compatible schema: 001 + 005\n\n`;
  fullSql += `SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n`;

  for (const table of tables) {
    const [createRows] = await dumpConn.query(`SHOW CREATE TABLE ${qid(table)}`);
    const createSql = createRows?.[0]?.["Create Table"];
    if (!createSql) continue;

    fullSql += `-- ----------------------------\n`;
    fullSql += `-- Table structure for ${table}\n`;
    fullSql += `-- ----------------------------\n`;
    fullSql += `DROP TABLE IF EXISTS ${qid(table)};\n`;
    fullSql += `${createSql};\n\n`;
  }

  for (const table of tables) {
    const [rows] = await dumpConn.query(`SELECT * FROM ${qid(table)}`);
    if (!rows.length) continue;
    const columns = Object.keys(rows[0]);
    const colList = columns.map(qid).join(", ");

    fullSql += `-- ----------------------------\n`;
    fullSql += `-- Data for ${table}\n`;
    fullSql += `-- ----------------------------\n`;

    const chunkSize = 200;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const valuesSql = chunk
        .map((row) => {
          const vals = columns.map((c) => dumpConn.escape(row[c])).join(", ");
          return `(${vals})`;
        })
        .join(",\n");
      fullSql += `INSERT INTO ${qid(table)} (${colList}) VALUES\n${valuesSql};\n`;
    }
    fullSql += `\n`;
  }

  fullSql += `SET FOREIGN_KEY_CHECKS = 1;\n`;

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outFile, fullSql, "utf8");

  await dumpConn.end();
  await run(`DROP DATABASE IF EXISTS ${qid(tempDb)};`);

  console.log("Snapshot compatible generado:");
  console.log(`- ${outFile}`);
} finally {
  await conn.end();
}
