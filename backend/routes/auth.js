import express from "express";
import { pool } from "../db/connection.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();


router.post("/login", async (req, res) => {
    try {
        const { user_name, password } = req.body;

        // Buscar usuario
        const [rows] = await pool.query(
            "SELECT * FROM users WHERE user_name = ?",
            [user_name]
        );

        // Usuario no existe
        if (rows.length === 0) {
            return res.status(401).json({
                ok: false,
                message: "Credenciales inválidas"
            });
        }

        const user = rows[0];

        const stored = String(user.password || "");
        let passwordOk = false;
        if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
            passwordOk = await bcrypt.compare(password, stored);
        } else {
            passwordOk = stored === password;
            if (passwordOk) {
                const hashed = await bcrypt.hash(password, 10);
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

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET || "dev_secret_change_me",
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
