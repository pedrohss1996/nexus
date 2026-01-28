const express = require('express');
const router = express.Router();
const DocumentoController = require('../controllers/DocumentoController');

// Rotas de documentos
router.get('/', DocumentoController.index);
router.post('/upload', DocumentoController.upload);
router.get('/:id', DocumentoController.show);
router.put('/:id', DocumentoController.update);
router.delete('/:id', DocumentoController.destroy);
router.post('/:id/arquivar', DocumentoController.arquivar);

module.exports = router;
