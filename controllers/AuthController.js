const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { validateLogin } = require('../middlewares/validation');
const { auditLog } = require('../utils/logger');
const { mockUser } = require('../utils/mockData');

class AuthController {
  // Mostrar página de login
  static showLogin(req, res) {
    res.render('auth/login', { 
      title: 'Login - DataFlow',
      error: null 
    });
  }

  // Processar login
  static async login(req, res) {
    try {
      // Aceitar tanto 'email' quanto 'usuario' no campo
      const email = req.body.email || req.body.usuario;
      const senha = req.body.senha;

      // Modo MOCK: Aceitar login sem banco de dados
      // Use: admin@dataflow.com / admin123 ou qualquer email/senha
      const USE_MOCK_MODE = process.env.USE_MOCK_DATA === 'true' || !process.env.DB_PASSWORD;
      
      if (USE_MOCK_MODE) {
        console.log('⚠️  MODO MOCK ATIVO - Usando dados mockados');
        
        // Aceitar qualquer login no modo mock
        if (!email || !senha) {
          return res.render('auth/login', {
            title: 'Login - DataFlow',
            error: 'Email e senha são obrigatórios'
          });
        }

        // Gerar token JWT com usuário mockado
        const token = jwt.sign(
          { 
            userId: mockUser.id, 
            email: mockUser.email,
            perfil: mockUser.perfil,
            mock: true // Flag para indicar que é mock
          },
          process.env.JWT_SECRET || 'mock-secret-key-for-development-only',
          { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        // Salvar token em cookie
        res.cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 24 * 60 * 60 * 1000 // 24 horas
        });

        console.log('✅ Login mockado bem-sucedido');
        res.redirect('/dashboard');
        return;
      }

      // Modo NORMAL: Usar banco de dados
      // Validar entrada
      await validateLogin[0].run(req);
      await validateLogin[1].run(req);

      // Buscar usuário
      const result = await query(
        'SELECT id, nome, email, senha, perfil, ativo FROM usuarios WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.render('auth/login', {
          title: 'Login - DataFlow',
          error: 'Email ou senha inválidos'
        });
      }

      const user = result.rows[0];

      // Verificar se usuário está ativo
      if (!user.ativo) {
        return res.render('auth/login', {
          title: 'Login - DataFlow',
          error: 'Usuário inativo. Entre em contato com o administrador.'
        });
      }

      // Verificar senha
      const senhaValida = await bcrypt.compare(senha, user.senha);
      if (!senhaValida) {
        auditLog('TENTATIVA_LOGIN_INVALIDA', null, { email, ip: req.ip });
        return res.render('auth/login', {
          title: 'Login - DataFlow',
          error: 'Email ou senha inválidos'
        });
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
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
      });

      // Registrar login bem-sucedido
      auditLog('LOGIN_SUCESSO', user.id, { email, ip: req.ip });

      // Redirecionar para dashboard
      res.redirect('/dashboard');
    } catch (error) {
      console.error('Erro no login:', error);
      
      // Se der erro de conexão com banco, usar modo mock
      if (error.code === 'ECONNREFUSED' || error.message.includes('connect')) {
        console.log('⚠️  Erro de conexão com banco. Usando modo MOCK...');
        
        const { email, senha } = req.body;
        if (email && senha) {
          const token = jwt.sign(
            { 
              userId: mockUser.id, 
              email: mockUser.email,
              perfil: mockUser.perfil,
              mock: true
            },
            process.env.JWT_SECRET || 'mock-secret-key-for-development-only',
            { expiresIn: '24h' }
          );

          res.cookie('token', token, {
            httpOnly: true,
            secure: false,
            maxAge: 24 * 60 * 60 * 1000
          });

          return res.redirect('/dashboard');
        }
      }
      
      res.render('auth/login', {
        title: 'Login - DataFlow',
        error: 'Erro ao processar login. Tente novamente.'
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

  // Mostrar página de registro (apenas para desenvolvimento)
  static showRegister(req, res) {
    res.render('auth/register', { 
      title: 'Registro - DataFlow',
      error: null 
    });
  }

  // Processar registro
  static async register(req, res) {
    try {
      const { nome, email, senha, perfil = 'usuario' } = req.body;

      // Validar entrada
      if (!nome || !email || !senha) {
        return res.render('auth/register', {
          title: 'Registro - DataFlow',
          error: 'Todos os campos são obrigatórios'
        });
      }

      // Verificar se email já existe
      const existingUser = await query(
        'SELECT id FROM usuarios WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.render('auth/register', {
          title: 'Registro - DataFlow',
          error: 'Email já cadastrado'
        });
      }

      // Hash da senha
      const senhaHash = await bcrypt.hash(senha, 10);

      // Criar usuário
      const result = await query(
        `INSERT INTO usuarios (nome, email, senha, perfil, ativo, criado_em)
         VALUES ($1, $2, $3, $4, true, NOW())
         RETURNING id, nome, email, perfil`,
        [nome, email, senhaHash, perfil]
      );

      auditLog('USUARIO_CRIADO', result.rows[0].id, { email, perfil, ip: req.ip });

      res.redirect('/auth/login');
    } catch (error) {
      console.error('Erro no registro:', error);
      res.render('auth/register', {
        title: 'Registro - DataFlow',
        error: 'Erro ao criar conta. Tente novamente.'
      });
    }
  }
}

module.exports = AuthController;
