// Testes: autenticação e autorização
// Cobrem os caminhos que decidem acesso ANTES de qualquer consulta ao banco:
// token ausente, inválido, expirado, token "mock" e as regras de perfil.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

// authMiddleware exige JWT_SECRET (o fallback inseguro foi removido)
process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-de-teste-com-mais-de-32-caracteres!!';

const { authenticateToken, requireRole, allowSelfOrRole } = require('../middlewares/authMiddleware');

function reqFake(over = {}) {
  return { path: '/processos', headers: {}, cookies: {}, params: {}, ...over };
}

function resFake() {
  const res = {
    statusCode: null,
    jsonBody: null,
    redirectedTo: null,
    renderView: null,
    cookiesLimpos: [],
    status(c) { res.statusCode = c; return res; },
    json(b) { res.jsonBody = b; return res; },
    redirect(url) { res.redirectedTo = url; return res; },
    render(v, d) { res.renderView = v; res.renderData = d; return res; },
    clearCookie(n) { res.cookiesLimpos.push(n); return res; }
  };
  return res;
}

// Executa o middleware e devolve o que aconteceu
async function rodar(mw, req, res) {
  let chamouNext = false;
  let erro = null;
  await mw(req, res, (e) => { chamouNext = true; erro = e || null; });
  return { chamouNext, erro };
}

describe('authenticateToken', () => {
  test('sem token, navegação normal vai para o login', async () => {
    const res = resFake();
    const { chamouNext } = await rodar(authenticateToken, reqFake(), res);
    assert.strictEqual(chamouNext, false);
    assert.strictEqual(res.redirectedTo, '/auth/login');
  });

  test('sem token, requisição de API recebe 401 JSON', async () => {
    const res = resFake();
    await rodar(authenticateToken, reqFake({ path: '/api/processos' }), res);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.jsonBody.success, false);
  });

  test('sem token, cliente que aceita JSON recebe 401 em vez de redirect', async () => {
    const res = resFake();
    await rodar(authenticateToken, reqFake({ headers: { accept: 'application/json' } }), res);
    assert.strictEqual(res.statusCode, 401);
  });

  test('token inválido limpa o cookie e manda para o login', async () => {
    const res = resFake();
    const req = reqFake({ cookies: { token: 'nao-e-um-jwt' } });
    await rodar(authenticateToken, req, res);
    assert.ok(res.cookiesLimpos.includes('token'));
    assert.strictEqual(res.redirectedTo, '/auth/login');
  });

  test('token assinado com outro segredo é rejeitado', async () => {
    const res = resFake();
    const forjado = jwt.sign({ userId: 1, perfil: 'admin' }, 'segredo-do-atacante');
    await rodar(authenticateToken, reqFake({ cookies: { token: forjado } }), res);
    assert.strictEqual(res.redirectedTo, '/auth/login');
    assert.strictEqual(res.statusCode, null); // não chegou a consultar o banco
  });

  test('token expirado é rejeitado', async () => {
    const res = resFake();
    const expirado = jwt.sign({ userId: 1 }, process.env.JWT_SECRET, { expiresIn: '-1h' });
    await rodar(authenticateToken, reqFake({ cookies: { token: expirado } }), res);
    assert.strictEqual(res.redirectedTo, '/auth/login');
  });

  test('token "mock" nunca autentica', async () => {
    const res = resFake();
    const mockToken = jwt.sign({ userId: 1, mock: true }, process.env.JWT_SECRET);
    const { chamouNext } = await rodar(authenticateToken, reqFake({ cookies: { token: mockToken } }), res);
    assert.strictEqual(chamouNext, false);
    assert.strictEqual(res.redirectedTo, '/auth/login');
  });

  test('token "mock" em rota de API recebe 401', async () => {
    const res = resFake();
    const mockToken = jwt.sign({ userId: 1, mock: true }, process.env.JWT_SECRET);
    await rodar(authenticateToken, reqFake({ path: '/api/x', cookies: { token: mockToken } }), res);
    assert.strictEqual(res.statusCode, 401);
  });
});

describe('requireRole', () => {
  test('sem usuário autenticado, redireciona para o login', async () => {
    const res = resFake();
    const { chamouNext } = await rodar(requireRole(['admin']), reqFake(), res);
    assert.strictEqual(chamouNext, false);
    assert.strictEqual(res.redirectedTo, '/auth/login');
  });

  test('perfil correto passa', async () => {
    const res = resFake();
    const req = reqFake({ user: { id: 1, email: 'a@b.c', perfil: 'admin' } });
    const { chamouNext } = await rodar(requireRole(['admin']), req, res);
    assert.strictEqual(chamouNext, true);
  });

  test('perfil insuficiente recebe 403', async () => {
    const res = resFake();
    const req = reqFake({ user: { id: 1, email: 'a@b.c', perfil: 'usuario' } });
    const { chamouNext } = await rodar(requireRole(['admin', 'gestor']), req, res);
    assert.strictEqual(chamouNext, false);
    assert.strictEqual(res.statusCode, 403);
  });

  test('gestor não passa em rota exclusiva de admin', async () => {
    const res = resFake();
    const req = reqFake({ user: { id: 1, email: 'g@b.c', perfil: 'gestor' } });
    await rodar(requireRole(['admin']), req, res);
    assert.strictEqual(res.statusCode, 403);
  });

  test('aceita um perfil solto, não só array', async () => {
    const res = resFake();
    const req = reqFake({ user: { id: 1, email: 'a@b.c', perfil: 'admin' } });
    const { chamouNext } = await rodar(requireRole('admin'), req, res);
    assert.strictEqual(chamouNext, true);
  });

  test('403 de API devolve JSON, não HTML', async () => {
    const res = resFake();
    const req = reqFake({ path: '/api/x', user: { id: 1, email: 'a@b.c', perfil: 'usuario' } });
    await rodar(requireRole(['admin']), req, res);
    assert.strictEqual(res.jsonBody.success, false);
  });
});

describe('allowSelfOrRole', () => {
  test('usuário comum pode editar a si mesmo', async () => {
    const res = resFake();
    const req = reqFake({ params: { id: '42' }, user: { id: 42, perfil: 'usuario' } });
    const { chamouNext } = await rodar(allowSelfOrRole(['admin']), req, res);
    assert.strictEqual(chamouNext, true);
  });

  test('usuário comum não pode editar outro', async () => {
    const res = resFake();
    const req = reqFake({ params: { id: '99' }, user: { id: 42, perfil: 'usuario' } });
    const { chamouNext } = await rodar(allowSelfOrRole(['admin']), req, res);
    assert.strictEqual(chamouNext, false);
    assert.strictEqual(res.statusCode, 403);
  });

  test('admin pode editar qualquer um', async () => {
    const res = resFake();
    const req = reqFake({ params: { id: '99' }, user: { id: 1, perfil: 'admin' } });
    const { chamouNext } = await rodar(allowSelfOrRole(['admin']), req, res);
    assert.strictEqual(chamouNext, true);
  });

  test('id não numérico não vira "self" por coincidência', async () => {
    const res = resFake();
    const req = reqFake({ params: { id: 'abc' }, user: { id: 42, perfil: 'usuario' } });
    const { chamouNext } = await rodar(allowSelfOrRole(['admin']), req, res);
    assert.strictEqual(chamouNext, false);
  });
});
