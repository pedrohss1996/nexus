const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const ProcessoController = require('../controllers/ProcessoController');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'processos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storageProcessos = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const base = (file.originalname || 'anexo').replace(/\s+/g, '-').slice(0, 80);
    cb(null, Date.now() + '-' + base);
  }
});

const uploadProcessos = multer({
  storage: storageProcessos,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|doc|docx|xls|xlsx|jpg|jpeg|png|gif|webp|zip|txt/i;
    const ext = path.extname(file.originalname).slice(1);
    if (allowed.test(ext) || (file.mimetype && allowed.test(file.mimetype))) return cb(null, true);
    cb(new Error('Tipo de arquivo não permitido. Use PDF, DOC, XLS, imagens ou ZIP.'));
  }
});

// Rotas de processos
router.get('/', ProcessoController.index);
router.get('/novo', ProcessoController.create);
router.post('/', uploadProcessos.array('anexos', 10), ProcessoController.store);
router.get('/:id', ProcessoController.show);
router.get('/:id/editar', ProcessoController.edit);
router.put('/:id', ProcessoController.update);
router.delete('/:id', ProcessoController.destroy);
router.post('/:id/aprovar', ProcessoController.aprovar);
router.post('/:id/rejeitar', ProcessoController.rejeitar);

module.exports = router;
