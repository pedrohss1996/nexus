const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { esperaJson } = require('../utils/requestType');

// Middleware de autenticação JWT
const authenticateToken = async (req, res, next) => {
  try {
    // Verificar token no header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    // Se não tiver token no header, verificar no cookie
    const cookieToken = req.cookies?.token || token;

    if (!cookieToken) {
      if (esperaJson(req)) {
        return res.status(401).json({
          success: false,
          message: 'Sessão expirada. Faça login novamente.'
        });
      }
      return res.redirect('/auth/login');
    }

    // Verificar e decodificar token.
    // Sem fallback: um segredo padrão conhecido permitiria forjar qualquer
    // token caso a variável sumisse em dev/staging.
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET não configurado — autenticação indisponível');
    }
    const decoded = jwt.verify(cookieToken, jwtSecret);

    if (decoded.mock) {
      if (esperaJson(req)) {
        return res.status(401).json({
          success: false,
          message: 'Sessão inválida. Faça login novamente.'
        });
      }
      res.clearCookie('token');
      return res.redirect('/auth/login');
    }

    // Buscar usuário no banco
    try {
      const result = await query(
        'SELECT id, nome, email, perfil, ativo FROM usuarios WHERE id = $1 AND ativo = true',
        [decoded.userId]
      );

        if (result.rows.length === 0) {
        if (esperaJson(req)) {
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
      throw error;
    }
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      if (esperaJson(req)) {
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
      if (esperaJson(req)) {
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
      if (esperaJson(req)) {
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

// Permite acesso se o usuário está editando a si mesmo (req.params.id === req.user.id) ou tem um dos roles
const allowSelfOrRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      if (esperaJson(req)) {
        return res.status(401).json({ success: false, message: 'Autenticação necessária' });
      }
      return res.redirect('/auth/login');
    }
    const id = req.params.id && parseInt(req.params.id, 10);
    const isSelf = id === req.user.id;
    const rolesArray = Array.isArray(roles) ? roles : [roles];
    const hasRole = rolesArray.includes(req.user.perfil);
    if (isSelf || hasRole) return next();
    if (esperaJson(req)) {
      return res.status(403).json({ success: false, message: 'Permissão insuficiente' });
    }
    return res.status(403).render('error', {
      title: 'Acesso Negado - DataFlow',
      message: 'Você não tem permissão para acessar esta página.',
      user: req.user
    });
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  allowSelfOrRole
};
