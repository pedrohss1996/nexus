// Testes: detecção de requisição que espera JSON
//
// Regressão: dentro de app.use('/api', router) o Express remove o prefixo do
// mount, então req.path vira '/notificacoes/nao-lidas'. A checagem antiga
// (req.path.startsWith('/api/')) falhava exatamente nas rotas de API e o
// cliente AJAX recebia 302 + HTML de login em vez de 401 JSON.

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { esperaJson } = require('../utils/requestType');

describe('esperaJson', () => {
  test('reconhece rota de API mesmo com o prefixo removido pelo mount', () => {
    const req = {
      originalUrl: '/api/notificacoes/nao-lidas',
      path: '/notificacoes/nao-lidas', // o que o Express entrega dentro do mount
      headers: {}
    };
    assert.strictEqual(esperaJson(req), true);
  });

  test('rota de API não montada continua reconhecida', () => {
    assert.strictEqual(
      esperaJson({ originalUrl: '/api/processos', path: '/api/processos', headers: {} }),
      true
    );
  });

  test('navegação normal não é tratada como JSON', () => {
    assert.strictEqual(
      esperaJson({ originalUrl: '/processos', path: '/processos', headers: {} }),
      false
    );
  });

  test('requisição XHR é tratada como JSON', () => {
    assert.strictEqual(
      esperaJson({ originalUrl: '/processos', xhr: true, headers: {} }),
      true
    );
  });

  test('header Accept: application/json é respeitado', () => {
    assert.strictEqual(
      esperaJson({ originalUrl: '/processos', headers: { accept: 'application/json' } }),
      true
    );
  });

  test('Accept: text/html não vira JSON', () => {
    assert.strictEqual(
      esperaJson({ originalUrl: '/processos', headers: { accept: 'text/html' } }),
      false
    );
  });

  test('cai para req.path quando não há originalUrl (uso direto em teste)', () => {
    assert.strictEqual(esperaJson({ path: '/api/x', headers: {} }), true);
  });

  test('requisição sem headers não quebra', () => {
    assert.strictEqual(esperaJson({ originalUrl: '/processos' }), false);
  });

  test('objeto vazio não quebra', () => {
    assert.strictEqual(esperaJson({}), false);
  });

  test('/apiario não é confundido com /api/', () => {
    // startsWith('/api/') exige a barra — evita falso positivo em rotas que
    // apenas começam com as mesmas letras
    assert.strictEqual(
      esperaJson({ originalUrl: '/apiario/listar', headers: {} }),
      false
    );
  });
});
