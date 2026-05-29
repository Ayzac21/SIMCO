import { Router } from "express";
import {
  createFinanceCatalogEntry,
  downloadFinanzasHistorialExcel,
  getFinanceCatalogOptions,
  getFinanzasDetalle,
  getFinanzasHistorial,
  getFinanzasRecibidas,
  listFinanceCatalogEntries,
  resolveFinanzasRevision,
  updateFinanceCatalogEntry,
  updateFinanceCatalogEntryStatus,
} from "../controllers/finanzasController.js";

const router = Router();

router.use((req, res, next) => {
  if (req.user?.role !== "finanzas") {
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
router.get("/requisiciones/:id", getFinanzasDetalle);
router.post("/requisiciones/:id/resolver", resolveFinanzasRevision);

export default router;
