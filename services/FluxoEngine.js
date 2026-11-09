// Motor de execução de fluxo
//
// O editor de fluxos produzia um desenho que ninguém lia: etapas, responsáveis,
// prazos, condições de transição e exigência de assinatura eram gravados e
// ignorados. Este módulo é o runtime que faltava — é ele que decide em que
// etapa um processo está, quem pode agir sobre ela e para onde o processo vai
// depois de cada decisão.
//
// Regras que ele respeita, todas vindas do desenho:
//   fluxo_etapas.eh_inicio           → onde o processo entra
//   fluxo_etapas.proprietario_id     → qual grupo pode agir (proprietario_tipo
//                                      é sempre 'grupo': o editor grava fixo)
//   fluxo_etapas.prazo_em_dias       → prazo da tarefa
//   fluxo_etapas.exige_assinatura    → bloqueia avanço sem assinatura
//   fluxo_etapas.eh_fim              → conclui o processo
//   fluxo_edges.condicao_tipo        → qual caminho seguir após a decisão

const { query, transaction } = require('../config/database');
const { auditLog } = require('../utils/logger');
const notificar = require('../sockets/notificar');

const DECISOES = ['aprovado', 'reprovado'];

class ErroFluxo extends Error {
  constructor(mensagem, codigo = 'FLUXO_ERRO') {
    super(mensagem);
    this.name = 'ErroFluxo';
    this.codigo = codigo;
  }
}

// ── Leitura ─────────────────────────────────────────────────────────────────

// Situação atual do processo: etapa, tarefa aberta e quem responde por ela
async function situacao(processoId, cliente = null) {
  const exec = cliente ? cliente.query.bind(cliente) : query;

  const r = await exec(
    `SELECT p.id, p.titulo, p.status, p.fluxo_id, p.etapa_atual_id, p.unidade_id,
            p.fluxo_iniciado_em, p.fluxo_concluido_em,
            f.nome  AS fluxo_nome,
            e.id    AS etapa_id, e.nome AS etapa_nome, e.codigo AS etapa_codigo,
            e.tipo_acao, e.eh_fim, e.exige_assinatura, e.prazo_em_dias,
            e.proprietario_id AS grupo_id,
            g.nome  AS grupo_nome,
            t.id    AS tarefa_id, t.prazo, t.iniciada_em
     FROM processos p
     LEFT JOIN fluxos f       ON f.id = p.fluxo_id
     LEFT JOIN fluxo_etapas e ON e.id = p.etapa_atual_id
     LEFT JOIN grupos g       ON g.id = e.proprietario_id
     LEFT JOIN processo_etapas t
            ON t.processo_id = p.id AND t.etapa_id = e.id AND t.status = 'pendente'
     WHERE p.id = $1`,
    [processoId]
  );
  return r.rows[0] || null;
}

// Histórico completo, para a linha do tempo na tela do processo
async function historico(processoId) {
  const r = await query(
    `SELECT pe.*, e.nome AS etapa_nome, e.codigo AS etapa_codigo,
            g.nome AS grupo_nome, u.nome AS responsavel_nome
     FROM processo_etapas pe
     JOIN fluxo_etapas e ON e.id = pe.etapa_id
     LEFT JOIN grupos g  ON g.id = e.proprietario_id
     LEFT JOIN usuarios u ON u.id = pe.responsavel_id
     WHERE pe.processo_id = $1
     ORDER BY pe.iniciada_em ASC, pe.id ASC`,
    [processoId]
  );
  return r.rows;
}

// Tarefas abertas endereçadas ao usuário (grupos a que pertence).
// Admin enxerga todas as tarefas da unidade ativa.
async function tarefasDoUsuario(usuario, unidadeId, { pagina = 1, porPagina = 25 } = {}) {
  const offset = (pagina - 1) * porPagina;

  const filtroGrupo = usuario.perfil === 'admin'
    ? ''
    : `AND e.proprietario_id IN (
         SELECT grupo_id FROM usuarios_grupos WHERE usuario_id = $2
       )`;

  const params = usuario.perfil === 'admin'
    ? [unidadeId, porPagina, offset]
    : [unidadeId, usuario.id, porPagina, offset];

  const iLimit = usuario.perfil === 'admin' ? 2 : 3;

  const r = await query(
    `SELECT pe.id AS tarefa_id, pe.prazo, pe.iniciada_em,
            p.id AS processo_id, p.numero_processo, p.titulo,
            e.nome AS etapa_nome, e.tipo_acao, e.exige_assinatura,
            g.nome AS grupo_nome,
            (pe.prazo IS NOT NULL AND pe.prazo < NOW()) AS atrasada,
            COUNT(*) OVER() AS _total
     FROM processo_etapas pe
     JOIN processos p     ON p.id = pe.processo_id
     JOIN fluxo_etapas e  ON e.id = pe.etapa_id
     LEFT JOIN grupos g   ON g.id = e.proprietario_id
     WHERE pe.status = 'pendente'
       AND p.ativo = true
       AND p.unidade_id = $1
       ${filtroGrupo}
     ORDER BY (pe.prazo IS NULL), pe.prazo ASC, pe.iniciada_em ASC
     LIMIT $${iLimit} OFFSET $${iLimit + 1}`,
    params
  );
  return r.rows;
}

// ── Autorização ─────────────────────────────────────────────────────────────

// Quem pode agir numa etapa: membro do grupo proprietário, ou admin.
// Gestor NÃO recebe passe livre de propósito — o dono da etapa é o grupo
// definido no desenho; caso contrário o fluxo vira decorativo de novo.
async function podeAgir(usuario, etapa) {
  if (!etapa) return false;
  if (usuario.perfil === 'admin') return true;
  if (!etapa.proprietario_id && !etapa.grupo_id) return false;

  const grupoId = etapa.grupo_id || etapa.proprietario_id;
  const r = await query(
    'SELECT 1 FROM usuarios_grupos WHERE usuario_id = $1 AND grupo_id = $2 LIMIT 1',
    [usuario.id, grupoId]
  );
  return r.rows.length > 0;
}

// ── Validação do desenho ────────────────────────────────────────────────────

// Um fluxo mal desenhado só se revelava quando o processo travava. Isto detecta
// os problemas antes: sem início, etapa sem saída que não é fim, etapa
// inalcançável, transição para etapa de outro fluxo.
async function validarDesenho(fluxoId) {
  const [etapasR, edgesR] = await Promise.all([
    query('SELECT * FROM fluxo_etapas WHERE fluxo_id = $1 ORDER BY ordem', [fluxoId]),
    query('SELECT * FROM fluxo_edges WHERE fluxo_id = $1', [fluxoId])
  ]);

  const etapas = etapasR.rows;
  const edges = edgesR.rows;
  const problemas = [];

  if (etapas.length === 0) {
    problemas.push({ nivel: 'erro', mensagem: 'O fluxo não tem nenhuma etapa.' });
    return { valido: false, problemas };
  }

  const iniciais = etapas.filter(e => e.eh_inicio);
  if (iniciais.length === 0) {
    problemas.push({ nivel: 'erro', mensagem: 'Nenhuma etapa marcada como inicial — o fluxo não pode ser iniciado.' });
  } else if (iniciais.length > 1) {
    problemas.push({ nivel: 'erro', mensagem: `${iniciais.length} etapas marcadas como iniciais; deve haver exatamente uma.` });
  }

  if (!etapas.some(e => e.eh_fim)) {
    problemas.push({ nivel: 'aviso', mensagem: 'Nenhuma etapa marcada como final — o processo nunca será concluído automaticamente.' });
  }

  etapas.forEach(e => {
    if (!e.proprietario_id) {
      problemas.push({ nivel: 'erro', mensagem: `A etapa "${e.nome}" não tem grupo responsável — ninguém poderá agir nela.` });
    }
    const saidas = edges.filter(x => x.etapa_origem_id === e.id);
    if (saidas.length === 0 && !e.eh_fim) {
      problemas.push({ nivel: 'erro', mensagem: `A etapa "${e.nome}" não tem transição de saída e não é final — o processo ficaria travado nela.` });
    }
    // Etapa de decisão precisa de caminho para os dois desfechos
    if (saidas.length > 0) {
      const tipos = new Set(saidas.map(s => s.condicao_tipo || 'sempre'));
      if (tipos.has('aprovado') && !tipos.has('reprovado') && !tipos.has('sempre')) {
        problemas.push({ nivel: 'aviso', mensagem: `A etapa "${e.nome}" trata "aprovado" mas não "reprovado" — uma reprovação travaria o processo.` });
      }
    }
  });

  // Alcançabilidade a partir da etapa inicial
  if (iniciais.length === 1) {
    const alcancadas = new Set([iniciais[0].id]);
    let mudou = true;
    while (mudou) {
      mudou = false;
      edges.forEach(x => {
        if (alcancadas.has(x.etapa_origem_id) && !alcancadas.has(x.etapa_destino_id)) {
          alcancadas.add(x.etapa_destino_id);
          mudou = true;
        }
      });
    }
    etapas.filter(e => !alcancadas.has(e.id)).forEach(e => {
      problemas.push({ nivel: 'aviso', mensagem: `A etapa "${e.nome}" não é alcançável a partir da etapa inicial.` });
    });
  }

  // Expressões customizadas não são avaliadas — avisa em vez de fingir suporte
  edges.filter(x => x.condicao_tipo === 'expressao').forEach(x => {
    problemas.push({
      nivel: 'aviso',
      mensagem: 'Há transição com condição do tipo "expressão", que não é avaliada pelo motor e será ignorada.'
    });
  });

  return { valido: !problemas.some(p => p.nivel === 'erro'), problemas };
}

// ── Execução ────────────────────────────────────────────────────────────────

function calcularPrazo(prazoEmDias) {
  if (!prazoEmDias || prazoEmDias <= 0) return null;
  const d = new Date();
  d.setDate(d.getDate() + prazoEmDias);
  return d;
}

// Abre a tarefa de uma etapa e aponta o processo para ela
async function abrirTarefa(cliente, processoId, etapa) {
  const prazo = calcularPrazo(etapa.prazo_em_dias);

  await cliente.query(
    `INSERT INTO processo_etapas (processo_id, etapa_id, status, prazo)
     VALUES ($1, $2, 'pendente', $3)
     ON CONFLICT DO NOTHING`,
    [processoId, etapa.id, prazo]
  );
  await cliente.query(
    'UPDATE processos SET etapa_atual_id = $1, atualizado_em = NOW() WHERE id = $2',
    [etapa.id, processoId]
  );
  return prazo;
}

// Coloca o processo na etapa inicial do fluxo escolhido
async function iniciar(processoId, fluxoId, { usuarioId } = {}) {
  if (!fluxoId) return null;

  return transaction(async (cliente) => {
    const inicial = await cliente.query(
      `SELECT * FROM fluxo_etapas WHERE fluxo_id = $1 AND eh_inicio = true ORDER BY ordem LIMIT 1`,
      [fluxoId]
    );

    if (inicial.rows.length === 0) {
      // Não derruba a criação do processo: registra e segue sem fluxo
      console.warn(`⚠️  Fluxo ${fluxoId} não tem etapa inicial — processo ${processoId} ficou sem fluxo ativo.`);
      return null;
    }

    const etapa = inicial.rows[0];
    const prazo = await abrirTarefa(cliente, processoId, etapa);
    await cliente.query(
      'UPDATE processos SET fluxo_iniciado_em = NOW() WHERE id = $1 AND fluxo_iniciado_em IS NULL',
      [processoId]
    );

    auditLog('FLUXO_INICIADO', usuarioId, { processoId, fluxoId, etapaId: etapa.id });
    return { etapa, prazo };
  });
}

// Escolhe as transições válidas para a decisão tomada
function transicoesValidas(edges, decisao) {
  return edges.filter(e => {
    const tipo = e.condicao_tipo || 'sempre';
    if (tipo === 'sempre') return true;
    if (tipo === 'aprovado') return decisao === 'aprovado';
    if (tipo === 'reprovado') return decisao === 'reprovado';
    // 'expressao' não é avaliada: avaliar string do banco seria execução de
    // código vinda de dado. Fica documentado em validarDesenho().
    return false;
  });
}

// Conclui a etapa atual e move o processo adiante
async function avancar(processoId, usuario, { decisao = null, observacao = null } = {}) {
  if (decisao && !DECISOES.includes(decisao)) {
    throw new ErroFluxo(`Decisão inválida: ${decisao}`, 'DECISAO_INVALIDA');
  }

  const atual = await situacao(processoId);
  if (!atual) throw new ErroFluxo('Processo não encontrado', 'NAO_ENCONTRADO');
  if (!atual.fluxo_id) throw new ErroFluxo('Este processo não segue nenhum fluxo.', 'SEM_FLUXO');
  if (!atual.etapa_atual_id) throw new ErroFluxo('O fluxo deste processo já foi concluído.', 'JA_CONCLUIDO');
  if (!atual.tarefa_id) throw new ErroFluxo('Não há tarefa aberta nesta etapa.', 'SEM_TAREFA');

  if (!(await podeAgir(usuario, atual))) {
    throw new ErroFluxo(
      `Esta etapa é de responsabilidade do grupo "${atual.grupo_nome || '—'}".`,
      'SEM_PERMISSAO'
    );
  }

  // Etapa de decisão exige decisão explícita
  const etapaDecide = atual.tipo_acao === 'aprovacao' || atual.tipo_acao === 'parecer_tecnico';
  if (etapaDecide && !decisao) {
    throw new ErroFluxo('Esta etapa exige aprovar ou reprovar.', 'DECISAO_OBRIGATORIA');
  }

  // Exigência de assinatura declarada no desenho.
  // Reprovar não exige assinatura: barrar a reprovação por falta de assinatura
  // deixaria o processo sem saída quando o documento fosse justamente o problema.
  if (atual.exige_assinatura && decisao !== 'reprovado') {
    const assinado = await query(
      `SELECT 1 FROM documentos_gerados
       WHERE processo_id = $1 AND status_assinatura = 'assinado'
       LIMIT 1`,
      [processoId]
    );
    if (assinado.rows.length === 0) {
      throw new ErroFluxo(
        'Esta etapa exige um documento assinado eletronicamente vinculado ao processo.',
        'ASSINATURA_PENDENTE'
      );
    }
  }

  return transaction(async (cliente) => {
    // Fecha a tarefa atual
    await cliente.query(
      `UPDATE processo_etapas
       SET status = $1, decisao = $2, observacao = $3, responsavel_id = $4, concluida_em = NOW()
       WHERE id = $5 AND status = 'pendente'`,
      [decisao === 'reprovado' ? 'rejeitada' : 'concluida', decisao, observacao, usuario.id, atual.tarefa_id]
    );

    const edgesR = await cliente.query(
      'SELECT * FROM fluxo_edges WHERE etapa_origem_id = $1 ORDER BY ordem',
      [atual.etapa_atual_id]
    );
    const candidatas = transicoesValidas(edgesR.rows, decisao);

    // Sem saída válida ou etapa final: o fluxo termina aqui
    if (candidatas.length === 0 || atual.eh_fim) {
      const statusFinal = decisao === 'reprovado' ? 'rejeitado' : 'aprovado';
      await cliente.query(
        `UPDATE processos
         SET etapa_atual_id = NULL, fluxo_concluido_em = NOW(), status = $1,
             ${decisao === 'reprovado' ? 'rejeitado_por = $2, rejeitado_em = NOW()' : 'aprovado_por = $2, aprovado_em = NOW()'},
             atualizado_em = NOW()
         WHERE id = $3`,
        [statusFinal, usuario.id, processoId]
      );

      auditLog('FLUXO_CONCLUIDO', usuario.id, { processoId, statusFinal, etapaId: atual.etapa_atual_id });
      notificar.processoAtualizado(atual.unidade_id, {
        processoId, status: statusFinal, titulo: atual.titulo
      });

      return { concluido: true, status: statusFinal, proximaEtapa: null };
    }

    // Segue para a primeira transição válida (ordem define a precedência).
    // Paralelismo (fork) não é suportado: o desenho não tem gateway para isso.
    const destinoR = await cliente.query(
      'SELECT * FROM fluxo_etapas WHERE id = $1',
      [candidatas[0].etapa_destino_id]
    );
    const proxima = destinoR.rows[0];
    if (!proxima) throw new ErroFluxo('Transição aponta para etapa inexistente.', 'DESENHO_INVALIDO');

    const prazo = await abrirTarefa(cliente, processoId, proxima);
    await cliente.query(
      `UPDATE processos SET status = 'em_andamento', atualizado_em = NOW() WHERE id = $1`,
      [processoId]
    );

    auditLog('FLUXO_AVANCOU', usuario.id, {
      processoId, de: atual.etapa_codigo, para: proxima.codigo, decisao
    });
    notificar.processoAtualizado(atual.unidade_id, {
      processoId, status: 'em_andamento', titulo: atual.titulo
    });

    return {
      concluido: false,
      status: 'em_andamento',
      proximaEtapa: { id: proxima.id, nome: proxima.nome, prazo }
    };
  });
}

module.exports = {
  ErroFluxo,
  situacao,
  historico,
  tarefasDoUsuario,
  podeAgir,
  validarDesenho,
  iniciar,
  avancar,
  transicoesValidas,
  calcularPrazo
};
