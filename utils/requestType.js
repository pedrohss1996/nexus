// Utilitário: tipo esperado de resposta
//
// Cuidado com req.path: dentro de um router montado (app.use('/api', ...)) o
// Express remove o prefixo do mount, então req.path vira '/notificacoes/...' e
// um teste startsWith('/api/') falha justamente nas rotas de API. O resultado
// era 302 para a tela de login em chamadas AJAX, que no browser aparece como
// erro de parse de JSON. req.originalUrl preserva o caminho completo.

function esperaJson(req) {
  const url = req.originalUrl || req.url || req.path || '';
  return url.startsWith('/api/')
    || Boolean(req.xhr)
    || Boolean(req.headers?.accept?.includes('application/json'));
}

module.exports = { esperaJson };
