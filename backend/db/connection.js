import { createPool } from "mysql2/promise"; // Usamos la versión con Promesas
import dotenv from "dotenv";

dotenv.config();

const normalizedHost = String(process.env.DB_HOST || "localhost")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

const normalizedPort = Number.parseInt(process.env.DB_PORT || "3306", 10) || 3306;

// Creamos la conexión tipo Pool (necesaria para getConnection y await)
export const pool = createPool({
    host: normalizedHost,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "Compras",
    port: normalizedPort,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

console.log("Pool de conexiones a MySQL configurado.");
