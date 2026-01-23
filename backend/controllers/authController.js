import connection from "../db/connection.js";

export const login = (req, res) => {
    const { user_name, password } = req.body;

    connection.query(
        "SELECT * FROM users WHERE user_name = ? AND password = ?",
        [user_name, password],
        (err, results) => {
            if (err) return res.json({ success: false, message: "Error en la base de datos" });

            if (results.length === 0) {
                return res.json({ success: false, message: "Credenciales inválidas" });
            }

            const user = results[0];
            const ure = user.ure;

            // ============================
            // 1) Verificar si es ASISTENTE
            // ============================
            connection.query(
                "SELECT * FROM head_offices WHERE ure = ?",
                [ure],
                (err, head) => {
                    if (err) return res.json({ success: false, message: "Error BD" });

                    if (head.length > 0) {
                        user.rol = "asistente";
                        user.coordination_id = head[0].coordination_id;
                        return res.json({ success: true, user });
                    }

                    // ============================
                    // 2) Verificar si es COORDINADOR
                    // ============================
                    connection.query(
                        "SELECT * FROM coordination WHERE ure = ?",
                        [ure],
                        (err, coor) => {
                            if (err) return res.json({ success: false, message: "Error BD" });

                            if (coor.length > 0) {
                                user.rol = "coordinador";
                                user.coordination_id = coor[0].id;
                                return res.json({ success: true, user });
                            }

                            // ============================
                            // 3) Verificar si es SECRETARIO
                            // ============================
                            connection.query(
                                "SELECT * FROM secretary WHERE ure = ?",
                                [ure],
                                (err, sec) => {
                                    if (err) return res.json({ success: false, message: "Error BD" });

                                    if (sec.length > 0) {
                                        user.rol = "secretario";
                                        user.coordination_id = sec[0].coordination_id;
                                        return res.json({ success: true, user });
                                    }

                                    // ============================
                                    // 4) Si no coincide con nada
                                    // ============================
                                    user.rol = "desconocido";
                                    user.coordination_id = null;

                                    return res.json({ success: true, user });
                                }
                            );
                        }
                    );
                }
            );
        }
    );
};
