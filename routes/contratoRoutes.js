const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const ContratoController = require('../controllers/ContratoController');

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

// CRUD principal
router.get('/', ContratoController.index);
router.get('/novo', ContratoController.formNovo);
router.post('/', ContratoController.criar);
router.get('/:id', ContratoController.detalhes);
router.get('/:id/editar', ContratoController.formEditar);
router.post('/:id', ContratoController.atualizar);
router.delete('/:id', ContratoController.excluir);
router.post('/:id/excluir', ContratoController.excluir);
router.post('/:id/cancelar', ContratoController.cancelar);

// Obrigações
router.post('/:id/obrigacoes', ContratoController.criarObrigacao);
router.post('/:id/obrigacoes/:obrigacaoId', ContratoController.atualizarObrigacao);
router.post('/:id/obrigacoes/:obrigacaoId/excluir', ContratoController.excluirObrigacao);

// Pagamentos
router.post('/:id/pagamentos', ContratoController.criarPagamento);
router.post('/:id/pagamentos/:pagamentoId/excluir', ContratoController.excluirPagamento);

// SLAs
router.post('/:id/slas', ContratoController.criarSLA);
router.post('/:id/slas/:slaId/excluir', ContratoController.excluirSLA);

// Aditivos
router.post('/:id/aditivos', ContratoController.criarAditivo);
router.post('/:id/aditivos/:aditivoId/excluir', ContratoController.excluirAditivo);

// Anexos
router.post('/:id/anexos', upload.single('anexo'), (req, res, next) => {
  ContratoController.uploadAnexo(req, res).catch(next);
});
router.post('/:id/anexos/:anexoId/excluir', ContratoController.excluirAnexo);

module.exports = router;
