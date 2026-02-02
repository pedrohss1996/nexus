// Rotas: Usuários
const express = require('express');
const router = express.Router();
const UsuarioController = require('../controllers/UsuarioController');
const { authenticateToken, requireRole, allowSelfOrRole } = require('../middlewares/authMiddleware');

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

// Formulário de edição (próprio perfil ou admin)
router.get('/:id/editar', allowSelfOrRole(['admin']), UsuarioController.formEditar);

// Atualizar usuário (próprio perfil ou admin; apenas admin pode alterar perfil de outros)
router.post('/:id', allowSelfOrRole(['admin']), UsuarioController.atualizar);

// Formulário de alteração de senha (próprio perfil ou admin)
router.get('/:id/alterar-senha', allowSelfOrRole(['admin']), UsuarioController.formAlterarSenha);

// Alterar senha (próprio perfil ou admin)
router.post('/:id/alterar-senha', allowSelfOrRole(['admin']), UsuarioController.alterarSenha);

// Desativar usuário
router.delete('/:id', requireRole(['admin']), UsuarioController.desativar);

// Reativar usuário
router.patch('/:id/reativar', requireRole(['admin']), UsuarioController.reativar);

// Gerenciar vínculos (grupos e unidades)
router.get('/:id/vinculos', requireRole(['admin', 'gestor']), UsuarioController.gerenciarVinculos);

// Adicionar vínculo
router.post('/:id/vinculos', requireRole(['admin', 'gestor']), UsuarioController.adicionarVinculo);

module.exports = router;
