const express = require('express');
const router = express.Router();
const NotificacaoController = require('../controllers/NotificacaoController');

// ── Usuário ──────────────────────────────────────────────────────────────────
router.get('/', NotificacaoController.listar);
router.post('/:id/lida', NotificacaoController.marcarLida);
router.post('/todas-lidas', NotificacaoController.marcarTodasLidas);

// ── Admin ────────────────────────────────────────────────────────────────────
router.get('/admin', NotificacaoController.adminIndex);
router.post('/admin',
  NotificacaoController.upload.single('imagem'),
  NotificacaoController.adminCriar
);
router.delete('/admin/:id', NotificacaoController.adminArquivar);

module.exports = router;
