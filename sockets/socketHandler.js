const { authenticateToken } = require('../middlewares/authMiddleware');
const jwt = require('jsonwebtoken');

// Handler principal do Socket.io
const socketHandler = (io) => {
  // Middleware de autenticação para Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.token;
      
      if (!token) {
        return next(new Error('Token não fornecido'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userPerfil = decoded.perfil;
      next();
    } catch (error) {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ Cliente conectado: ${socket.id} (User: ${socket.userId})`);

    // Entrar em sala do usuário para notificações pessoais
    socket.join(`user:${socket.userId}`);

    // Entrar em sala global para atualizações gerais
    socket.join('global');

    // Evento: processo atualizado
    socket.on('processo:atualizado', (data) => {
      // Broadcast para todos os usuários interessados
      io.to('global').emit('processo:notificacao', {
        tipo: 'atualizacao',
        processoId: data.processoId,
        mensagem: data.mensagem,
        timestamp: new Date().toISOString()
      });
    });

    // Evento: documento atualizado
    socket.on('documento:atualizado', (data) => {
      io.to('global').emit('documento:notificacao', {
        tipo: 'atualizacao',
        documentoId: data.documentoId,
        processoId: data.processoId,
        mensagem: data.mensagem,
        timestamp: new Date().toISOString()
      });
    });

    // Evento: processo requer atenção
    socket.on('processo:requer_atencao', (data) => {
      // Notificar apenas usuários com permissão de aprovação
      io.to('global').emit('processo:alerta', {
        tipo: 'atencao',
        processoId: data.processoId,
        mensagem: data.mensagem,
        prioridade: data.prioridade || 'media',
        timestamp: new Date().toISOString()
      });
    });

    // Desconexão
    socket.on('disconnect', () => {
      console.log(`❌ Cliente desconectado: ${socket.id}`);
    });
  });

  return io;
};

module.exports = socketHandler;
