// Rotas: Grupos
const express = require('express');
const router = express.Router();
const GrupoController = require('../controllers/GrupoController');
const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');

// Aplicar autenticação em todas as rotas
router.use(authenticateToken);

// Listar grupos
router.get('/', GrupoController.listar);

// Formulário de criação
router.get('/novo', requireRole(['admin', 'gestor']), GrupoController.formCriar);

// Criar grupo
router.post('/', requireRole(['admin', 'gestor']), GrupoController.criar);

// Detalhes do grupo
router.get('/:id', GrupoController.detalhes);

// Formulário de adicionar membro
router.get('/:id/adicionar-membro', requireRole(['admin', 'gestor']), GrupoController.formAdicionarMembro);

// Formulário de edição
router.get('/:id/editar', requireRole(['admin', 'gestor']), GrupoController.formEditar);

// Atualizar grupo
router.post('/:id', requireRole(['admin', 'gestor']), GrupoController.atualizar);

// Desativar grupo
router.delete('/:id', requireRole(['admin']), GrupoController.desativar);

// Adicionar membro ao grupo
router.post('/:id/membros', requireRole(['admin', 'gestor']), GrupoController.adicionarMembro);

// Remover membro do grupo
router.delete('/:id/membros/:usuario_id', requireRole(['admin', 'gestor']), GrupoController.removerMembro);

// Definir/remover líder
router.patch('/:id/membros/:usuario_id/lider', requireRole(['admin', 'gestor']), GrupoController.definirLider);

module.exports = router;
