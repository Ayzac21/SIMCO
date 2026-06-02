import { Router } from "express";
import {
  createFinanceCatalogEntry,
  createFinanzasPersonal,
  downloadFinanzasHistorialExcel,
  getFinanceCatalogOptions,
  getFinanzasDetalle,
  getFinanzasHistorial,
  getFinanzasRecibidas,
  listFinanceCatalogEntries,
  listFinanzasPersonal,
  resetFinanzasPersonalPassword,
  resolveFinanzasRevision,
  updateFinanceCatalogEntry,
  updateFinanceCatalogEntryStatus,
  updateFinanzasPersonal,
  updateFinanzasPersonalStatus,
  isFinanceRole,
} from "../controllers/finanzasController.js";

const router = Router();

router.use((req, res, next) => {
  if (!isFinanceRole(req.user?.role)) {
    return res.status(403).json({ message: "Acceso restringido a Finanzas" });
  }
  return next();
});

router.get("/recibidas", getFinanzasRecibidas);
router.get("/historial", getFinanzasHistorial);
router.get("/historial/excel", downloadFinanzasHistorialExcel);
router.get("/catalog-options", getFinanceCatalogOptions);
router.get("/catalogos", listFinanceCatalogEntries);
router.post("/catalogos", createFinanceCatalogEntry);
router.put("/catalogos/:id", updateFinanceCatalogEntry);
router.patch("/catalogos/:id/status", updateFinanceCatalogEntryStatus);
router.get("/personal", listFinanzasPersonal);
router.post("/personal", createFinanzasPersonal);
router.put("/personal/:id", updateFinanzasPersonal);
router.put("/personal/:id/status", updateFinanzasPersonalStatus);
router.put("/personal/:id/reset-password", resetFinanzasPersonalPassword);
router.get("/requisiciones/:id", getFinanzasDetalle);
router.post("/requisiciones/:id/resolver", resolveFinanzasRevision);

export default router;
