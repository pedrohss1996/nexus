const express = require('express');
const router = express.Router();
const ProtocoloController = require('../controllers/ProtocoloController');

// Listar protocolos
router.get('/', ProtocoloController.index);

// Novo protocolo
router.get('/novo', ProtocoloController.novo);
router.post('/', ProtocoloController.criar);

// Visualizar protocolo
router.get('/:id', ProtocoloController.visualizar);

module.exports = router;
