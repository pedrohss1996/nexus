const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const FornecedorController = require('../controllers/FornecedorController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const loadUnidades = require('../middlewares/loadUnidades');

router.use(authenticateToken);
router.use(loadUnidades);

// Armazenamento de anexos por fornecedor
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'fornecedores');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storageAnexos = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadDir, String(req.params.id));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const base = (file.originalname || 'anexo').replace(/\s+/g, '-').slice(0, 80);
    cb(null, Date.now() + '-' + base);
  }
});

const uploadAnexos = multer({
  storage: storageAnexos,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|doc|docx|xls|xlsx|jpg|jpeg|png|gif|webp|zip/i;
    const ext = path.extname(file.originalname).slice(1);
    if (allowed.test(ext) || allowed.test(file.mimetype)) return cb(null, true);
    cb(new Error('Tipo de arquivo não permitido. Use PDF, DOC, XLS, imagens ou ZIP.'));
  }
});

// Rotas de fornecedores
router.get('/', FornecedorController.index);
router.get('/novo', FornecedorController.create);
router.post('/', FornecedorController.store);
router.get('/:id/editar', FornecedorController.edit);
router.get('/:id', FornecedorController.show);
router.post('/:id', FornecedorController.update);
router.delete('/:id', FornecedorController.destroy);

// Anexos
router.post('/:id/anexos', uploadAnexos.single('anexo'), (req, res, next) => {
  FornecedorController.uploadAnexo(req, res).catch(next);
});
router.delete('/:id/anexos/:anexoId', FornecedorController.destroyAnexo);
router.post('/:id/anexos/:anexoId/excluir', FornecedorController.destroyAnexo);

module.exports = router;
