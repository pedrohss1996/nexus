const express = require('express');
const router = express.Router();
const DocumentoPDFController = require('../controllers/DocumentoPDFController');

// Rotas de templates de documentos PDF
router.get('/', DocumentoPDFController.index);
router.get('/novo', DocumentoPDFController.novo);
router.post('/criar', DocumentoPDFController.criar);
router.get('/:id/editar', DocumentoPDFController.editar);
router.post('/:id/atualizar', DocumentoPDFController.atualizar);
router.delete('/:id', DocumentoPDFController.excluir);
router.post('/:id/excluir', DocumentoPDFController.excluir);

// Rotas de geração de PDF
router.get('/:id/gerar', DocumentoPDFController.gerarFormulario);
router.post('/:id/gerar', DocumentoPDFController.gerar);

// Download e histórico
router.get('/download/:nomeArquivo', DocumentoPDFController.download);
router.get('/historico', DocumentoPDFController.historico);

module.exports = router;
