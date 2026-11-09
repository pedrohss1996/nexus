// Testes de regressão para as correções críticas de segurança:
// - não existe auto-registro público (/auth/register criava admin)
// - download de PDF não aceita path traversal nem arquivo de outra unidade
// - falha de login responde 401 (para o rate limit contar as tentativas)

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-de-teste-com-mais-de-32-caracteres!!';

// Stub do banco antes de carregar os controllers
const consultas = [];
let respostaQuery = { rows: [] };
const dbPath = require.resolve('../config/database');
require.cache[dbPath] = {
  id: dbPath, filename: dbPath, loaded: true,
  exports: {
    query: async (sql, params) => { consultas.push({ sql, params }); return respostaQuery; },
    pool: { query: async () => ({ rows: [] }), connect: async () => ({}) },
    transaction: async (fn) => fn({ query: async () => ({ rows: [] }) })
  }
};

const authRoutes = require('../routes/authRoutes');
const AuthController = require('../controllers/AuthController');
const DocumentoPDFController = require('../controllers/DocumentoPDFController');

function resFake() {
  const res = {
    statusCode: 200, renderView: null, renderData: null, baixou: null,
    status(c) { res.statusCode = c; return res; },
    render(v, d) { res.renderView = v; res.renderData = d; return res; },
    json(b) { res.jsonBody = b; return res; },
    redirect(u) { res.redirectedTo = u; return res; },
    cookie() { return res; },
    download(p) { res.baixou = p; return res; }
  };
  return res;
}

describe('auto-registro removido', () => {
  test('authRoutes não expõe /register', () => {
    const rotas = authRoutes.stack.filter(l => l.route).map(l => l.route.path);
    assert.ok(!rotas.includes('/register'), `rotas: ${rotas.join(', ')}`);
  });

  test('AuthController não tem mais register/showRegister', () => {
    assert.strictEqual(AuthController.register, undefined);
    assert.strictEqual(AuthController.showRegister, undefined);
  });
});

describe('download de PDF', () => {
  beforeEach(() => { consultas.length = 0; respostaQuery = { rows: [] }; });

  const reqBase = (nomeArquivo) => ({
    params: { nomeArquivo },
    user: { id: 1, perfil: 'usuario' },
    unidadeSelecionada: 7,
    headers: {}, path: '/documentos-pdf/download', originalUrl: '/documentos-pdf/download'
  });

  for (const malicioso of ['../../.env', '..\\..\\.env', '../.env.pdf', '.env', 'x/../../y.pdf']) {
    test(`rejeita "${malicioso}" sem consultar o banco nem ler disco`, async () => {
      const res = resFake();
      await DocumentoPDFController.download(reqBase(malicioso), res);
      assert.strictEqual(res.baixou, null);
      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(consultas.filter(c => /documentos_gerados/.test(c.sql)).length, 0);
    });
  }

  test('arquivo de outra unidade (sem registro na unidade ativa) dá 404', async () => {
    respostaQuery = { rows: [] };
    const res = resFake();
    await DocumentoPDFController.download(reqBase('Contrato_123.pdf'), res);
    assert.strictEqual(res.baixou, null);
    assert.strictEqual(res.statusCode, 404);
    const c = consultas.find(c => /documentos_gerados/.test(c.sql));
    assert.ok(c, 'deveria consultar documentos_gerados');
    assert.match(c.sql, /unidade_id/);
  });
});

describe('login com falha', () => {
  test('usuário inexistente responde 401', async () => {
    respostaQuery = { rows: [] };
    const res = resFake();
    await AuthController.login({ body: { email: 'x@x.com', senha: 'qualquer' }, ip: '1.2.3.4' }, res);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.renderView, 'auth/login');
  });
});
