// Testes: sanitização de HTML, serialização para <script> e CSRF

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { sanitizarDocumento, jsonParaScript } = require('../utils/sanitizarHtml');
const { csrf } = require('../middlewares/csrf');

// ── Sanitização ─────────────────────────────────────────────────────────────
describe('sanitizarDocumento', () => {
  test('remove <script> preservando o resto', () => {
    const saida = sanitizarDocumento('<p>Contrato</p><script>alert(1)</script>');
    assert.strictEqual(saida, '<p>Contrato</p>');
  });

  test('remove handlers inline (onerror, onclick)', () => {
    const saida = sanitizarDocumento('<img src="x" onerror="alert(1)">');
    assert.ok(!saida.includes('onerror'));
  });

  test('remove href javascript:', () => {
    const saida = sanitizarDocumento('<a href="javascript:alert(1)">clique</a>');
    assert.ok(!saida.includes('javascript:'));
  });

  test('remove iframe e object', () => {
    assert.strictEqual(sanitizarDocumento('<iframe src="http://x"></iframe>'), '');
    assert.strictEqual(sanitizarDocumento('<object data="x"></object>'), '');
  });

  test('preserva formatação legítima do documento', () => {
    const html = '<p style="text-align:center"><strong>Título</strong></p>';
    assert.strictEqual(sanitizarDocumento(html), html);
  });

  test('preserva tabelas, usadas no layout dos PDFs', () => {
    const html = '<table border="1"><tr><td>célula</td></tr></table>';
    assert.ok(sanitizarDocumento(html).includes('<td>célula</td>'));
  });

  test('preserva os placeholders de variável e de assinatura', () => {
    const html = '<p>Olá {{NOME}} — {{ASSINATURA:7}}</p>';
    const saida = sanitizarDocumento(html);
    assert.ok(saida.includes('{{NOME}}'));
    assert.ok(saida.includes('{{ASSINATURA:7}}'));
  });

  test('entrada vazia ou nula não quebra', () => {
    assert.strictEqual(sanitizarDocumento(''), '');
    assert.strictEqual(sanitizarDocumento(null), null);
    assert.strictEqual(sanitizarDocumento(undefined), undefined);
  });
});

// ── Serialização para <script> ──────────────────────────────────────────────
describe('jsonParaScript', () => {
  test('escapa a sequência que fecharia o bloco script', () => {
    const saida = jsonParaScript({ x: '</scr' + 'ipt><img src=x onerror=alert(1)>' });
    assert.ok(!saida.toLowerCase().includes('</scr' + 'ipt>'));
  });

  test('o valor sobrevive ao round-trip', () => {
    const valor = { titulo: 'a < b > c', lista: [1, 2, 3] };
    assert.deepStrictEqual(JSON.parse(jsonParaScript(valor)), valor);
  });

  test('escapa os separadores de linha U+2028/U+2029', () => {
    const saida = jsonParaScript({ x: 'a' + String.fromCharCode(0x2028) + 'b' });
    assert.ok(!saida.includes(String.fromCharCode(0x2028)));
    assert.strictEqual(JSON.parse(saida).x.charCodeAt(1), 0x2028);
  });

  test('undefined vira null em vez de quebrar o JS', () => {
    // JSON.stringify(undefined) devolve undefined, que geraria "var x = undefined;"
    assert.strictEqual(jsonParaScript(undefined), 'null');
  });
});

// ── CSRF ────────────────────────────────────────────────────────────────────
function resFake() {
  const res = {
    statusCode: null, jsonBody: null, renderView: null, locals: {}, cookies: {},
    status(c) { res.statusCode = c; return res; },
    json(b) { res.jsonBody = b; return res; },
    render(v, d) { res.renderView = v; res.renderData = d; return res; },
    cookie(n, v, o) { res.cookies[n] = { v, o }; return res; }
  };
  return res;
}

function rodar(req, res) {
  let passou = false;
  csrf(req, res, () => { passou = true; });
  return passou;
}

const TOKEN = 'a'.repeat(64);

describe('middleware CSRF', () => {
  test('GET emite o cookie e segue', () => {
    const res = resFake();
    const passou = rodar({ method: 'GET', headers: {}, get: () => undefined, cookies: {} }, res);
    assert.strictEqual(passou, true);
    assert.ok(res.cookies.csrf_token);
    assert.strictEqual(res.locals.csrfToken.length, 64);
  });

  test('GET reaproveita o cookie existente', () => {
    const res = resFake();
    rodar({ method: 'GET', headers: {}, get: () => undefined, cookies: { csrf_token: TOKEN } }, res);
    assert.strictEqual(res.locals.csrfToken, TOKEN);
  });

  test('POST sem token é bloqueado com 403', () => {
    const res = resFake();
    const passou = rodar({
      method: 'POST', headers: {}, get: () => undefined,
      cookies: { csrf_token: TOKEN }, body: {}, query: {}
    }, res);
    assert.strictEqual(passou, false);
    assert.strictEqual(res.statusCode, 403);
  });

  test('POST com token no corpo passa', () => {
    const res = resFake();
    const passou = rodar({
      method: 'POST', headers: {}, get: () => undefined,
      cookies: { csrf_token: TOKEN }, body: { _csrf: TOKEN }, query: {}
    }, res);
    assert.strictEqual(passou, true);
  });

  test('POST com token no header passa (fetch/AJAX)', () => {
    const res = resFake();
    const passou = rodar({
      method: 'POST', headers: {}, get: (h) => h === 'x-csrf-token' ? TOKEN : undefined,
      cookies: { csrf_token: TOKEN }, body: {}, query: {}
    }, res);
    assert.strictEqual(passou, true);
  });

  test('POST com token na query passa (form multipart)', () => {
    // Em multipart req.body ainda não foi parseado quando o middleware roda
    const res = resFake();
    const passou = rodar({
      method: 'POST', headers: {}, get: () => undefined,
      cookies: { csrf_token: TOKEN }, body: {}, query: { _csrf: TOKEN }
    }, res);
    assert.strictEqual(passou, true);
  });

  test('token diferente do cookie é rejeitado', () => {
    const res = resFake();
    const passou = rodar({
      method: 'POST', headers: {}, get: () => undefined,
      cookies: { csrf_token: TOKEN }, body: { _csrf: 'b'.repeat(64) }, query: {}
    }, res);
    assert.strictEqual(passou, false);
    assert.strictEqual(res.statusCode, 403);
  });

  test('token de tamanho diferente é rejeitado sem estourar', () => {
    // timingSafeEqual lança se os buffers têm tamanhos diferentes
    const res = resFake();
    const passou = rodar({
      method: 'POST', headers: {}, get: () => undefined,
      cookies: { csrf_token: TOKEN }, body: { _csrf: 'curto' }, query: {}
    }, res);
    assert.strictEqual(passou, false);
    assert.strictEqual(res.statusCode, 403);
  });

  test('DELETE também é protegido', () => {
    const res = resFake();
    const passou = rodar({
      method: 'DELETE', headers: {}, get: () => undefined,
      cookies: { csrf_token: TOKEN }, body: {}, query: {}
    }, res);
    assert.strictEqual(passou, false);
  });

  test('rejeição em chamada AJAX responde JSON, não HTML', () => {
    const res = resFake();
    rodar({
      method: 'POST', headers: { accept: 'application/json' }, get: () => undefined,
      cookies: { csrf_token: TOKEN }, body: {}, query: {}, xhr: true
    }, res);
    assert.strictEqual(res.jsonBody.success, false);
  });
});
