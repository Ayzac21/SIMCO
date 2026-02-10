import express from "express";
import { 
    getRequisicionesCoordinador, 
    updateEstatusRequisicion, 
    getRequisicionItems,
    createRequisicionCoordinador,
    enviarBorradorCoordinador
} from "../controllers/coordinadorController.js";

const router = express.Router();

// 1. Ruta de lista (Esta ya funcionaba)
router.get(
    "/coordinador/:coordinador_id/recibidas", 
    getRequisicionesCoordinador
);

// 2. Ruta de Estatus (AGREGUÉ '/coordinador' AL INICIO)
router.put(
    "/coordinador/requisiciones/:id/estatus", 
    updateEstatusRequisicion
);

// 3. Ruta de Items (AGREGUÉ '/coordinador' AL INICIO)
router.get(
    "/coordinador/requisiciones/:id/items",
    getRequisicionItems
);

// 4. Crear requisición desde coordinador
router.post(
    "/coordinador/requisiciones",
    createRequisicionCoordinador
);

// 5. Enviar borrador a Secretaría (7 -> 9)
router.patch(
    "/coordinador/requisiciones/:id/enviar",
    enviarBorradorCoordinador
);

export default router;
