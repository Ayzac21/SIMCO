import express from 'express';
import { 
    getRequisicionesSecretaria, 
    updateEstatusSecretaria,
    getSecretariaItems
} from '../controllers/secretariaController.js';
import { requireRoles } from "../middleware/auth.js";

const router = express.Router();

router.get('/secretaria/:id/recibidas', requireRoles("secretaria"), getRequisicionesSecretaria);

router.get('/secretaria/requisiciones/:id/items', requireRoles("secretaria"), getSecretariaItems);
router.put('/secretaria/requisiciones/:id/estatus', requireRoles("secretaria"), updateEstatusSecretaria);

export default router;
