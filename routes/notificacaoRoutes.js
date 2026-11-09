const express = require('express');
const router = express.Router();
const NotificacaoController = require('../controllers/NotificacaoController');
const { requireRole } = require('../middlewares/authMiddleware');

// ── Usuário ──────────────────────────────────────────────────────────────────
router.get('/', NotificacaoController.listar);
router.post('/:id/lida', NotificacaoController.marcarLida);
router.post('/todas-lidas', NotificacaoController.marcarTodasLidas);

// ── Admin ────────────────────────────────────────────────────────────────────
// A checagem de perfil também existe dentro do controller; declará-la aqui deixa
// a permissão visível na própria rota e alinha com o padrão dos demais módulos.
const somenteAdmin = requireRole(['admin']);

router.get('/admin', somenteAdmin, NotificacaoController.adminIndex);
router.post('/admin',
  somenteAdmin,
  NotificacaoController.upload.single('imagem'),
  NotificacaoController.adminCriar
);
router.delete('/admin/:id', somenteAdmin, NotificacaoController.adminArquivar);

module.exports = router;
