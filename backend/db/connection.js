import { createPool } from "mysql2/promise"; // Usamos la versión con Promesas
import dotenv from "dotenv";

dotenv.config();

// Creamos la conexión tipo Pool (necesaria para getConnection y await)
export const pool = createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "Compras",
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

console.log("Pool de conexiones a MySQL configurado.");