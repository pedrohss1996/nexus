const express = require('express');
const router = express.Router();
const TramitacaoController = require('../controllers/TramitacaoController');

// Listar tramitações
router.get('/', TramitacaoController.index);

// Nova tramitação
router.get('/protocolo/:protocolo_id/tramitar', TramitacaoController.novoForm);
router.post('/protocolo/:protocolo_id/tramitar', TramitacaoController.criar);

// Receber tramitação
router.post('/:id/receber', TramitacaoController.receber);

module.exports = router;
