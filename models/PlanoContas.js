// Model: PlanoContas
// Descrição: Plano de contas hierárquico por unidade (árvore, disponível, teto)

const { query } = require('../config/database');

/**
 * Busca contas da unidade em lista flat (com parent_id, valor, ordem).
 */
async function buscarContasFlat(unidadeId) {
  const sql = `
    SELECT id, unidade_id, parent_id, codigo, nome, descricao, valor, ordem, ativo
    FROM contas_contabeis
    WHERE unidade_id = $1 AND ativo = true
    ORDER BY parent_id NULLS FIRST, ordem ASC, codigo ASC
  `;
  const resultado = await query(sql, [unidadeId]);
  return resultado.rows;
}

/**
 * Monta árvore a partir da lista flat e calcula soma_filhos e disponivel (recursivo, de baixo para cima).
 */
function buildTreeFromFlat(flatList, parentId = null) {
  const nodes = flatList.filter(c => (c.parent_id == null && parentId === null) || (c.parent_id === parentId));
  const tree = [];
  for (const node of nodes) {
    const children = buildTreeFromFlat(flatList, node.id);
    const somaFilhos = children.reduce((s, c) => s + parseFloat(c.valor || 0), 0);
    const valor = parseFloat(node.valor || 0);
    const disponivel = valor - somaFilhos;
    tree.push({
      id: node.id,
      codigo: node.codigo,
      nome: node.nome,
      descricao: node.descricao,
      valor,
      ordem: node.ordem,
      parent_id: node.parent_id,
      soma_filhos: somaFilhos,
      disponivel,
      children
    });
  }
  return tree;
}

/**
 * Retorna árvore de contas da unidade com disponivel calculado.
 */
async function buildTree(unidadeId) {
  const flat = await buscarContasFlat(unidadeId);
  return buildTreeFromFlat(flat);
}

/**
 * Gera próximo código para subconta: pai "1.0" -> "1.01", "1.02"...
 * Para raiz: "1.0", "2.0"...
 */
async function proximoCodigo(unidadeId, parentId) {
  if (parentId) {
    const pai = await query(
      'SELECT codigo FROM contas_contabeis WHERE id = $1 AND unidade_id = $2',
      [parentId, unidadeId]
    );
    if (!pai.rows[0]) return null;
    const prefixo = pai.rows[0].codigo;
    const filhos = await query(
      'SELECT codigo FROM contas_contabeis WHERE parent_id = $1 AND unidade_id = $2 ORDER BY codigo ASC',
      [parentId, unidadeId]
    );
    let idx = 1;
    const usado = new Set(filhos.rows.map(r => r.codigo));
    while (usado.has(`${prefixo}.${String(idx).padStart(2, '0')}`)) idx++;
    return `${prefixo}.${String(idx).padStart(2, '0')}`;
  }
  const raizes = await query(
    'SELECT codigo FROM contas_contabeis WHERE unidade_id = $1 AND parent_id IS NULL ORDER BY codigo ASC',
    [unidadeId]
  );
  let idx = 1;
  const usado = new Set(raizes.rows.map(r => r.codigo));
  while (usado.has(`${idx}.0`)) idx++;
  return `${idx}.0`;
}

/**
 * Cria subconta (ou conta raiz). Gera código automaticamente. Aceita valor opcional; valida teto se tiver pai.
 */
async function criarSubconta(unidadeId, dados) {
  const codigo = await proximoCodigo(unidadeId, dados.parent_id || null);
  if (!codigo) throw new Error('Não foi possível gerar código');
  const valor = dados.valor != null ? parseFloat(dados.valor) : 0;
  const sql = `
    INSERT INTO contas_contabeis (unidade_id, parent_id, codigo, nome, descricao, valor, ordem, criado_por)
    VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 0), $8)
    RETURNING *
  `;
  const cols = await query(sql, [
    unidadeId,
    dados.parent_id || null,
    codigo,
    dados.nome,
    dados.descricao || null,
    Number.isNaN(valor) ? 0 : Math.max(0, valor),
    dados.ordem ?? 0,
    dados.criado_por
  ]);
  const row = cols.rows[0];
  if (!row) return null;
  row.valor = parseFloat(row.valor || 0);
  row.disponivel = row.valor;
  if (row.parent_id && row.valor > 0) {
    const teto = await validarTeto(row.id, unidadeId, row.valor);
    if (!teto.ok) {
      await query('DELETE FROM contas_contabeis WHERE id = $1 AND unidade_id = $2', [row.id, unidadeId]);
      const err = new Error(teto.mensagem || 'Valor excede o teto do centro de custo pai.');
      err.code = 'TETO_EXCEDIDO';
      err.disponivel = teto.disponivel;
      throw err;
    }
  }
  return row;
}

/**
 * Busca conta por id e unidade.
 */
async function buscarContaPorId(contaId, unidadeId) {
  const r = await query(
    'SELECT * FROM contas_contabeis WHERE id = $1 AND unidade_id = $2 AND ativo = true',
    [contaId, unidadeId]
  );
  return r.rows[0] || null;
}

/**
 * Valida teto: novo_valor + soma(irmãos) <= valor_pai. Retorna { ok, disponivel, mensagem }.
 */
async function validarTeto(contaId, unidadeId, novoValor) {
  const conta = await buscarContaPorId(contaId, unidadeId);
  if (!conta || !conta.parent_id) return { ok: true };
  const pai = await buscarContaPorId(conta.parent_id, unidadeId);
  if (!pai) return { ok: true };
  const irmaos = await query(
    'SELECT valor FROM contas_contabeis WHERE parent_id = $1 AND unidade_id = $2 AND ativo = true AND id != $3',
    [conta.parent_id, unidadeId, contaId]
  );
  const somaIrmaos = irmaos.rows.reduce((s, r) => s + parseFloat(r.valor || 0), 0);
  const valorPai = parseFloat(pai.valor || 0);
  const disponivel = valorPai - somaIrmaos;
  if (novoValor > disponivel) {
    return {
      ok: false,
      disponivel,
      mensagem: `Valor excede o saldo disponível do centro de custo pai. Saldo disponível: R$ ${disponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
    };
  }
  return { ok: true };
}

/**
 * Atualiza nome e/ou valor da conta. Valida teto ao alterar valor.
 */
async function atualizarConta(contaId, unidadeId, dados) {
  const conta = await buscarContaPorId(contaId, unidadeId);
  if (!conta) return null;
  if (dados.valor !== undefined) {
    const valorNum = typeof dados.valor === 'number' ? dados.valor : parseFloat(dados.valor);
    if (Number.isNaN(valorNum)) throw new Error('Valor inválido');
    const validacao = await validarTeto(contaId, unidadeId, valorNum);
    if (!validacao.ok) {
      const err = new Error(validacao.mensagem || 'Teto excedido');
      err.code = 'TETO_EXCEDIDO';
      err.disponivel = validacao.disponivel;
      throw err;
    }
  }
  const updates = [];
  const valores = [];
  let pos = 1;
  if (dados.nome !== undefined) {
    updates.push(`nome = $${pos++}`);
    valores.push(dados.nome);
  }
  if (dados.valor !== undefined) {
    updates.push(`valor = $${pos++}`);
    valores.push(typeof dados.valor === 'number' ? dados.valor : parseFloat(dados.valor));
  }
  if (updates.length === 0) return conta;
  valores.push(contaId, unidadeId);
  const sql = `
    UPDATE contas_contabeis
    SET ${updates.join(', ')}
    WHERE id = $${pos} AND unidade_id = $${pos + 1} AND ativo = true
    RETURNING *
  `;
  const r = await query(sql, valores);
  const row = r.rows[0];
  if (!row) return null;
  row.valor = parseFloat(row.valor || 0);
  const filhos = await query(
    'SELECT valor FROM contas_contabeis WHERE parent_id = $1 AND unidade_id = $2 AND ativo = true',
    [row.id, unidadeId]
  );
  const somaFilhos = filhos.rows.reduce((s, f) => s + parseFloat(f.valor || 0), 0);
  row.soma_filhos = somaFilhos;
  row.disponivel = row.valor - somaFilhos;
  return row;
}

/**
 * Exclui conta e todas as filhas (CASCADE no banco).
 */
async function excluirConta(contaId, unidadeId) {
  const r = await query(
    'DELETE FROM contas_contabeis WHERE id = $1 AND unidade_id = $2 RETURNING id',
    [contaId, unidadeId]
  );
  return r.rowCount > 0;
}

const PlanoContas = {
  buscarContasFlat,
  buildTreeFromFlat,
  buildTree,
  proximoCodigo,
  criarSubconta,
  buscarContaPorId,
  validarTeto,
  atualizarConta,
  excluirConta
};

module.exports = PlanoContas;
