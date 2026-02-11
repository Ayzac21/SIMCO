import { Router } from "express";
import {
    getComprasDashboard,
    getRequisitionItems,
    getCotizacionData,
    saveCotizacionPrices,
    inviteProvidersToCotizacion,
    getAllProviders,
    getProvidersAdmin,
    createProvider,
    updateProvider,
    updateProviderStatus,
    sendCotizacionToReview,
    reopenCotizacionReception,
    getOrdenCompraPdf,
    getOrdenCompraProviders,
    updateOrdenCompraMeta,
    getOrdenCompraMeta,
    updateOrdenCompraType,
    closeCotizacionInvites,
    updateEstatusCompras,
    getComprasHistorial,
    getComprasHistorialReport,
    getComprasOperators,
    assignRequisitionOperator,
    getCompraSeleccion,
} from "../controllers/comprasController.js";

const router = Router();

router.use((req, res, next) => {
    const role = req.user?.role || "";
    if (!role) {
        return res.status(401).json({ message: "No autorizado" });
    }
    if (!role.startsWith("compras_")) {
        return res.status(403).json({ message: "Acceso restringido a compras" });
    }
    next();
});

const blockReader = (req, res, next) => {
    if (req.user?.role === "compras_lector") {
        return res.status(403).json({ message: "Acceso de solo lectura" });
    }
    return next();
};

router.get("/dashboard", getComprasDashboard);
router.get("/operators", getComprasOperators);
router.get("/historial", getComprasHistorial);
router.get("/historial/report", getComprasHistorialReport);
router.get("/requisiciones/:id/items", getRequisitionItems);
router.get("/requisiciones/:id/seleccion", getCompraSeleccion);
router.put("/requisiciones/:id/estatus", blockReader, updateEstatusCompras);
router.put("/requisiciones/:id/assign", blockReader, assignRequisitionOperator);

router.get("/cotizacion/:id/data", getCotizacionData);
router.post("/cotizacion/:id/prices", blockReader, saveCotizacionPrices);
router.post("/cotizacion/:id/invite", blockReader, inviteProvidersToCotizacion);
router.post("/cotizacion/:id/close", blockReader, closeCotizacionInvites);
router.post("/cotizacion/:id/send-review", blockReader, sendCotizacionToReview);
router.post("/cotizacion/:id/reopen", blockReader, reopenCotizacionReception);
router.get("/orden/:id/pdf", getOrdenCompraPdf);
router.get("/orden/:id/providers", getOrdenCompraProviders);
router.get("/orden/:id/meta", getOrdenCompraMeta);
router.put("/orden/:id/meta", blockReader, updateOrdenCompraMeta);
router.put("/orden/:id/type", blockReader, updateOrdenCompraType);

router.get("/providers", getAllProviders);
router.get("/providers/admin", getProvidersAdmin);
router.post("/providers", blockReader, createProvider);
router.put("/providers/:id", blockReader, updateProvider);
router.patch("/providers/:id/status", blockReader, updateProviderStatus);

export default router;
