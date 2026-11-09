const express = require('express');
const router = express.Router();
const DocumentoController = require('../controllers/DocumentoController');
const { requireRole } = require('../middlewares/authMiddleware');

// Exclusão é irreversível na prática (some das listagens) — só admin/gestor
const podeExcluir = requireRole(['admin', 'gestor']);

// Rotas de documentos
// A tela de documentos é o módulo /documentos-pdf; a view documentos/index
// nunca existiu e o GET dava 500. Links antigos para /documentos caem lá.
router.get('/', (req, res) => res.redirect('/documentos-pdf'));
router.post('/upload', DocumentoController.upload);
router.get('/:id', DocumentoController.show);
router.put('/:id', DocumentoController.update);
router.delete('/:id', podeExcluir, DocumentoController.destroy);
router.post('/:id/arquivar', DocumentoController.arquivar);

module.exports = router;
