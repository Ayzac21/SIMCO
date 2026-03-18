import { Router } from "express";
import { requireRoles } from "../middleware/auth.js";

const router = Router();

const disabledRevision = (_req, res) =>
    res.status(403).json({
        message: "La revisión de cotización ahora se realiza internamente en Compras.",
    });

router.get("/revision", requireRoles("head_office"), disabledRevision);
router.get("/revision/:id/data", requireRoles("head_office"), disabledRevision);
router.post("/revision/:id/submit", requireRoles("head_office"), disabledRevision);

export default router;
