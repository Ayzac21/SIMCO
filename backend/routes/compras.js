import { Router } from "express";
import {
    getComprasDashboard,
    getRequisitionItems,
    getCotizacionData,
    saveCotizacionPrices,
    inviteProvidersToCotizacion,
    getAllProviders,
    closeCotizacionInvites,
} from "../controllers/comprasController.js";

const router = Router();

router.get("/dashboard", getComprasDashboard);
router.get("/requisiciones/:id/items", getRequisitionItems);

router.get("/cotizacion/:id/data", getCotizacionData);
router.post("/cotizacion/:id/prices", saveCotizacionPrices);
router.post("/cotizacion/:id/invite", inviteProvidersToCotizacion);
router.post("/cotizacion/:id/close", closeCotizacionInvites);

router.get("/providers", getAllProviders);

export default router;
