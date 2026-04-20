import express from 'express';
import { 
    getRequisicionesSecretaria, 
    updateEstatusSecretaria,
    getSecretariaItems,
    getSecretariaItemImage
} from '../controllers/secretariaController.js';
import { requireRoles } from "../middleware/auth.js";

const router = express.Router();

router.get('/secretaria/:id/recibidas', requireRoles("secretaria"), getRequisicionesSecretaria);

router.get('/secretaria/requisiciones/:id/items', requireRoles("secretaria"), getSecretariaItems);
router.get('/secretaria/requisiciones/:id/items/:line_item_id/image', requireRoles("secretaria"), getSecretariaItemImage);
router.put('/secretaria/requisiciones/:id/estatus', requireRoles("secretaria"), updateEstatusSecretaria);

export default router;
