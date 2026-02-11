import express from "express";
import { 
    getRequisicionesCoordinador, 
    updateEstatusRequisicion, 
    getRequisicionItems,
    createRequisicionCoordinador,
    enviarBorradorCoordinador
} from "../controllers/coordinadorController.js";
import { requireRoles } from "../middleware/auth.js";

const router = express.Router();

// 1. Ruta de lista (Esta ya funcionaba)
router.get(
    "/coordinador/:coordinador_id/recibidas", 
    requireRoles("coordinador"),
    getRequisicionesCoordinador
);

// 2. Ruta de Estatus (AGREGUÉ '/coordinador' AL INICIO)
router.put(
    "/coordinador/requisiciones/:id/estatus", 
    requireRoles("coordinador"),
    updateEstatusRequisicion
);

// 3. Ruta de Items (AGREGUÉ '/coordinador' AL INICIO)
router.get(
    "/coordinador/requisiciones/:id/items",
    requireRoles("coordinador"),
    getRequisicionItems
);

// 4. Crear requisición desde coordinador
router.post(
    "/coordinador/requisiciones",
    requireRoles("coordinador"),
    createRequisicionCoordinador
);

// 5. Enviar borrador a Secretaría (7 -> 9)
router.patch(
    "/coordinador/requisiciones/:id/enviar",
    requireRoles("coordinador"),
    enviarBorradorCoordinador
);

export default router;
