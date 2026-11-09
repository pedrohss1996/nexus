// Testes: escopo de unidade
// Cobre o helper de que todos os controllers dependem para o isolamento
// multi-unidade. Se ele devolver a unidade errada (ou nenhuma), o filtro das
// queries cai junto.

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { unidadeDaRequisicao, semUnidade } = require('../utils/unidadeScope');

function reqFake(over = {}) {
  return {
    path: '/processos',
    headers: {},
    session: {},
    ...over
  };
}

function resFake() {
  const res = {
    statusCode: null,
    jsonBody: null,
    renderView: null,
    status(c) { res.statusCode = c; return res; },
    json(b) { res.jsonBody = b; return res; },
    render(v, d) { res.renderView = v; res.renderData = d; return res; }
  };
  return res;
}

describe('unidadeDaRequisicao', () => {
  test('lê a unidade já validada pelo middleware', () => {
    assert.strictEqual(unidadeDaRequisicao(reqFake({ unidadeSelecionada: 7 })), 7);
  });

  test('cai para a sessão quando o middleware não anotou a requisição', () => {
    const req = reqFake({ session: { unidadeSelecionada: 3 } });
    assert.strictEqual(unidadeDaRequisicao(req), 3);
  });

  test('prefere o valor do middleware ao da sessão', () => {
    const req = reqFake({ unidadeSelecionada: 7, session: { unidadeSelecionada: 3 } });
    assert.strictEqual(unidadeDaRequisicao(req), 7);
  });

  test('converte string para número (vem assim de form/query)', () => {
    assert.strictEqual(unidadeDaRequisicao(reqFake({ unidadeSelecionada: '12' })), 12);
  });

  test('devolve null sem unidade — nunca undefined ou NaN', () => {
    assert.strictEqual(unidadeDaRequisicao(reqFake()), null);
    assert.strictEqual(unidadeDaRequisicao(reqFake({ unidadeSelecionada: null })), null);
  });

  test('valor não numérico vira null em vez de NaN', () => {
    // NaN em query parametrizada viraria erro de tipo ou, pior, filtro silencioso
    assert.strictEqual(unidadeDaRequisicao(reqFake({ unidadeSelecionada: 'abc' })), null);
  });

  test('unidade 0 não é tratada como ausente', () => {
    assert.strictEqual(unidadeDaRequisicao(reqFake({ unidadeSelecionada: 0 })), 0);
  });
});

describe('semUnidade', () => {
  test('deixa passar quando há unidade ativa', () => {
    const res = resFake();
    assert.strictEqual(semUnidade(reqFake({ unidadeSelecionada: 5 }), res), false);
    assert.strictEqual(res.statusCode, null);
  });

  test('bloqueia com 403 quando não há unidade', () => {
    const res = resFake();
    assert.strictEqual(semUnidade(reqFake(), res), true);
    assert.strictEqual(res.statusCode, 403);
  });

  test('responde JSON em rota de API', () => {
    const res = resFake();
    semUnidade(reqFake({ path: '/api/processos' }), res);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.jsonBody.success, false);
  });

  test('responde JSON quando o cliente aceita JSON', () => {
    const res = resFake();
    semUnidade(reqFake({ headers: { accept: 'application/json' } }), res);
    assert.strictEqual(res.jsonBody.success, false);
  });

  test('responde JSON quando forçado pelo controller', () => {
    const res = resFake();
    semUnidade(reqFake(), res, { json: true });
    assert.strictEqual(res.jsonBody.success, false);
  });

  test('renderiza página de erro em navegação normal', () => {
    const res = resFake();
    semUnidade(reqFake(), res);
    assert.strictEqual(res.renderView, 'error');
  });
});
