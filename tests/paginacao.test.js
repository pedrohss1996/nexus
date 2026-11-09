// Testes: paginação
// O limite superior é um controle de disponibilidade: sem ele, ?por_pagina=999999
// devolve a tabela inteira — exatamente o problema que a paginação resolveu.

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { lerPaginacao, montarMeta, limitOffset, POR_PAGINA_MAXIMO } = require('../utils/paginacao');

const req = (query = {}) => ({ query });

describe('lerPaginacao', () => {
  test('sem parâmetros usa a primeira página e o padrão', () => {
    const p = lerPaginacao(req());
    assert.strictEqual(p.pagina, 1);
    assert.strictEqual(p.porPagina, 25);
    assert.strictEqual(p.offset, 0);
  });

  test('calcula o offset a partir da página', () => {
    assert.strictEqual(lerPaginacao(req({ pagina: '3' })).offset, 50);
  });

  test('limita por_pagina ao máximo', () => {
    assert.strictEqual(lerPaginacao(req({ por_pagina: '999999' })).porPagina, POR_PAGINA_MAXIMO);
  });

  test('página zero ou negativa vira 1', () => {
    assert.strictEqual(lerPaginacao(req({ pagina: '0' })).pagina, 1);
    assert.strictEqual(lerPaginacao(req({ pagina: '-5' })).pagina, 1);
  });

  test('valores não numéricos caem no padrão', () => {
    const p = lerPaginacao(req({ pagina: 'abc', por_pagina: 'xyz' }));
    assert.strictEqual(p.pagina, 1);
    assert.strictEqual(p.porPagina, 25);
  });

  test('por_pagina zero ou negativo vira 1, nunca 0', () => {
    // porPagina 0 geraria LIMIT 0 e uma listagem sempre vazia
    assert.strictEqual(lerPaginacao(req({ por_pagina: '0' })).porPagina, 1);
    assert.strictEqual(lerPaginacao(req({ por_pagina: '-10' })).porPagina, 1);
  });
});

describe('montarMeta', () => {
  const linhas = [
    { id: 1, nome: 'a', _total: '57' },
    { id: 2, nome: 'b', _total: '57' }
  ];

  test('remove a coluna técnica _total dos itens', () => {
    const { itens } = montarMeta({ pagina: 1, porPagina: 25 }, linhas, '/x');
    assert.deepStrictEqual(itens, [{ id: 1, nome: 'a' }, { id: 2, nome: 'b' }]);
  });

  test('extrai o total da janela COUNT(*) OVER()', () => {
    const { meta } = montarMeta({ pagina: 1, porPagina: 25 }, linhas, '/x');
    assert.strictEqual(meta.total, 57);
    assert.strictEqual(meta.totalPaginas, 3);
  });

  test('calcula o intervalo exibido', () => {
    const { meta } = montarMeta({ pagina: 2, porPagina: 25 }, linhas, '/x');
    assert.strictEqual(meta.primeiroItem, 26);
    assert.strictEqual(meta.ultimoItem, 50);
  });

  test('última página não extrapola o total', () => {
    const { meta } = montarMeta({ pagina: 3, porPagina: 25 }, linhas, '/x');
    assert.strictEqual(meta.ultimoItem, 57);
    assert.strictEqual(meta.temProxima, false);
  });

  test('resultado vazio não quebra', () => {
    const { itens, meta } = montarMeta({ pagina: 1, porPagina: 25 }, [], '/x');
    assert.deepStrictEqual(itens, []);
    assert.strictEqual(meta.total, 0);
    assert.strictEqual(meta.totalPaginas, 1);
    assert.strictEqual(meta.primeiroItem, 0);
  });

  test('preserva os filtros ativos e descarta pagina/vazios', () => {
    const { meta } = montarMeta(
      { pagina: 2, porPagina: 25 }, linhas, '/x',
      { status: 'ativo', busca: '', pagina: '2', tipo: null }
    );
    assert.deepStrictEqual(meta.query, { status: 'ativo' });
  });
});

describe('limitOffset', () => {
  test('gera placeholders a partir do índice informado', () => {
    const r = limitOffset(3, { porPagina: 25, offset: 50 });
    assert.strictEqual(r.sql, ' LIMIT $3 OFFSET $4');
    assert.deepStrictEqual(r.valores, [25, 50]);
  });
});
