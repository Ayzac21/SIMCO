import express from "express";
import { pool } from "../db/connection.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();


router.post("/login", async (req, res) => {
    try {
        const inputUser = String(req.body?.user_name || "").trim();
        const inputPassword = String(req.body?.password || "");

        if (!inputUser || !inputPassword) {
            return res.status(400).json({
                ok: false,
                message: "Usuario y contraseña son requeridos"
            });
        }

        // Buscar usuario
        const [rows] = await pool.query(
            `
            SELECT
              u.*,
              COALESCE(
                NULLIF(TRIM(ho.name), ''),
                NULLIF(TRIM(s.name), ''),
                NULLIF(TRIM(c.name), ''),
                NULLIF(TRIM(u.ure), '')
              ) AS ure_name
            FROM users u
            LEFT JOIN head_offices ho ON TRIM(UPPER(ho.ure)) = TRIM(UPPER(u.ure))
            LEFT JOIN secretary s ON TRIM(UPPER(s.ure)) = TRIM(UPPER(u.ure))
            LEFT JOIN coordination c ON TRIM(UPPER(c.ure)) = TRIM(UPPER(u.ure))
            WHERE u.user_name = ?
            LIMIT 1
            `,
            [inputUser]
        );

        // Usuario no existe
        if (rows.length === 0) {
            return res.status(401).json({
                ok: false,
                message: "Credenciales inválidas"
            });
        }

        const user = rows[0];
        const statusId = Number(user.statuses_id);
        if (Number.isFinite(statusId) && statusId !== 1) {
            return res.status(403).json({
                ok: false,
                message: "Usuario inactivo"
            });
        }

        const stored = String(user.password || "");
        let passwordOk = false;
        if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
            passwordOk = await bcrypt.compare(inputPassword, stored);
        } else {
            passwordOk = stored === inputPassword;
            if (passwordOk) {
                const hashed = await bcrypt.hash(inputPassword, 10);
                await pool.query(
                    `UPDATE users SET password = ? WHERE id = ?`,
                    [hashed, user.id]
                );
            }
        }

        if (!passwordOk) {
            return res.status(401).json({
                ok: false,
                message: "Credenciales inválidas"
            });
        }

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                ok: false,
                message: "Configuración inválida del servidor"
            });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "12h" }
        );

        // Login correcto
        return res.json({
            ok: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                user_name: user.user_name,
                ure: user.ure,
                ure_name: user.ure_name || null,
                statuses_id: user.statuses_id,
                role: user.role
            }
        });

    } catch (error) {
        console.error("ERROR LOGIN:", error);
        return res.status(500).json({
            ok: false,
            message: "Error del servidor"
        });
    }
});

export default router;
