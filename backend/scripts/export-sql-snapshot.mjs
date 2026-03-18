import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const dbName = String(process.env.DB_NAME || "Compras");
const host = String(process.env.DB_HOST || "localhost")
  .trim()
  .replace(/^https?:\/\//, "")
  .replace(/\/+$/, "");
const port = Number.parseInt(process.env.DB_PORT || "3306", 10) || 3306;

const outDir = path.resolve(process.cwd(), "sql");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const schemaFile = path.join(outDir, `900_local_schema_${timestamp}.sql`);
const fullFile = path.join(outDir, `901_local_full_${timestamp}.sql`);

const conn = await mysql.createConnection({
  host,
  port,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: dbName,
  multipleStatements: false,
});

const qid = (name) => `\`${String(name).replace(/`/g, "``")}\``;

const [tableRows] = await conn.query(`
  SELECT TABLE_NAME
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = ?
    AND TABLE_TYPE = 'BASE TABLE'
  ORDER BY TABLE_NAME ASC
`, [dbName]);

const tables = tableRows.map((r) => r.TABLE_NAME);

let schemaSql = "";
let fullSql = "";

schemaSql += `-- SIMCO local schema snapshot\n`;
schemaSql += `-- Generated: ${new Date().toISOString()}\n`;
schemaSql += `-- Database: ${dbName}\n\n`;
schemaSql += `SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n`;

fullSql += `-- SIMCO local full snapshot (schema + data)\n`;
fullSql += `-- Generated: ${new Date().toISOString()}\n`;
fullSql += `-- Database: ${dbName}\n\n`;
fullSql += `SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n`;

for (const table of tables) {
  const [createRows] = await conn.query(`SHOW CREATE TABLE ${qid(table)}`);
  const createSql = createRows?.[0]?.["Create Table"];
  if (!createSql) continue;

  schemaSql += `-- ----------------------------\n`;
  schemaSql += `-- Table structure for ${table}\n`;
  schemaSql += `-- ----------------------------\n`;
  schemaSql += `DROP TABLE IF EXISTS ${qid(table)};\n`;
  schemaSql += `${createSql};\n\n`;

  fullSql += `-- ----------------------------\n`;
  fullSql += `-- Table structure for ${table}\n`;
  fullSql += `-- ----------------------------\n`;
  fullSql += `DROP TABLE IF EXISTS ${qid(table)};\n`;
  fullSql += `${createSql};\n\n`;
}

for (const table of tables) {
  const [rows] = await conn.query(`SELECT * FROM ${qid(table)}`);
  if (!rows.length) continue;

  const columns = Object.keys(rows[0]);
  const colList = columns.map(qid).join(", ");

  fullSql += `-- ----------------------------\n`;
  fullSql += `-- Data for ${table}\n`;
  fullSql += `-- ----------------------------\n`;

  // Insert por bloque para no generar archivos gigantes por línea.
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const valuesSql = chunk
      .map((row) => {
        const vals = columns.map((c) => conn.escape(row[c])).join(", ");
        return `(${vals})`;
      })
      .join(",\n");
    fullSql += `INSERT INTO ${qid(table)} (${colList}) VALUES\n${valuesSql};\n`;
  }
  fullSql += `\n`;
}

schemaSql += `SET FOREIGN_KEY_CHECKS = 1;\n`;
fullSql += `SET FOREIGN_KEY_CHECKS = 1;\n`;

await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(schemaFile, schemaSql, "utf8");
await fs.writeFile(fullFile, fullSql, "utf8");

await conn.end();

console.log("Snapshot SQL generado:");
console.log(`- ${schemaFile}`);
console.log(`- ${fullFile}`);
