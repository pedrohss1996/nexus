// Testes: motor de execução de fluxo
//
// Cobrem a lógica pura de decisão — quais transições valem para cada decisão e
// como o prazo é calculado. É onde um erro faz o processo seguir pelo caminho
// errado ou travar, e não depende de banco.

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { transicoesValidas, calcularPrazo, ErroFluxo } = require('../services/FluxoEngine');

const edge = (destino, tipo, ordem = 0) => ({
  etapa_destino_id: destino, condicao_tipo: tipo, ordem
});

describe('transicoesValidas', () => {
  test('"sempre" vale com qualquer decisão', () => {
    const edges = [edge(2, 'sempre')];
    assert.strictEqual(transicoesValidas(edges, null).length, 1);
    assert.strictEqual(transicoesValidas(edges, 'aprovado').length, 1);
    assert.strictEqual(transicoesValidas(edges, 'reprovado').length, 1);
  });

  test('condição ausente é tratada como "sempre"', () => {
    // Edges antigas do banco podem ter condicao_tipo NULL
    assert.strictEqual(transicoesValidas([edge(2, null)], null).length, 1);
    assert.strictEqual(transicoesValidas([edge(2, undefined)], 'aprovado').length, 1);
  });

  test('separa o caminho de aprovação do de reprovação', () => {
    const edges = [edge(3, 'aprovado'), edge(1, 'reprovado')];

    const aprovando = transicoesValidas(edges, 'aprovado');
    assert.strictEqual(aprovando.length, 1);
    assert.strictEqual(aprovando[0].etapa_destino_id, 3);

    const reprovando = transicoesValidas(edges, 'reprovado');
    assert.strictEqual(reprovando.length, 1);
    assert.strictEqual(reprovando[0].etapa_destino_id, 1);
  });

  test('sem decisão, transições condicionais não valem', () => {
    const edges = [edge(3, 'aprovado'), edge(1, 'reprovado')];
    assert.strictEqual(transicoesValidas(edges, null).length, 0);
  });

  test('"expressao" nunca é seguida', () => {
    // Avaliar a string do banco seria executar código vindo de dado.
    // validarDesenho() avisa que a transição será ignorada.
    const edges = [edge(9, 'expressao')];
    assert.strictEqual(transicoesValidas(edges, 'aprovado').length, 0);
    assert.strictEqual(transicoesValidas(edges, null).length, 0);
  });

  test('tipo desconhecido não vale (falha fechada)', () => {
    assert.strictEqual(transicoesValidas([edge(2, 'qualquer_coisa')], 'aprovado').length, 0);
  });

  test('preserva a ordem para a escolha da precedência', () => {
    const edges = [edge(5, 'sempre', 2), edge(4, 'sempre', 1)];
    const validas = transicoesValidas(edges, null);
    assert.strictEqual(validas.length, 2);
    assert.strictEqual(validas[0].etapa_destino_id, 5); // ordenação é do SQL
  });

  test('lista vazia devolve vazio — sinaliza fim de fluxo', () => {
    assert.deepStrictEqual(transicoesValidas([], 'aprovado'), []);
  });
});

describe('calcularPrazo', () => {
  test('soma os dias à data atual', () => {
    const prazo = calcularPrazo(3);
    const esperado = new Date();
    esperado.setDate(esperado.getDate() + 3);
    assert.strictEqual(prazo.toDateString(), esperado.toDateString());
  });

  test('etapa sem prazo definido não gera prazo', () => {
    assert.strictEqual(calcularPrazo(null), null);
    assert.strictEqual(calcularPrazo(undefined), null);
    assert.strictEqual(calcularPrazo(0), null);
  });

  test('valor negativo não vira prazo no passado', () => {
    assert.strictEqual(calcularPrazo(-5), null);
  });
});

describe('ErroFluxo', () => {
  test('carrega código para o controller escolher o status HTTP', () => {
    const e = new ErroFluxo('sem permissão', 'SEM_PERMISSAO');
    assert.strictEqual(e.name, 'ErroFluxo');
    assert.strictEqual(e.codigo, 'SEM_PERMISSAO');
    assert.ok(e instanceof Error);
  });

  test('código padrão quando não informado', () => {
    assert.strictEqual(new ErroFluxo('x').codigo, 'FLUXO_ERRO');
  });
});
