import express from "express";
import { pool } from "../db/connection.js";

const router = express.Router();


router.post("/login", async (req, res) => {
    try {
        const { user_name, password } = req.body;

        console.log("BODY RECIBIDO:", req.body);

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

        // Comparación directa (texto plano)
        if (user.password !== password) {
            return res.status(401).json({
                ok: false,
                message: "Credenciales inválidas"
            });
        }

        // Login correcto
        return res.json({
            ok: true,
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
