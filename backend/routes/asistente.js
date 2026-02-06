import { Router } from "express";
import {
    getRevisionRequisitions,
    getRevisionCotizacionData,
    submitRevisionSelection,
} from "../controllers/asistenteController.js";

const router = Router();

router.get("/revision", getRevisionRequisitions);
router.get("/revision/:id/data", getRevisionCotizacionData);
router.post("/revision/:id/submit", submitRevisionSelection);

export default router;
