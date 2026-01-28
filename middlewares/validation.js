const { body, validationResult } = require('express-validator');

// Middleware para verificar resultados da validação
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Erro de validação',
      errors: errors.array()
    });
  }
  next();
};

// Validações comuns
const sanitizeInput = (req, res, next) => {
  // Sanitizar strings removendo caracteres perigosos
  const sanitize = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .trim();
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);

  next();
};

// Validações específicas
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('senha')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter no mínimo 6 caracteres'),
  validate
];

const validateProcesso = [
  body('titulo')
    .trim()
    .isLength({ min: 3, max: 255 })
    .withMessage('Título deve ter entre 3 e 255 caracteres'),
  body('descricao')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Descrição muito longa'),
  body('centro_custo_id')
    .optional()
    .isInt()
    .withMessage('ID do centro de custo inválido'),
  validate
];

module.exports = {
  validate,
  sanitizeInput,
  validateLogin,
  validateProcesso
};
