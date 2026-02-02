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

// Plano de Contas (página hierárquica)
router.get('/:id/plano-contas', UnidadeController.planoContas);

// API Plano de Contas: criar subconta (JSON)
router.post('/:id/plano-contas/contas', requireRole(['admin', 'gestor']), UnidadeController.criarSubcontaContabil);

// API Plano de Contas: atualizar conta (JSON, validação de teto)
router.patch('/:id/contas-contabeis/:contaId', requireRole(['admin', 'gestor']), UnidadeController.atualizarContaContabil);

// API Plano de Contas: excluir conta (e filhas em cascade)
router.delete('/:id/contas-contabeis/:contaId', requireRole(['admin', 'gestor']), UnidadeController.excluirContaContabil);

// Detalhes da unidade
router.get('/:id', UnidadeController.detalhes);

// Criar conta contábil na unidade (formulário flat - legado)
router.post('/:id/contas-contabeis', requireRole(['admin', 'gestor']), UnidadeController.criarContaContabil);

// Criar grupo na unidade (formulário simples)
router.post('/:id/grupos', requireRole(['admin', 'gestor']), UnidadeController.criarGrupo);

// Vincular usuário ao grupo (na unidade)
router.post('/:id/usuarios-grupos', requireRole(['admin', 'gestor']), UnidadeController.vincularUsuarioGrupo);

// Formulário de edição
router.get('/:id/editar', requireRole(['admin']), UnidadeController.formEditar);

// Atualizar unidade
router.post('/:id', requireRole(['admin']), UnidadeController.atualizar);

// Desativar unidade
router.delete('/:id', requireRole(['admin']), UnidadeController.desativar);

module.exports = router;
