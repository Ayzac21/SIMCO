import connection from "../db/connection.js";

export const createRequisition = (req, res) => {
    const { users_id, categories_id, notes, articulos } = req.body;

    if (!users_id || !categories_id || !articulos || articulos.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Faltan datos requeridos"
        });
    }

    const folio = "REQ-" + Date.now();

    const requisitionData = {
        folio,
        area_folio: null,
        notes,
        users_id,
        statuses_id: 1,
        signatures: null,
        sent_on: null,
        categories_id
    };

    connection.beginTransaction(err => {
        if (err) return res.json({ success: false, message: "Error BD" });

        // Insertar requisición
        connection.query(
            "INSERT INTO requisition SET ?",
            requisitionData,
            (err, result) => {
                if (err) {
                    return connection.rollback(() => {
                        res.json({ success: false, message: "Error al crear requisición" });
                    });
                }

                const requisition_id = result.insertId;

                // Insertar artículos
                const items = articulos.map(item => [
                    requisition_id,
                    item.description,
                    item.quantity,
                    item.unit,
                    item.estimated_price || null
                ]);

                connection.query(
                    "INSERT INTO line_items (requisition_id, description, quantity, unit, estimated_price) VALUES ?",
                    [items],
                    (err2) => {
                        if (err2) {
                            return connection.rollback(() => {
                                res.json({ success: false, message: "Error al insertar artículos" });
                            });
                        }

                        connection.commit(err3 => {
                            if (err3) {
                                return connection.rollback(() => res.json({ success: false, message: "Error commit" }));
                            }

                            res.json({
                                success: true,
                                message: "Requisición creada correctamente",
                                folio,
                                requisition_id
                            });
                        });
                    }
                );
            }
        );
    });
};
