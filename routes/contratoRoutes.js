const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const ContratoController = require('../controllers/ContratoController');
const contratoDaUnidade = require('../middlewares/contratoScope');
const { requireRole } = require('../middlewares/authMiddleware');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'contratos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadDir, String(req.params.id));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const base = (file.originalname || 'anexo').replace(/\s+/g, '-').slice(0, 80);
    cb(null, Date.now() + '-' + base);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|doc|docx|xls|xlsx|jpg|jpeg|png|gif|webp|zip/i;
    const ext = path.extname(file.originalname).slice(1);
    if (allowed.test(ext) || allowed.test(file.mimetype)) return cb(null, true);
    cb(new Error('Tipo de arquivo não permitido.'));
  }
});

// Todo :id de contrato é validado contra a unidade ativa antes de qualquer
// handler — inclusive antes do multer, para não gravar anexo de contrato alheio.
router.param('id', contratoDaUnidade);

// Contratos são documentos jurídico-financeiros: escrita restrita a admin/gestor
const podeEscrever = requireRole(['admin', 'gestor']);

// CRUD principal
router.get('/', ContratoController.index);
router.get('/novo', podeEscrever, ContratoController.formNovo);
router.post('/', podeEscrever, ContratoController.criar);
router.get('/:id', ContratoController.detalhes);
router.get('/:id/editar', podeEscrever, ContratoController.formEditar);
router.post('/:id', podeEscrever, ContratoController.atualizar);
router.delete('/:id', requireRole(['admin']), ContratoController.excluir);
router.post('/:id/excluir', requireRole(['admin']), ContratoController.excluir);
router.post('/:id/cancelar', podeEscrever, ContratoController.cancelar);

// Obrigações
router.post('/:id/obrigacoes', podeEscrever, ContratoController.criarObrigacao);
router.post('/:id/obrigacoes/:obrigacaoId', podeEscrever, ContratoController.atualizarObrigacao);
router.post('/:id/obrigacoes/:obrigacaoId/excluir', podeEscrever, ContratoController.excluirObrigacao);

// Pagamentos
router.post('/:id/pagamentos', podeEscrever, ContratoController.criarPagamento);
router.post('/:id/pagamentos/:pagamentoId/excluir', podeEscrever, ContratoController.excluirPagamento);

// SLAs
router.post('/:id/slas', podeEscrever, ContratoController.criarSLA);
router.post('/:id/slas/:slaId/excluir', podeEscrever, ContratoController.excluirSLA);

// Aditivos
router.post('/:id/aditivos', podeEscrever, ContratoController.criarAditivo);
router.post('/:id/aditivos/:aditivoId/excluir', podeEscrever, ContratoController.excluirAditivo);

// Anexos
router.post('/:id/anexos', podeEscrever, upload.single('anexo'), (req, res, next) => {
  ContratoController.uploadAnexo(req, res).catch(next);
});
router.post('/:id/anexos/:anexoId/excluir', podeEscrever, ContratoController.excluirAnexo);

module.exports = router;
