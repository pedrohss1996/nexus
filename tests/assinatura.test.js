// Testes: integridade da assinatura de documentos
// O hash do conteúdo é o que sustenta a verificação pública em /verificar/:hash.
// Se ele deixar de mudar quando o documento muda, uma alteração posterior passa
// a ser indetectável.

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { _internals } = require('../controllers/AssinaturaDocController');
const { gerarHashAssinatura, hashConteudo, unwrapAssinaturaVars } = _internals;

describe('hashConteudo (integridade do documento)', () => {
  test('mesmo conteúdo produz o mesmo hash', () => {
    const html = '<p>Contrato de prestação de serviços</p>';
    assert.strictEqual(hashConteudo(html), hashConteudo(html));
  });

  test('qualquer alteração muda o hash', () => {
    const original = '<p>Valor: R$ 1.000,00</p>';
    const adulterado = '<p>Valor: R$ 10.000,00</p>';
    assert.notStrictEqual(hashConteudo(original), hashConteudo(adulterado));
  });

  test('diferença de um único caractere muda o hash', () => {
    assert.notStrictEqual(hashConteudo('<p>a</p>'), hashConteudo('<p>b</p>'));
  });

  test('produz SHA-256 completo (64 hex)', () => {
    assert.match(hashConteudo('<p>x</p>'), /^[0-9a-f]{64}$/);
  });

  test('conteúdo vazio ou nulo não quebra', () => {
    assert.match(hashConteudo(''), /^[0-9a-f]{64}$/);
    assert.match(hashConteudo(null), /^[0-9a-f]{64}$/);
    assert.match(hashConteudo(undefined), /^[0-9a-f]{64}$/);
  });

  test('null e string vazia são tratados igual', () => {
    assert.strictEqual(hashConteudo(null), hashConteudo(''));
  });
});

describe('gerarHashAssinatura (identificador público)', () => {
  test('tem 16 caracteres hex maiúsculos', () => {
    assert.match(gerarHashAssinatura({ doc: 1, user: 2 }), /^[0-9A-F]{16}$/);
  });

  test('dois documentos idênticos geram identificadores distintos', () => {
    // A rota /verificar/:hash usa este valor como chave — colisão faria uma
    // assinatura ser exibida no lugar de outra.
    const dados = { documento_id: 1, usuario_id: 2 };
    const vistos = new Set();
    for (let i = 0; i < 200; i++) vistos.add(gerarHashAssinatura(dados));
    assert.strictEqual(vistos.size, 200);
  });

  test('a verificação pública compara em maiúsculas', () => {
    // O controller faz hash.toUpperCase() antes de consultar; o valor gerado
    // já precisa estar nesse formato para bater.
    const h = gerarHashAssinatura({ x: 1 });
    assert.strictEqual(h, h.toUpperCase());
  });
});

describe('unwrapAssinaturaVars (placeholders de assinatura)', () => {
  test('remove o wrapper <p> deixando o placeholder solto', () => {
    const html = '<p style="text-align:center">{{ASSINATURA:5}}</p>';
    assert.match(unwrapAssinaturaVars(html).trim(), /^\{\{ASSINATURA:5\}\}$/);
  });

  test('remove o wrapper de tabela do editor', () => {
    const html = '<table style="background:#eee"><tr><td>{{ASSINATURA:3}}</td></tr></table>';
    const saida = unwrapAssinaturaVars(html);
    assert.ok(saida.includes('{{ASSINATURA:3}}'));
    assert.ok(!saida.includes('<table'));
  });

  test('preserva múltiplos placeholders distintos', () => {
    const html = '<p>{{ASSINATURA:1}}</p><p>{{ASSINATURA:2}}</p>';
    const saida = unwrapAssinaturaVars(html);
    assert.ok(saida.includes('{{ASSINATURA:1}}'));
    assert.ok(saida.includes('{{ASSINATURA:2}}'));
  });

  test('não altera conteúdo sem placeholder', () => {
    const html = '<p>Texto comum do documento</p>';
    assert.strictEqual(unwrapAssinaturaVars(html), html);
  });

  test('desfaz tabelas aninhadas até o placeholder ficar livre', () => {
    const html = '<table><tr><td><table><tr><td>{{ASSINATURA:9}}</td></tr></table></td></tr></table>';
    const saida = unwrapAssinaturaVars(html);
    assert.ok(saida.includes('{{ASSINATURA:9}}'));
    assert.ok(!saida.includes('<table'));
  });
});
