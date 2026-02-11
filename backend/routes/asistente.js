import { Router } from "express";
import {
    getRevisionRequisitions,
    getRevisionCotizacionData,
    submitRevisionSelection,
} from "../controllers/asistenteController.js";
import { requireRoles } from "../middleware/auth.js";

const router = Router();

router.get("/revision", requireRoles("head_office"), getRevisionRequisitions);
router.get("/revision/:id/data", requireRoles("head_office"), getRevisionCotizacionData);
router.post("/revision/:id/submit", requireRoles("head_office"), submitRevisionSelection);

export default router;
