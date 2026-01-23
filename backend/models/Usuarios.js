import connection from "../db/connection.js";

export const crearUsuario = (nombre, correo, password, rol, area) => {
    return new Promise((resolve, reject) => {
        connection.query(
            "INSERT INTO usuarios (nombre, correo, password, rol, area) VALUES (?, ?, ?, ?, ?)",
            [nombre, correo, password, rol, area],
            (err, results) => {
                if (err) reject(err);
                else resolve(results);
            }
        );
    });
};

export const buscarUsuarioPorCorreo = (correo) => {
    return new Promise((resolve, reject) => {
        connection.query(
            "SELECT * FROM usuarios WHERE correo = ?",
            [correo],
            (err, results) => {
                if (err) reject(err);
                else resolve(results[0]);
            }
        );
    });
};
