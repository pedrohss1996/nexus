// Emissão de eventos em tempo real, a partir do servidor
//
// Os controllers chamam estas funções depois de uma mudança de estado real.
// A versão anterior deixava o cliente emitir e o servidor rebroadcast: qualquer
// usuário autenticado podia forjar notificação e ela chegava a todas as
// unidades. Aqui o payload é montado pelo servidor e o destino é sempre uma
// sala de unidade ou de usuário — nunca 'global'.

let io = null;

function registrarIO(instancia) {
  io = instancia;
}

// Notifica todos os usuários conectados de uma unidade específica
function paraUnidade(unidadeId, evento, dados) {
  if (!io || !unidadeId) return;
  io.to(`unidade:${unidadeId}`).emit(evento, {
    ...dados,
    timestamp: new Date().toISOString()
  });
}

// Notifica um usuário específico, em todas as abas/dispositivos dele
function paraUsuario(usuarioId, evento, dados) {
  if (!io || !usuarioId) return;
  io.to(`user:${usuarioId}`).emit(evento, {
    ...dados,
    timestamp: new Date().toISOString()
  });
}

// ── Atalhos de domínio ──────────────────────────────────────────────────────
// Mantêm o formato do payload num só lugar e impedem que o controller monte
// evento com campo que não deveria trafegar.

function processoAtualizado(unidadeId, { processoId, status, titulo }) {
  paraUnidade(unidadeId, 'processo:notificacao', {
    tipo: 'atualizacao', processoId, status, titulo
  });
}

function processoRequerAtencao(unidadeId, { processoId, titulo, prioridade = 'media' }) {
  paraUnidade(unidadeId, 'processo:alerta', {
    tipo: 'atencao', processoId, titulo, prioridade
  });
}

function documentoAtualizado(unidadeId, { documentoId, processoId, status }) {
  paraUnidade(unidadeId, 'documento:notificacao', {
    tipo: 'atualizacao', documentoId, processoId, status
  });
}

module.exports = {
  registrarIO,
  paraUnidade,
  paraUsuario,
  processoAtualizado,
  processoRequerAtencao,
  documentoAtualizado
};
