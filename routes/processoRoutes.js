const express = require('express');
const router = express.Router();
const ProcessoController = require('../controllers/ProcessoController');

// Rotas de processos
router.get('/', ProcessoController.index);
router.get('/novo', ProcessoController.create);
router.post('/', ProcessoController.store);
router.get('/:id', ProcessoController.show);
router.get('/:id/editar', ProcessoController.edit);
router.put('/:id', ProcessoController.update);
router.delete('/:id', ProcessoController.destroy);
router.post('/:id/aprovar', ProcessoController.aprovar);
router.post('/:id/rejeitar', ProcessoController.rejeitar);

module.exports = router;
