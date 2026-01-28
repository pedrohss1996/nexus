const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');

// Rotas de autenticação
router.get('/login', AuthController.showLogin);
router.post('/login', AuthController.login);
router.post('/logout', AuthController.logout);
router.get('/register', AuthController.showRegister);
router.post('/register', AuthController.register);

module.exports = router;
