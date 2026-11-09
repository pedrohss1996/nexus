const express = require('express');
const router = express.Router();
const DocumentoController = require('../controllers/DocumentoController');
const { requireRole } = require('../middlewares/authMiddleware');

// Exclusão é irreversível na prática (some das listagens) — só admin/gestor
const podeExcluir = requireRole(['admin', 'gestor']);

// Rotas de documentos
router.get('/', DocumentoController.index);
router.post('/upload', DocumentoController.upload);
router.get('/:id', DocumentoController.show);
router.put('/:id', DocumentoController.update);
router.delete('/:id', podeExcluir, DocumentoController.destroy);
router.post('/:id/arquivar', DocumentoController.arquivar);

module.exports = router;
