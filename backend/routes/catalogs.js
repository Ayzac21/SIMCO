import { Router } from "express";
import { getUresCatalog } from "../controllers/catalogsController.js";

const router = Router();

router.get("/ures", getUresCatalog);

export default router;
