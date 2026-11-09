const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');

// Rotas de autenticação
router.get('/login', AuthController.showLogin);
router.post('/login', AuthController.login);
router.get('/logout', AuthController.logout);
router.post('/logout', AuthController.logout);
// Não há auto-registro: contas são criadas por um admin (/cadastros/usuarios)
// ou via scripts/criar-usuario.js. Um /register público permitia que qualquer
// pessoa criasse uma conta — inclusive com perfil admin.

module.exports = router;
