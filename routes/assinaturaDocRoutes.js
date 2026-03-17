const express = require('express');
const router = express.Router();
const AssinaturaDocController = require('../controllers/AssinaturaDocController');

// Documentos pendentes para o usuário logado
router.get('/pendentes', AssinaturaDocController.pendentes);

// Página para assinar (acesso via token único do documento)
router.get('/assinar/:token', AssinaturaDocController.paginaAssinar);
router.post('/assinar/:token', AssinaturaDocController.assinar);

// Página de assinatura por link individual (um link por variável/grupo)
router.get('/i/:tokenIndividual', AssinaturaDocController.paginaAssinarIndividual);
router.post('/i/:tokenIndividual', AssinaturaDocController.assinarIndividual);

// Baixar PDF com todas as assinaturas preenchidas
router.get('/pdf-assinado/:token', AssinaturaDocController.gerarPDFAssinado);

module.exports = router;
