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
    const role = String(req.header("x-user-role") || "");
    const id = Number(req.header("x-user-id") || 0);

    if (!role) {
        return res.status(401).json({ message: "Falta credencial de rol" });
    }
    if (!role.startsWith("compras_")) {
        return res.status(403).json({ message: "Acceso restringido a compras" });
    }

    req.user = { id, role };
    next();
});

router.get("/dashboard", getComprasDashboard);
router.get("/operators", getComprasOperators);
router.get("/historial", getComprasHistorial);
router.get("/historial/report", getComprasHistorialReport);
router.get("/requisiciones/:id/items", getRequisitionItems);
router.get("/requisiciones/:id/seleccion", getCompraSeleccion);
router.put("/requisiciones/:id/estatus", updateEstatusCompras);
router.put("/requisiciones/:id/assign", assignRequisitionOperator);

router.get("/cotizacion/:id/data", getCotizacionData);
router.post("/cotizacion/:id/prices", saveCotizacionPrices);
router.post("/cotizacion/:id/invite", inviteProvidersToCotizacion);
router.post("/cotizacion/:id/close", closeCotizacionInvites);
router.post("/cotizacion/:id/send-review", sendCotizacionToReview);
router.post("/cotizacion/:id/reopen", reopenCotizacionReception);
router.get("/orden/:id/pdf", getOrdenCompraPdf);
router.get("/orden/:id/providers", getOrdenCompraProviders);
router.get("/orden/:id/meta", getOrdenCompraMeta);
router.put("/orden/:id/meta", updateOrdenCompraMeta);

router.get("/providers", getAllProviders);
router.get("/providers/admin", getProvidersAdmin);
router.post("/providers", createProvider);
router.put("/providers/:id", updateProvider);
router.patch("/providers/:id/status", updateProviderStatus);

export default router;
