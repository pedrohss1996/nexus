const express = require('express');
const router = express.Router();
const FornecedorController = require('../controllers/FornecedorController');

// Rotas de fornecedores
router.get('/', FornecedorController.index);
router.get('/novo', FornecedorController.create);
router.post('/', FornecedorController.store);
router.get('/:id', FornecedorController.show);
router.get('/:id/editar', FornecedorController.edit);
router.put('/:id', FornecedorController.update);
router.delete('/:id', FornecedorController.destroy);

module.exports = router;
