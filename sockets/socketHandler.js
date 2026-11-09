// Handler do Socket.io
//
// Reescrito para fechar três problemas da versão anterior:
//
// 1. Todo evento era rebroadcast para a sala 'global' — ou seja, para usuários
//    de TODAS as unidades. Isso furava o isolamento multi-unidade construído no
//    resto da aplicação. Agora cada conexão entra apenas nas salas das unidades
//    com as quais o usuário tem vínculo.
//
// 2. O servidor reemitia payload vindo do cliente (`socket.on('processo:atualizado')`
//    → `io.to('global').emit(...)`), então qualquer usuário autenticado podia
//    forjar notificação em nome do sistema. Notificação agora nasce no servidor,
//    a partir de mudança de estado real — ver sockets/notificar.js.
//
// 3. O handshake só fazia jwt.verify, sem consultar o banco: um usuário
//    desativado mantinha o socket aberto até o token expirar (até 24h).

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { registrarIO } = require('./notificar');

const socketHandler = (io) => {
  registrarIO(io);

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.token;
      if (!token) return next(new Error('Token não fornecido'));

      if (!process.env.JWT_SECRET) {
        return next(new Error('Autenticação indisponível'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.mock) return next(new Error('Token inválido'));

      // Mesma checagem do fluxo HTTP: o usuário precisa existir e estar ativo
      const usuario = await query(
        'SELECT id, nome, email, perfil FROM usuarios WHERE id = $1 AND ativo = true',
        [decoded.userId]
      );
      if (usuario.rows.length === 0) {
        return next(new Error('Usuário não encontrado ou inativo'));
      }

      // Unidades com vínculo — admin acessa todas
      const unidades = usuario.rows[0].perfil === 'admin'
        ? await query('SELECT id FROM unidades WHERE ativo = true')
        : await query(
            `SELECT DISTINCT ug.unidade_id AS id
             FROM usuarios_grupos ug
             INNER JOIN unidades u ON u.id = ug.unidade_id
             WHERE ug.usuario_id = $1 AND u.ativo = true`,
            [decoded.userId]
          );

      socket.usuario = usuario.rows[0];
      socket.unidadesPermitidas = unidades.rows.map(r => r.id);
      next();
    } catch (error) {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    const { id: userId, email } = socket.usuario;

    // Sala pessoal (notificações direcionadas)
    socket.join(`user:${userId}`);

    // Uma sala por unidade permitida — o escopo do broadcast
    socket.unidadesPermitidas.forEach(unidadeId => {
      socket.join(`unidade:${unidadeId}`);
    });

    console.log(
      `✅ Socket conectado: ${email} (unidades: ${socket.unidadesPermitidas.join(', ') || 'nenhuma'})`
    );

    // Não há handlers de escuta que reemitam para outros clientes: o cliente é
    // consumidor de eventos, não fonte. Qualquer notificação parte do servidor
    // quando o estado realmente muda (ver notificar.js).

    socket.on('disconnect', () => {
      console.log(`❌ Socket desconectado: ${email}`);
    });
  });

  return io;
};

module.exports = socketHandler;
