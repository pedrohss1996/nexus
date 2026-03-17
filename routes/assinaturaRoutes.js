const express = require('express');
const router  = express.Router();
const AssinaturaController = require('../controllers/AssinaturaController');
const { requireRole } = require('../middlewares/authMiddleware');

/* Lista e painel de assinaturas de um documento */
router.get('/documento/:documentoId', AssinaturaController.index);

/* Inicia fluxo OAuth2 gov.br */
router.get('/documento/:documentoId/govbr/iniciar', AssinaturaController.iniciarGovBr);

/* Callback OAuth2 gov.br (redirect_uri) */
router.get('/govbr/callback', AssinaturaController.callbackGovBr);

/* Assinatura simples */
router.post('/documento/:documentoId/simples', AssinaturaController.assinarSimples);

/* Download do pacote PKCS#7 (.p7s) */
router.get('/:assinaturaId/download-p7s', AssinaturaController.downloadP7s);

/* Remover assinatura (admin/gestor) */
router.post('/:assinaturaId/remover', requireRole(['admin', 'gestor']), AssinaturaController.remover);

module.exports = router;
