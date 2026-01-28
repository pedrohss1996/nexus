// Rotas: Unidades
const express = require('express');
const router = express.Router();
const UnidadeController = require('../controllers/UnidadeController');
const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');

// Aplicar autenticação em todas as rotas
router.use(authenticateToken);

// Listar unidades
router.get('/', UnidadeController.listar);

// Formulário de criação
router.get('/novo', requireRole(['admin']), UnidadeController.formCriar);

// Criar unidade
router.post('/', requireRole(['admin']), UnidadeController.criar);

// Detalhes da unidade
router.get('/:id', UnidadeController.detalhes);

// Formulário de edição
router.get('/:id/editar', requireRole(['admin']), UnidadeController.formEditar);

// Atualizar unidade
router.post('/:id', requireRole(['admin']), UnidadeController.atualizar);

// Desativar unidade
router.delete('/:id', requireRole(['admin']), UnidadeController.desativar);

module.exports = router;
