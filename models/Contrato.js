const { query, transaction } = require('../config/database');

class Contrato {
  // ─── CRUD principal ───────────────────────────────────────────────
  static async criar(dados) {
    const sql = `
      INSERT INTO contratos (
        codigo, nome, tipo, descricao, fornecedor_id, empresa_contratada,
        responsavel_interno_id, departamento_responsavel,
        valor_total, valor_mensal, moeda, forma_pagamento,
        indice_reajuste, indice_reajuste_outro,
        data_inicio, data_termino, prazo_meses, data_proximo_reajuste,
        status, unidade_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
      ) RETURNING *`;
    const v = [
      dados.codigo, dados.nome, dados.tipo, dados.descricao || null,
      dados.fornecedor_id || null, dados.empresa_contratada || null,
      dados.responsavel_interno_id || null, dados.departamento_responsavel || null,
      dados.valor_total || null, dados.valor_mensal || null,
      dados.moeda || 'BRL', dados.forma_pagamento || null,
      dados.indice_reajuste || null, dados.indice_reajuste_outro || null,
      dados.data_inicio || null, dados.data_termino || null,
      dados.prazo_meses || null, dados.data_proximo_reajuste || null,
      dados.status || 'ativo', dados.unidade_id || null
    ];
    const r = await query(sql, v);
    return r.rows[0];
  }

  static async atualizar(id, dados, unidadeId) {
    const sql = `
      UPDATE contratos SET
        nome=$1, tipo=$2, descricao=$3, fornecedor_id=$4, empresa_contratada=$5,
        responsavel_interno_id=$6, departamento_responsavel=$7,
        valor_total=$8, valor_mensal=$9, moeda=$10, forma_pagamento=$11,
        indice_reajuste=$12, indice_reajuste_outro=$13,
        data_inicio=$14, data_termino=$15, prazo_meses=$16, data_proximo_reajuste=$17,
        status=$18, unidade_id=$19, atualizado_em=NOW()
      WHERE id=$20 AND unidade_id=$21
      RETURNING *`;
    const v = [
      dados.nome, dados.tipo, dados.descricao || null,
      dados.fornecedor_id || null, dados.empresa_contratada || null,
      dados.responsavel_interno_id || null, dados.departamento_responsavel || null,
      dados.valor_total || null, dados.valor_mensal || null,
      dados.moeda || 'BRL', dados.forma_pagamento || null,
      dados.indice_reajuste || null, dados.indice_reajuste_outro || null,
      dados.data_inicio || null, dados.data_termino || null,
      dados.prazo_meses || null, dados.data_proximo_reajuste || null,
      // A unidade não pode ser trocada por um payload do cliente: mantém-se a
      // unidade ativa, que é a mesma exigida no WHERE.
      dados.status || 'ativo', unidadeId, id, unidadeId
    ];
    const r = await query(sql, v);
    return r.rows[0];
  }

  // unidadeId é obrigatório em todas as leituras: um contrato de outra unidade
  // deve se comportar como inexistente, não como "acesso negado".
  static async buscarPorId(id, unidadeId) {
    const sql = `
      SELECT c.*,
        f.razao_social AS fornecedor_nome, f.nome_fantasia AS fornecedor_fantasia, f.cnpj AS fornecedor_cnpj,
        u.nome AS responsavel_nome
      FROM contratos c
      LEFT JOIN fornecedores f ON f.id = c.fornecedor_id
      LEFT JOIN usuarios u ON u.id = c.responsavel_interno_id
      WHERE c.id = $1 AND c.unidade_id = $2`;
    const r = await query(sql, [id, unidadeId]);
    return r.rows[0];
  }

  static async listar(filtros = {}) {
    let sql = `
      SELECT c.*,
        f.nome_fantasia AS fornecedor_fantasia, f.razao_social AS fornecedor_razao,
        u.nome AS responsavel_nome
      FROM contratos c
      LEFT JOIN fornecedores f ON f.id = c.fornecedor_id
      LEFT JOIN usuarios u ON u.id = c.responsavel_interno_id
      WHERE c.unidade_id = $1`;
    const v = [filtros.unidade_id ?? null];
    let n = 2;

    if (filtros.status) { sql += ` AND c.status = $${n}`; v.push(filtros.status); n++; }
    if (filtros.tipo) { sql += ` AND c.tipo = $${n}`; v.push(filtros.tipo); n++; }
    if (filtros.busca) {
      sql += ` AND (c.nome ILIKE $${n} OR c.codigo ILIKE $${n} OR c.empresa_contratada ILIKE $${n} OR f.nome_fantasia ILIKE $${n} OR f.razao_social ILIKE $${n})`;
      v.push(`%${filtros.busca}%`); n++;
    }
    if (filtros.departamento) { sql += ` AND c.departamento_responsavel = $${n}`; v.push(filtros.departamento); n++; }
    if (filtros.mes) {
      sql += ` AND c.data_inicio IS NOT NULL AND c.data_termino IS NOT NULL
        AND c.data_inicio <= (DATE_TRUNC('month', $${n}::date) + INTERVAL '1 month' - INTERVAL '1 day')::date
        AND c.data_termino >= DATE_TRUNC('month', $${n}::date)::date`;
      v.push(filtros.mes + '-01'); n++;
    }
    sql += ' ORDER BY c.criado_em DESC';

    // Paginação opcional: quando `pag` vem preenchido a query devolve também a
    // coluna _total (COUNT(*) OVER()), evitando uma segunda ida ao banco.
    if (filtros.pag) {
      sql = sql.replace('SELECT c.*,', 'SELECT c.*, COUNT(*) OVER() AS _total,');
      sql += ` LIMIT $${n} OFFSET $${n + 1}`;
      v.push(filtros.pag.porPagina, filtros.pag.offset);
    }

    const r = await query(sql, v);
    return r.rows;
  }

  static async excluir(id, unidadeId) {
    const r = await query(
      'DELETE FROM contratos WHERE id = $1 AND unidade_id = $2 RETURNING id',
      [id, unidadeId]
    );
    return r.rows[0];
  }

  static async cancelar(id, motivo, unidadeId) {
    const r = await query(
      `UPDATE contratos SET status='cancelado', motivo_cancelamento=$2, data_cancelamento=NOW(), atualizado_em=NOW()
       WHERE id=$1 AND unidade_id=$3 RETURNING *`,
      [id, motivo, unidadeId]
    );
    return r.rows[0];
  }

  // ─── Dashboard / Estatísticas ─────────────────────────────────────
  static async dashboard(unidadeId) {
    const [stats, porTipo, porStatus, porDepto] = await Promise.all([
      query(`
        SELECT
          COUNT(*) FILTER (WHERE status='ativo') AS ativos,
          COUNT(*) FILTER (WHERE status='suspenso') AS suspensos,
          COUNT(*) FILTER (WHERE status='encerrado') AS encerrados,
          COUNT(*) FILTER (WHERE status='em_renovacao') AS em_renovacao,
          COALESCE(SUM(valor_total) FILTER (WHERE status IN ('ativo','em_renovacao')), 0) AS valor_total_ativo,
          COALESCE(SUM(valor_mensal) FILTER (WHERE status IN ('ativo','em_renovacao')), 0) AS valor_mensal_ativo,
          COUNT(*) FILTER (WHERE data_termino BETWEEN NOW() AND NOW() + INTERVAL '30 days' AND status='ativo') AS vencendo_30,
          COUNT(*) FILTER (WHERE data_termino BETWEEN NOW() AND NOW() + INTERVAL '60 days' AND status='ativo') AS vencendo_60,
          COUNT(*) FILTER (WHERE data_termino BETWEEN NOW() AND NOW() + INTERVAL '90 days' AND status='ativo') AS vencendo_90,
          COUNT(*) AS total
        FROM contratos
        WHERE unidade_id = $1
      `, [unidadeId]),
      query(`SELECT tipo, COUNT(*) AS qtd FROM contratos WHERE status IN ('ativo','em_renovacao') AND unidade_id = $1 GROUP BY tipo ORDER BY qtd DESC`, [unidadeId]),
      query(`SELECT status, COUNT(*) AS qtd FROM contratos WHERE unidade_id = $1 GROUP BY status`, [unidadeId]),
      query(`SELECT departamento_responsavel AS depto, COUNT(*) AS qtd FROM contratos WHERE departamento_responsavel IS NOT NULL AND unidade_id = $1 GROUP BY departamento_responsavel ORDER BY qtd DESC LIMIT 10`, [unidadeId])
    ]);
    return { stats: stats.rows[0], porTipo: porTipo.rows, porStatus: porStatus.rows, porDepto: porDepto.rows };
  }

  // ─── Alertas ──────────────────────────────────────────────────────
  static async alertas(unidadeId) {
    const [vencendo, reajustes, obrigacoesAtrasadas, slaFora] = await Promise.all([
      query(`
        SELECT id, codigo, nome, data_termino, status,
          EXTRACT(DAY FROM data_termino - NOW())::int AS dias_restantes
        FROM contratos
        WHERE status = 'ativo' AND data_termino BETWEEN NOW() AND NOW() + INTERVAL '90 days'
          AND unidade_id = $1
        ORDER BY data_termino ASC`, [unidadeId]),
      query(`
        SELECT id, codigo, nome, data_proximo_reajuste, indice_reajuste
        FROM contratos
        WHERE status = 'ativo' AND data_proximo_reajuste BETWEEN NOW() AND NOW() + INTERVAL '60 days'
          AND unidade_id = $1
        ORDER BY data_proximo_reajuste ASC`, [unidadeId]),
      query(`
        SELECT o.*, c.codigo AS contrato_codigo, c.nome AS contrato_nome
        FROM contrato_obrigacoes o
        JOIN contratos c ON c.id = o.contrato_id
        WHERE (o.status = 'atrasado' OR (o.status = 'pendente' AND o.prazo < NOW()))
          AND c.unidade_id = $1
        ORDER BY o.prazo ASC`, [unidadeId]),
      query(`
        SELECT s.*, c.codigo AS contrato_codigo, c.nome AS contrato_nome
        FROM contrato_slas s
        JOIN contratos c ON c.id = s.contrato_id
        WHERE s.status = 'fora' AND c.unidade_id = $1
        ORDER BY s.data_medicao DESC LIMIT 20`, [unidadeId])
    ]);
    return { vencendo: vencendo.rows, reajustes: reajustes.rows, obrigacoesAtrasadas: obrigacoesAtrasadas.rows, slaFora: slaFora.rows };
  }

  // ─── Obrigações ───────────────────────────────────────────────────
  static async listarObrigacoes(contratoId) {
    const r = await query(`
      SELECT o.*, u.nome AS responsavel_nome
      FROM contrato_obrigacoes o LEFT JOIN usuarios u ON u.id = o.responsavel_id
      WHERE o.contrato_id = $1 ORDER BY o.prazo ASC`, [contratoId]);
    return r.rows;
  }

  static async criarObrigacao(dados) {
    const r = await query(`
      INSERT INTO contrato_obrigacoes (contrato_id, descricao, responsavel_id, prazo, frequencia, status)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [dados.contrato_id, dados.descricao, dados.responsavel_id || null, dados.prazo || null, dados.frequencia || null, dados.status || 'pendente']);
    return r.rows[0];
  }

  static async atualizarObrigacao(id, dados) {
    const r = await query(`
      UPDATE contrato_obrigacoes SET descricao=$1, responsavel_id=$2, prazo=$3, frequencia=$4, status=$5, atualizado_em=NOW()
      WHERE id=$6 RETURNING *`,
      [dados.descricao, dados.responsavel_id || null, dados.prazo || null, dados.frequencia || null, dados.status || 'pendente', id]);
    return r.rows[0];
  }

  static async excluirObrigacao(id) { await query('DELETE FROM contrato_obrigacoes WHERE id=$1', [id]); }

  // ─── Pagamentos ───────────────────────────────────────────────────
  static async listarPagamentos(contratoId) {
    const r = await query(`
      SELECT p.*, u.nome AS aprovador_nome
      FROM contrato_pagamentos p LEFT JOIN usuarios u ON u.id = p.responsavel_aprovacao_id
      WHERE p.contrato_id = $1 ORDER BY p.data_pagamento DESC`, [contratoId]);
    return r.rows;
  }

  static async criarPagamento(dados) {
    const r = await query(`
      INSERT INTO contrato_pagamentos (contrato_id, data_pagamento, valor_pago, numero_nota, responsavel_aprovacao_id, status)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [dados.contrato_id, dados.data_pagamento, dados.valor_pago, dados.numero_nota || null, dados.responsavel_aprovacao_id || null, dados.status || 'pago']);
    return r.rows[0];
  }

  static async excluirPagamento(id) { await query('DELETE FROM contrato_pagamentos WHERE id=$1', [id]); }

  static async resumoFinanceiro(contratoId) {
    const r = await query(`
      SELECT
        c.valor_total AS valor_contratado,
        COALESCE(SUM(p.valor_pago), 0) AS valor_executado,
        c.valor_total - COALESCE(SUM(p.valor_pago), 0) AS valor_restante
      FROM contratos c
      LEFT JOIN contrato_pagamentos p ON p.contrato_id = c.id AND p.status = 'pago'
      WHERE c.id = $1
      GROUP BY c.id`, [contratoId]);
    return r.rows[0] || { valor_contratado: 0, valor_executado: 0, valor_restante: 0 };
  }

  // ─── SLAs ─────────────────────────────────────────────────────────
  static async listarSLAs(contratoId) {
    const r = await query('SELECT * FROM contrato_slas WHERE contrato_id=$1 ORDER BY data_medicao DESC', [contratoId]);
    return r.rows;
  }

  static async criarSLA(dados) {
    const r = await query(`
      INSERT INTO contrato_slas (contrato_id, nome_indicador, meta, valor_medido, data_medicao, status)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [dados.contrato_id, dados.nome_indicador, dados.meta || null, dados.valor_medido || null, dados.data_medicao, dados.status || 'dentro']);
    return r.rows[0];
  }

  static async excluirSLA(id) { await query('DELETE FROM contrato_slas WHERE id=$1', [id]); }

  static async taxaCumprimentoSLA(contratoId) {
    const r = await query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status='dentro') AS cumpridos
      FROM contrato_slas WHERE contrato_id=$1`, [contratoId]);
    const row = r.rows[0];
    const total = parseInt(row.total) || 0;
    const cumpridos = parseInt(row.cumpridos) || 0;
    return { total, cumpridos, taxa: total > 0 ? Math.round((cumpridos / total) * 100) : 100 };
  }

  // ─── Aditivos ─────────────────────────────────────────────────────
  static async listarAditivos(contratoId) {
    const r = await query('SELECT * FROM contrato_aditivos WHERE contrato_id=$1 ORDER BY data_aditivo DESC', [contratoId]);
    return r.rows;
  }

  static async criarAditivo(dados) {
    const r = await query(`
      INSERT INTO contrato_aditivos (contrato_id, tipo, data_aditivo, novo_valor, nova_data_termino, descricao)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [dados.contrato_id, dados.tipo, dados.data_aditivo, dados.novo_valor || null, dados.nova_data_termino || null, dados.descricao || null]);
    return r.rows[0];
  }

  static async excluirAditivo(id) { await query('DELETE FROM contrato_aditivos WHERE id=$1', [id]); }

  // ─── Anexos ───────────────────────────────────────────────────────
  static async listarAnexos(contratoId) {
    const r = await query(`
      SELECT a.*, u.nome AS criador_nome
      FROM contrato_anexos a LEFT JOIN usuarios u ON u.id = a.criado_por
      WHERE a.contrato_id=$1 ORDER BY a.criado_em DESC`, [contratoId]);
    return r.rows;
  }

  static async criarAnexo(dados) {
    const r = await query(`
      INSERT INTO contrato_anexos (contrato_id, nome_original, nome_arquivo, caminho, tipo, tamanho, criado_por)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [dados.contrato_id, dados.nome_original, dados.nome_arquivo, dados.caminho, dados.tipo || null, dados.tamanho || null, dados.criado_por || null]);
    return r.rows[0];
  }

  static async buscarAnexo(id) { const r = await query('SELECT * FROM contrato_anexos WHERE id=$1', [id]); return r.rows[0]; }

  static async excluirAnexo(id) { await query('DELETE FROM contrato_anexos WHERE id=$1', [id]); }

  // ─── Auditoria ────────────────────────────────────────────────────
  static async listarAuditoria(contratoId) {
    const r = await query(`
      SELECT a.*, u.nome AS usuario_nome
      FROM contratos_auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.contrato_id=$1 ORDER BY a.criado_em DESC`, [contratoId]);
    return r.rows;
  }

  static async registrarAuditoria(contratoId, usuarioId, campo, valorAnterior, valorNovo) {
    await query(`
      INSERT INTO contratos_auditoria (contrato_id, usuario_id, campo, valor_anterior, valor_novo)
      VALUES ($1,$2,$3,$4,$5)`, [contratoId, usuarioId, campo, valorAnterior, valorNovo]);
  }

  // ─── Gráfico: custo mensal por período ─────────────────────────────
  static async custoMensalPorPeriodo(dataInicio, dataFim, unidadeId) {
    const sql = `
      SELECT
        TO_CHAR(mes, 'YYYY-MM') AS ano_mes,
        TO_CHAR(mes, 'Mon/YY') AS label,
        COALESCE(SUM(c.valor_mensal), 0) AS valor,
        COUNT(c.id) AS qtd_contratos
      FROM generate_series($1::date, $2::date, '1 month'::interval) AS mes
      LEFT JOIN contratos c ON
        c.status IN ('ativo', 'em_renovacao')
        AND c.unidade_id = $3
        AND c.data_inicio IS NOT NULL
        AND c.data_termino IS NOT NULL
        AND c.valor_mensal IS NOT NULL
        AND c.valor_mensal > 0
        AND c.data_inicio <= (mes + INTERVAL '1 month' - INTERVAL '1 day')::date
        AND c.data_termino >= mes::date
      GROUP BY mes
      ORDER BY mes`;
    const r = await query(sql, [dataInicio, dataFim, unidadeId]);
    return r.rows;
  }

  // ─── Helpers ──────────────────────────────────────────────────────
  static async proximoCodigo() {
    const r = await query(`SELECT codigo FROM contratos ORDER BY id DESC LIMIT 1`);
    if (r.rows.length === 0) return 'CTR-0001';
    const ultimo = r.rows[0].codigo;
    const match = ultimo.match(/(\d+)$/);
    if (!match) return 'CTR-0001';
    const num = parseInt(match[1]) + 1;
    return 'CTR-' + String(num).padStart(4, '0');
  }

  static async listarDepartamentos(unidadeId) {
    const r = await query(
      `SELECT DISTINCT departamento_responsavel AS d FROM contratos
       WHERE departamento_responsavel IS NOT NULL AND unidade_id = $1 ORDER BY 1`,
      [unidadeId]
    );
    return r.rows.map(row => row.d);
  }

  // Confirma que um contrato pertence à unidade ativa — usado antes de operar
  // sobre sub-recursos (obrigações, pagamentos, SLAs, aditivos, anexos), cujo
  // contrato_id chega pelo corpo da requisição.
  static async pertenceAUnidade(contratoId, unidadeId) {
    const id = parseInt(contratoId, 10);
    if (!id || Number.isNaN(id) || !unidadeId) return false;
    const r = await query(
      'SELECT 1 FROM contratos WHERE id = $1 AND unidade_id = $2 LIMIT 1',
      [id, unidadeId]
    );
    return r.rows.length > 0;
  }
}

module.exports = Contrato;
