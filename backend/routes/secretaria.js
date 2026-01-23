import express from 'express';
import { 
    getRequisicionesSecretaria, 
    updateEstatusSecretaria,
    getSecretariaItems
} from '../controllers/secretariaController.js';

const router = express.Router();

router.get('/secretaria/:id/recibidas', getRequisicionesSecretaria);

router.get('/secretaria/requisiciones/:id/items', getSecretariaItems);
router.put('/secretaria/requisiciones/:id/estatus', updateEstatusSecretaria);

export default router;