// Rotas: Usuários
const express = require('express');
const router = express.Router();
const UsuarioController = require('../controllers/UsuarioController');
const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');

// Aplicar autenticação em todas as rotas
router.use(authenticateToken);

// Listar usuários
router.get('/', requireRole(['admin', 'gestor']), UsuarioController.listar);

// Formulário de criação
router.get('/novo', requireRole(['admin']), UsuarioController.formCriar);

// Criar usuário
router.post('/', requireRole(['admin']), UsuarioController.criar);

// Detalhes do usuário
router.get('/:id', requireRole(['admin', 'gestor']), UsuarioController.detalhes);

// Formulário de edição
router.get('/:id/editar', requireRole(['admin']), UsuarioController.formEditar);

// Atualizar usuário
router.post('/:id', requireRole(['admin']), UsuarioController.atualizar);

// Formulário de alteração de senha
router.get('/:id/alterar-senha', requireRole(['admin']), UsuarioController.formAlterarSenha);

// Alterar senha
router.post('/:id/alterar-senha', requireRole(['admin']), UsuarioController.alterarSenha);

// Desativar usuário
router.delete('/:id', requireRole(['admin']), UsuarioController.desativar);

// Reativar usuário
router.patch('/:id/reativar', requireRole(['admin']), UsuarioController.reativar);

// Gerenciar vínculos (grupos e unidades)
router.get('/:id/vinculos', requireRole(['admin', 'gestor']), UsuarioController.gerenciarVinculos);

// Adicionar vínculo
router.post('/:id/vinculos', requireRole(['admin', 'gestor']), UsuarioController.adicionarVinculo);

module.exports = router;
