import connection from "../db/connection.js";

export const crearRequisicion = (id_usuario, descripcion, cantidad, unidad) => {
    return new Promise((resolve, reject) => {
        connection.query(
        `INSERT INTO requisiciones 
            (id_usuario, descripcion, cantidad, unidad, estado) 
            VALUES (?, ?, ?, ?, 'pendiente_coordinador')`,
        [id_usuario, descripcion, cantidad, unidad],
        (err, results) => {
            if (err) reject(err);
            else resolve(results);
        }
        );
    });
};

export const obtenerRequisicionesPorRol = (rol, id_usuario) => {
    let query = "";

    switch (rol) {
        case "asistente":
            query = "SELECT * FROM requisiciones WHERE id_usuario = ?";
        break;
        case "coordinador":
            query = "SELECT * FROM requisiciones WHERE estado = 'pendiente_coordinador'";
        break;
        case "secretario":
            query = "SELECT * FROM requisiciones WHERE estado = 'pendiente_secretario'";
        break;
        case "compras":
            query = "SELECT * FROM requisiciones WHERE estado IN ('pendiente_compras','en_proceso_compras')";
        break;
    }

    return new Promise((resolve, reject) => {
        connection.query(query, [id_usuario], (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
};

export const actualizarEstado = (id, nuevoEstado, observaciones = null) => {
    return new Promise((resolve, reject) => {
        connection.query(
            "UPDATE requisiciones SET estado = ?, observaciones = ? WHERE id = ?",
            [nuevoEstado, observaciones, id],
            (err, results) => {
                if (err) reject(err);
                else resolve(results);
            }
        );
    });
};
