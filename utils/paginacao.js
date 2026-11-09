// Utilitário: paginação
//
// Antes deste helper nenhuma listagem tinha LIMIT: /processos devolvia a tabela
// inteira (medido: 13 MB de HTML e 16.668 linhas com 50k registros). Além do
// custo de rede e render, cada request carregava tudo na memória do processo.
//
// O total vem de COUNT(*) OVER() na própria query paginada, evitando um segundo
// roundtrip só para contar.

const POR_PAGINA_PADRAO = 25;
const POR_PAGINA_MAXIMO = 200;

// Lê página/tamanho da querystring com limites — impede ?por_pagina=999999
function lerPaginacao(req, { padrao = POR_PAGINA_PADRAO, maximo = POR_PAGINA_MAXIMO } = {}) {
  const paginaBruta = parseInt(req.query.pagina, 10);
  const porPaginaBruta = parseInt(req.query.por_pagina, 10);

  const pagina = Number.isNaN(paginaBruta) || paginaBruta < 1 ? 1 : paginaBruta;
  const porPagina = Number.isNaN(porPaginaBruta)
    ? padrao
    : Math.min(maximo, Math.max(1, porPaginaBruta));

  return { pagina, porPagina, offset: (pagina - 1) * porPagina };
}

// Monta os metadados que a view usa para desenhar os controles.
// `linhas` são as linhas devolvidas pela query paginada (com a coluna _total).
function montarMeta({ pagina, porPagina }, linhas, baseUrl, queryAtual = {}) {
  const total = linhas.length > 0 ? parseInt(linhas[0]._total, 10) : 0;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  // Remove a coluna técnica antes de entregar para a view
  const itens = linhas.map(({ _total, ...resto }) => resto);

  return {
    itens,
    meta: {
      pagina,
      porPagina,
      total,
      totalPaginas,
      primeiroItem: total === 0 ? 0 : (pagina - 1) * porPagina + 1,
      ultimoItem: Math.min(pagina * porPagina, total),
      temAnterior: pagina > 1,
      temProxima: pagina < totalPaginas,
      baseUrl,
      // Preserva filtros ativos ao trocar de página
      query: Object.fromEntries(
        Object.entries(queryAtual).filter(([k, v]) => k !== 'pagina' && v !== '' && v != null)
      )
    }
  };
}

// Fragmento SQL: adiciona LIMIT/OFFSET usando os próximos placeholders livres.
// Devolve o trecho e os valores a concatenar no array de parâmetros.
function limitOffset(proximoIndice, { porPagina, offset }) {
  return {
    sql: ` LIMIT $${proximoIndice} OFFSET $${proximoIndice + 1}`,
    valores: [porPagina, offset]
  };
}

module.exports = {
  lerPaginacao,
  montarMeta,
  limitOffset,
  POR_PAGINA_PADRAO,
  POR_PAGINA_MAXIMO
};
