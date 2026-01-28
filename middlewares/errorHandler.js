// Middleware centralizado de tratamento de erros
const errorHandler = (err, req, res, next) => {
  console.error('Erro capturado:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Erro de validação
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Erro de validação',
      errors: err.errors
    });
  }

  // Erro de autenticação
  if (err.name === 'JsonWebTokenError' || err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'Token inválido ou expirado'
    });
  }

  // Erro de permissão
  if (err.name === 'ForbiddenError') {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado'
    });
  }

  // Erro do banco de dados
  if (err.code && err.code.startsWith('23')) {
    return res.status(409).json({
      success: false,
      message: 'Conflito: registro já existe'
    });
  }

  // Erro padrão
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Erro interno do servidor' 
    : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

module.exports = errorHandler;
