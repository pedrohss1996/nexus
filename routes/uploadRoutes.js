const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configurar diretório de uploads
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuração do Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'img-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// Rota de upload
router.post('/upload-imagem', upload.single('upload'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: {
          message: 'Nenhuma imagem foi enviada'
        }
      });
    }

    // URL pública da imagem
    const imageUrl = `/uploads/${req.file.filename}`;

    // Formato esperado pelo CKEditor
    res.json({
      url: imageUrl
    });
  } catch (error) {
    console.error('Erro no upload:', error);
    res.status(500).json({
      error: {
        message: 'Erro ao fazer upload da imagem'
      }
    });
  }
});

module.exports = router;
