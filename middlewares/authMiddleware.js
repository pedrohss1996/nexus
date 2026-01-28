const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { mockUser } = require('../utils/mockData');

// Middleware de autenticação JWT
const authenticateToken = async (req, res, next) => {
  try {
    // Verificar token no header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    // Se não tiver token no header, verificar no cookie
    const cookieToken = req.cookies?.token || token;

    if (!cookieToken) {
      // Se for requisição de API, retornar JSON
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          message: 'Token de autenticação não fornecido'
        });
      }
      // Se for view, redirecionar para login
      return res.redirect('/auth/login');
    }

    // Verificar e decodificar token
    const jwtSecret = process.env.JWT_SECRET || 'mock-secret-key-for-development-only';
    const decoded = jwt.verify(cookieToken, jwtSecret);

    // Se for usuário mockado, usar dados mockados
    if (decoded.mock) {
      console.log('🔷 Usando usuário MOCK:', mockUser);
      req.user = mockUser;
      return next();
    }

    // Buscar usuário no banco
    try {
      const result = await query(
        'SELECT id, nome, email, perfil, ativo FROM usuarios WHERE id = $1 AND ativo = true',
        [decoded.userId]
      );

        if (result.rows.length === 0) {
        if (req.path.startsWith('/api/')) {
          return res.status(401).json({
            success: false,
            message: 'Usuário não encontrado ou inativo'
          });
        }
        return res.redirect('/auth/login');
      }

      // Adicionar dados do usuário à requisição
      req.user = result.rows[0];
      next();
    } catch (error) {
      // Se der erro de conexão, usar modo mock
      if (error.code === 'ECONNREFUSED' || error.message.includes('connect')) {
        console.log('⚠️  Erro de conexão com banco. Usando modo MOCK...');
        req.user = mockUser;
        return next();
      }
      throw error;
    }
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          message: 'Token inválido ou expirado'
        });
      }
      res.clearCookie('token');
      return res.redirect('/auth/login');
    }
    next(error);
  }
};

// Middleware de verificação de permissões (RBAC)
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      // Se for requisição de API, retornar JSON
      if (req.path.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({
          success: false,
          message: 'Autenticação necessária'
        });
      }
      // Se for view, redirecionar para login
      return res.redirect('/auth/login');
    }

    // Normalizar roles para array
    const rolesArray = Array.isArray(roles) ? roles : [roles];
    
    // Verificar se o perfil do usuário está na lista de roles permitidos
    if (!rolesArray.includes(req.user.perfil)) {
      console.log(`⚠️  Acesso negado: Usuário ${req.user.email} (perfil: ${req.user.perfil}) tentou acessar recurso que requer perfil: ${rolesArray.join(', ')}`);
      
      // Se for requisição de API, retornar JSON
      if (req.path.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }
      // Se for view, renderizar página de erro
      return res.status(403).render('error', {
        title: 'Acesso Negado - DataFlow',
        message: 'Você não tem permissão para acessar esta página.',
        user: req.user
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole
};
