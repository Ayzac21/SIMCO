import express from "express";
import { 
    getRequisicionesCoordinador, 
    updateEstatusRequisicion, 
    getRequisicionItems 
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

export default router;