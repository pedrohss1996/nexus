const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { validateLogin } = require('../middlewares/validation');
const { auditLog } = require('../utils/logger');
class AuthController {
  // Mostrar página de login
  // Para exibir uma imagem à esquerda: coloque o arquivo em public/imgs/login-banner.jpg
  // ou defina process.env.LOGIN_IMAGE_PATH com o caminho desejado
  static showLogin(req, res) {
    const loginImage = process.env.LOGIN_IMAGE_PATH || '/imgs/login-banner.jpg';
    res.render('auth/login', {
      title: 'Login - DataFlow',
      error: null,
      loginImage
    });
  }

  // Processar login
  static async login(req, res) {
    try {
      // Aceitar tanto 'email' quanto 'usuario' no campo
      const email = req.body.email || req.body.usuario;
      const senha = req.body.senha;

      // Validar entrada
      await validateLogin[0].run(req);
      await validateLogin[1].run(req);

      // Buscar usuário
      const result = await query(
        'SELECT id, nome, email, senha, perfil, ativo FROM usuarios WHERE email = $1',
        [email]
      );

      // Falhas respondem 401 (não 200): o loginLimiter usa
      // skipSuccessfulRequests, que trata qualquer status < 400 como sucesso —
      // com 200 nenhuma tentativa errada era contada e o brute-force ficava livre.
      const loginImage = process.env.LOGIN_IMAGE_PATH || '/imgs/login-banner.jpg';
      const falhar = (error) => res.status(401).render('auth/login', {
        title: 'Login - DataFlow',
        error,
        loginImage
      });

      if (result.rows.length === 0) {
        return falhar('Email ou senha inválidos');
      }

      const user = result.rows[0];

      // Senha antes do status "ativo": checar ativo primeiro revelava, sem
      // senha, quais e-mails existem no sistema.
      const senhaValida = await bcrypt.compare(senha || '', user.senha);
      if (!senhaValida) {
        auditLog('TENTATIVA_LOGIN_INVALIDA', null, { email, ip: req.ip });
        return falhar('Email ou senha inválidos');
      }

      if (!user.ativo) {
        return falhar('Usuário inativo. Entre em contato com o administrador.');
      }

      // Gerar token JWT
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email,
          perfil: user.perfil 
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      // Salvar token em cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', // impede envio do cookie em requisições cross-site (CSRF)
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
      });

      // Registrar login bem-sucedido
      auditLog('LOGIN_SUCESSO', user.id, { email, ip: req.ip });

      // Redirecionar para início
      res.redirect('/inicio');
    } catch (error) {
      console.error('Erro no login:', error);
      const loginImage = process.env.LOGIN_IMAGE_PATH || '/imgs/login-banner.jpg';
      res.render('auth/login', {
        title: 'Login - DataFlow',
        error: 'Erro ao processar login. Tente novamente.',
        loginImage
      });
    }
  }

  // Logout
  static logout(req, res) {
    if (req.user) {
      auditLog('LOGOUT', req.user.id, { ip: req.ip });
    }
    res.clearCookie('token');
    res.redirect('/auth/login');
  }
}

module.exports = AuthController;
