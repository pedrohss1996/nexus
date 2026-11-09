const { query } = require('../config/database');
const { auditLog } = require('../utils/logger');
const { unidadeDaRequisicao, semUnidade } = require('../utils/unidadeScope');
const { esperaJson } = require('../utils/requestType');
const { lerPaginacao, montarMeta, limitOffset } = require('../utils/paginacao');
const notificar = require('../sockets/notificar');
const FluxoEngine = require('../services/FluxoEngine');

class ProcessoController {
  // Listar processos
  static async index(req, res) {
    try {
      if (semUnidade(req, res)) return;
      const unidadeId = unidadeDaRequisicao(req);

      const pag = lerPaginacao(req);
      const { sql: limite, valores: valoresLimite } = limitOffset(2, pag);

      const processos = await query(
        `SELECT p.*,
         COALESCE(cta.nome, cc.nome) as centro_custo_nome,
         u.nome as criado_por_nome,
         COUNT(*) OVER() AS _total
         FROM processos p
         LEFT JOIN centros_custo cc ON p.centro_custo_id = cc.id
         LEFT JOIN contas_contabeis cta ON p.conta_contabil_id = cta.id
         LEFT JOIN usuarios u ON p.criado_por = u.id
         WHERE p.ativo = true AND p.unidade_id = $1
         ORDER BY p.criado_em DESC` + limite,
        [unidadeId, ...valoresLimite]
      );

      const { itens, meta } = montarMeta(pag, processos.rows, '/processos', req.query);

      res.render('processos/index', {
        title: 'Processos - DataFlow',
        user: req.user,
        processos: itens,
        meta
      });
    } catch (error) {
      console.error('Erro ao listar processos:', error);
      res.status(500).json({ success: false, message: 'Erro ao listar processos' });
    }
  }

  // Mostrar formulário de criação
  static async create(req, res) {
    try {
      const numeroProcesso = await ProcessoController.gerarNumeroProcesso();
      const unidadeId = req.session?.unidadeSelecionada || res.locals?.unidadeSelecionada;

      let contasContabeis = [];
      if (unidadeId) {
        const PlanoContas = require('../models/PlanoContas');
        const tree = await PlanoContas.buildTree(unidadeId);
        // Achatamento em ordem de cadastro: 1.0, depois todas 1.x, depois 2.0, depois todas 2.x, etc.
        function flattenDepthFirst(nodes, depth = 0) {
          const out = [];
          for (const node of nodes) {
            out.push({ id: node.id, codigo: node.codigo, nome: node.nome, depth });
            if (node.children && node.children.length) {
              out.push(...flattenDepthFirst(node.children, depth + 1));
            }
          }
          return out;
        }
        contasContabeis = flattenDepthFirst(tree);
      }

      const [fornecedores, fluxos] = await Promise.all([
        query(`SELECT id, nome_fantasia, razao_social, nome FROM fornecedores WHERE ativo = true ORDER BY COALESCE(nome_fantasia, razao_social, nome)`),
        query('SELECT id, nome, slug FROM fluxos WHERE ativo = true ORDER BY nome')
      ]);

      res.render('processos/create', {
        title: 'Novo Processo - DataFlow',
        user: req.user,
        numeroProcesso,
        contasContabeis,
        fornecedores: fornecedores.rows,
        fluxos: fluxos.rows
      });
    } catch (error) {
      console.error('Erro ao carregar formulário:', error);
      res.status(500).render('error', { title: 'Erro', message: 'Erro ao carregar formulário de processo' });
    }
  }

  // Gerar número do processo (PROC-YYYY-NNNNN)
  static async gerarNumeroProcesso() {
    const ano = new Date().getFullYear();
    const prefix = `PROC-${ano}-`;
    const r = await query(
      `SELECT numero_processo FROM processos WHERE numero_processo LIKE $1 ORDER BY numero_processo DESC LIMIT 1`,
      [prefix + '%']
    );
    let seq = 1;
    if (r.rows.length > 0 && r.rows[0].numero_processo) {
      const last = r.rows[0].numero_processo.replace(prefix, '');
      const n = parseInt(last, 10);
      if (!isNaN(n)) seq = n + 1;
    }
    return prefix + String(seq).padStart(5, '0');
  }

  // Criar processo
  static async store(req, res) {
    try {
      const {
        titulo,
        descricao_detalhada,
        observacao,
        emergencial,
        fornecedor_id,
        data_vencimento,
        centro_custo_id,
        conta_contabil_id,
        fluxo_id
      } = req.body;
      const userId = req.user.id;

      if (semUnidade(req, res)) return;
      const unidadeId = unidadeDaRequisicao(req);

      if (!titulo || !String(titulo).trim()) {
        req.flash && req.flash('error', 'Título é obrigatório.');
        return res.redirect('/processos/novo');
      }

      const numeroProcesso = await ProcessoController.gerarNumeroProcesso();

      const result = await query(
        `INSERT INTO processos (
          titulo, descricao, descricao_detalhada, observacao, numero_processo,
          emergencial, fornecedor_id, data_vencimento, centro_custo_id, conta_contabil_id, fluxo_id,
          status, criado_por, unidade_id, criado_em
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pendente', $12, $13, NOW())
        RETURNING *`,
        [
          String(titulo).trim(),
          descricao_detalhada ? String(descricao_detalhada).trim() : null,
          descricao_detalhada ? String(descricao_detalhada).trim() : null,
          observacao ? String(observacao).trim() : null,
          numeroProcesso,
          emergencial === '1' || emergencial === 'on' || emergencial === 'sim',
          fornecedor_id ? parseInt(fornecedor_id, 10) : null,
          data_vencimento || null,
          centro_custo_id ? parseInt(centro_custo_id, 10) : null,
          conta_contabil_id ? parseInt(conta_contabil_id, 10) : null,
          fluxo_id ? parseInt(fluxo_id, 10) : null,
          userId,
          unidadeId
        ]
      );

      const processo = result.rows[0];
      const processoId = processo.id;

      // Inserir anexos (arquivos enviados)
      const files = req.files || [];
      for (const file of files) {
        if (file && file.filename) {
          const caminhoWeb = '/uploads/processos/' + file.filename;
          await query(
            `INSERT INTO anexos (processo_id, nome_original, nome_arquivo, caminho, tipo, tamanho, criado_por)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              processoId,
              file.originalname || file.filename,
              file.filename,
              caminhoWeb,
              file.mimetype || null,
              file.size || null,
              userId
            ]
          );
        }
      }

      auditLog('PROCESSO_CRIADO', userId, { processoId, titulo: processo.titulo, numero_processo: numeroProcesso, ip: req.ip });
      notificar.processoAtualizado(unidadeId, {
        processoId, status: 'pendente', titulo: processo.titulo
      });

      // Coloca o processo na etapa inicial do fluxo escolhido. Antes, fluxo_id
      // era gravado e nunca mais consultado — o desenho não governava nada.
      if (processo.fluxo_id) {
        const inicio = await FluxoEngine.iniciar(processoId, processo.fluxo_id, { usuarioId: userId });
        if (!inicio) {
          req.flash && req.flash('error',
            'Processo criado, mas o fluxo escolhido não tem etapa inicial definida.');
        }
      }

      req.flash && req.flash('success', `Processo criado: ${numeroProcesso}`);
      res.redirect('/processos');
    } catch (error) {
      console.error('Erro ao criar processo:', error);
      req.flash && req.flash('error', error.message || 'Erro ao criar processo');
      res.redirect('/processos/novo');
    }
  }

  // Mostrar processo
  static async show(req, res) {
    try {
      const { id } = req.params;

      if (semUnidade(req, res)) return;
      const unidadeId = unidadeDaRequisicao(req);

      // O filtro por unidade também fecha o IDOR: um id de outra unidade
      // devolve 404 em vez de expor o processo.
      const processo = await query(
        `SELECT p.*,
         COALESCE(cta.nome, cc.nome) as centro_custo_nome,
         u.nome as criado_por_nome
         FROM processos p
         LEFT JOIN centros_custo cc ON p.centro_custo_id = cc.id
         LEFT JOIN contas_contabeis cta ON p.conta_contabil_id = cta.id
         LEFT JOIN usuarios u ON p.criado_por = u.id
         WHERE p.id = $1 AND p.ativo = true AND p.unidade_id = $2`,
        [id, unidadeId]
      );

      if (processo.rows.length === 0) {
        return res.status(404).render('error', {
          title: 'Não Encontrado - DataFlow',
          message: 'Processo não encontrado'
        });
      }

      // Buscar documentos do processo
      const documentos = await query(
        'SELECT * FROM documentos WHERE processo_id = $1 AND ativo = true ORDER BY criado_em DESC',
        [id]
      );

      // Estado do fluxo: em que etapa está, o histórico e se este usuário
      // pode agir agora. Sem isso a tela não tinha como mostrar o fluxo.
      const [situacao, historico] = await Promise.all([
        FluxoEngine.situacao(id),
        FluxoEngine.historico(id)
      ]);
      const podeAgir = situacao && situacao.etapa_atual_id
        ? await FluxoEngine.podeAgir(req.user, situacao)
        : false;

      res.render('processos/show', {
        title: `Processo #${id} - DataFlow`,
        user: req.user,
        processo: processo.rows[0],
        documentos: documentos.rows,
        fluxo: situacao,
        historicoFluxo: historico,
        podeAgirNaEtapa: podeAgir
      });
    } catch (error) {
      console.error('Erro ao buscar processo:', error);
      res.status(500).json({ success: false, message: 'Erro ao buscar processo' });
    }
  }

  // Executa a decisão sobre a etapa atual.
  // Com fluxo definido, quem manda é o desenho: o motor confere se o usuário
  // pertence ao grupo dono da etapa, valida exigências (assinatura, decisão
  // obrigatória) e resolve a próxima etapa pelas transições. Sem fluxo, mantém
  // o comportamento antigo de marcar o status direto.
  static async _decidir(req, res, decisao) {
    const { id } = req.params;
    const userId = req.user.id;

    if (semUnidade(req, res, { json: true })) return;
    const unidadeId = unidadeDaRequisicao(req);

    // Confere posse pela unidade antes de qualquer coisa
    const dono = await query(
      'SELECT id, titulo, fluxo_id FROM processos WHERE id = $1 AND ativo = true AND unidade_id = $2',
      [id, unidadeId]
    );
    if (dono.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Processo não encontrado' });
    }

    const processo = dono.rows[0];
    const observacao = req.body?.observacao || null;

    // ── Caminho com fluxo ────────────────────────────────────────────────
    if (processo.fluxo_id) {
      try {
        const r = await FluxoEngine.avancar(id, req.user, { decisao, observacao });
        const mensagem = r.concluido
          ? `Fluxo concluído: processo ${r.status}.`
          : `Etapa concluída. Agora em "${r.proximaEtapa.nome}".`;

        if (esperaJson(req)) return res.json({ success: true, message: mensagem, ...r });
        req.flash && req.flash('success', mensagem);
        return res.redirect(`/processos/${id}`);
      } catch (err) {
        if (err.name === 'ErroFluxo') {
          const status = err.codigo === 'SEM_PERMISSAO' ? 403 : 422;
          if (esperaJson(req)) {
            return res.status(status).json({ success: false, codigo: err.codigo, message: err.message });
          }
          req.flash && req.flash('error', err.message);
          return res.redirect(`/processos/${id}`);
        }
        throw err;
      }
    }

    // ── Caminho sem fluxo (legado) ───────────────────────────────────────
    const aprovado = decisao === 'aprovado';
    const result = await query(
      `UPDATE processos
       SET status = $1,
           ${aprovado ? 'aprovado_por = $2, aprovado_em = NOW()' : 'rejeitado_por = $2, rejeitado_em = NOW(), motivo_rejeicao = $4'}
           , atualizado_em = NOW()
       WHERE id = $3 AND ativo = true
       RETURNING *`,
      aprovado ? [decisao, userId, id] : [decisao, userId, id, observacao]
    );

    auditLog(aprovado ? 'PROCESSO_APROVADO' : 'PROCESSO_REJEITADO', userId, { processoId: id, ip: req.ip });
    notificar.processoAtualizado(unidadeId, {
      processoId: result.rows[0].id, status: decisao, titulo: result.rows[0].titulo
    });

    const msg = aprovado ? 'Processo aprovado com sucesso' : 'Processo rejeitado';
    if (esperaJson(req)) return res.json({ success: true, message: msg });
    req.flash && req.flash('success', msg);
    return res.redirect(`/processos/${id}`);
  }

  // Aprovar processo / concluir etapa com aprovação
  static async aprovar(req, res) {
    try {
      await ProcessoController._decidir(req, res, 'aprovado');
    } catch (error) {
      console.error('Erro ao aprovar processo:', error);
      res.status(500).json({ success: false, message: 'Erro ao aprovar processo' });
    }
  }

  // Rejeitar processo / concluir etapa com reprovação
  static async rejeitar(req, res) {
    try {
      await ProcessoController._decidir(req, res, 'reprovado');
    } catch (error) {
      console.error('Erro ao rejeitar processo:', error);
      res.status(500).json({ success: false, message: 'Erro ao rejeitar processo' });
    }
  }

  // Concluir etapa sem decisão (etapas de formulário/execução)
  static async concluirEtapa(req, res) {
    try {
      const { id } = req.params;
      if (semUnidade(req, res, { json: true })) return;
      const unidadeId = unidadeDaRequisicao(req);

      const dono = await query(
        'SELECT id FROM processos WHERE id = $1 AND ativo = true AND unidade_id = $2',
        [id, unidadeId]
      );
      if (dono.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Processo não encontrado' });
      }

      const r = await FluxoEngine.avancar(id, req.user, {
        decisao: null,
        observacao: req.body?.observacao || null
      });
      const mensagem = r.concluido
        ? 'Fluxo concluído.'
        : `Etapa concluída. Agora em "${r.proximaEtapa.nome}".`;

      if (esperaJson(req)) return res.json({ success: true, message: mensagem, ...r });
      req.flash && req.flash('success', mensagem);
      res.redirect(`/processos/${id}`);
    } catch (error) {
      if (error.name === 'ErroFluxo') {
        const status = error.codigo === 'SEM_PERMISSAO' ? 403 : 422;
        if (esperaJson(req)) {
          return res.status(status).json({ success: false, codigo: error.codigo, message: error.message });
        }
        req.flash && req.flash('error', error.message);
        return res.redirect(`/processos/${req.params.id}`);
      }
      console.error('Erro ao concluir etapa:', error);
      res.status(500).json({ success: false, message: 'Erro ao concluir etapa' });
    }
  }

  // Caixa de tarefas: etapas pendentes endereçadas ao usuário
  static async minhasTarefas(req, res) {
    try {
      if (semUnidade(req, res)) return;
      const unidadeId = unidadeDaRequisicao(req);

      const pag = lerPaginacao(req);
      const linhas = await FluxoEngine.tarefasDoUsuario(req.user, unidadeId, pag);
      const { itens, meta } = montarMeta(pag, linhas, '/processos/tarefas', req.query);

      res.render('processos/tarefas', {
        title: 'Minhas Tarefas - DataFlow',
        user: req.user,
        tarefas: itens,
        meta
      });
    } catch (error) {
      console.error('Erro ao listar tarefas:', error);
      res.status(500).render('error', { title: 'Erro', message: 'Erro ao carregar tarefas', user: req.user });
    }
  }

  // Editar processo
  static async edit(req, res) {
    // Implementar conforme necessário
    res.json({ message: 'Em desenvolvimento' });
  }

  // Atualizar processo
  static async update(req, res) {
    // Implementar conforme necessário
    res.json({ message: 'Em desenvolvimento' });
  }

  // Deletar processo (soft delete)
  static async destroy(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      if (semUnidade(req, res, { json: true })) return;
      const unidadeId = unidadeDaRequisicao(req);

      const result = await query(
        `UPDATE processos SET ativo = false, atualizado_em = NOW()
         WHERE id = $1 AND unidade_id = $2
         RETURNING id`,
        [id, unidadeId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Processo não encontrado' });
      }

      auditLog('PROCESSO_DELETADO', userId, { processoId: id, ip: req.ip });

      res.json({ success: true, message: 'Processo deletado' });
    } catch (error) {
      console.error('Erro ao deletar processo:', error);
      res.status(500).json({ success: false, message: 'Erro ao deletar processo' });
    }
  }
}

module.exports = ProcessoController;
