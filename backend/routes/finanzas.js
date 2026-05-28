import { Router } from "express";
import {
  getFinanzasDetalle,
  getFinanzasHistorial,
  getFinanzasRecibidas,
  resolveFinanzasRevision,
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
router.get("/requisiciones/:id", getFinanzasDetalle);
router.post("/requisiciones/:id/resolver", resolveFinanzasRevision);

export default router;
