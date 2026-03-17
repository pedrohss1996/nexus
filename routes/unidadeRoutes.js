const express = require('express');
const router  = express.Router();
const UnidadeController = require('../controllers/UnidadeController');
const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');

router.use(authenticateToken);

// ── Listagem / criação ────────────────────────────────────────────────────
router.get('/',    UnidadeController.listar);
router.get('/novo', requireRole(['admin']), UnidadeController.formCriar);
router.post('/',   requireRole(['admin']), UnidadeController.criar);

// ── Plano de Contas ───────────────────────────────────────────────────────
router.get('/:id/plano-contas',                               UnidadeController.planoContas);
router.post('/:id/plano-contas/contas', requireRole(['admin','gestor']), UnidadeController.criarSubcontaContabil);
router.patch('/:id/contas-contabeis/:contaId', requireRole(['admin','gestor']), UnidadeController.atualizarContaContabil);
router.delete('/:id/contas-contabeis/:contaId', requireRole(['admin','gestor']), UnidadeController.excluirContaContabil);

// ── Centros de Custo vinculados ───────────────────────────────────────────
router.post('/:id/centros-custo',        requireRole(['admin','gestor']), UnidadeController.criarCentroCusto);
router.delete('/:id/centros-custo/:ccId', requireRole(['admin','gestor']), UnidadeController.excluirCentroCusto);

// ── Metas ─────────────────────────────────────────────────────────────────
router.post('/:id/metas',              requireRole(['admin','gestor']), UnidadeController.criarMeta);
router.post('/:id/metas/:metaId',      requireRole(['admin','gestor']), UnidadeController.atualizarMeta);
router.delete('/:id/metas/:metaId',    requireRole(['admin','gestor']), UnidadeController.excluirMeta);

// ── Obrigações ────────────────────────────────────────────────────────────
router.post('/:id/obrigacoes',                   requireRole(['admin','gestor']), UnidadeController.criarObrigacao);
router.post('/:id/obrigacoes/:obrigacaoId',      requireRole(['admin','gestor']), UnidadeController.atualizarObrigacao);
router.delete('/:id/obrigacoes/:obrigacaoId',    requireRole(['admin','gestor']), UnidadeController.excluirObrigacao);

// ── Anexos ────────────────────────────────────────────────────────────────
router.post('/:id/anexos', requireRole(['admin','gestor']),
  UnidadeController.uploadAnexo.single('arquivo'), UnidadeController.criarAnexo);
router.delete('/:id/anexos/:anexoId', requireRole(['admin','gestor']), UnidadeController.excluirAnexo);

// ── Aditivos ──────────────────────────────────────────────────────────────
router.post('/:id/aditivos', requireRole(['admin','gestor']),
  UnidadeController.uploadAnexo.single('arquivo'), UnidadeController.criarAditivo);
router.delete('/:id/aditivos/:aditivoId', requireRole(['admin','gestor']), UnidadeController.excluirAditivo);

// ── Grupos e usuários ─────────────────────────────────────────────────────
router.post('/:id/grupos',        requireRole(['admin','gestor']), UnidadeController.criarGrupo);
router.post('/:id/usuarios-grupos', requireRole(['admin','gestor']), UnidadeController.vincularUsuarioGrupo);
router.post('/:id/contas-contabeis', requireRole(['admin','gestor']), UnidadeController.criarContaContabil);

// ── Detalhes / editar / desativar ─────────────────────────────────────────
router.get('/:id',        UnidadeController.detalhes);
router.get('/:id/editar', requireRole(['admin']), UnidadeController.formEditar);
router.post('/:id',       requireRole(['admin']), UnidadeController.atualizar);
router.delete('/:id',     requireRole(['admin']), UnidadeController.desativar);

module.exports = router;
