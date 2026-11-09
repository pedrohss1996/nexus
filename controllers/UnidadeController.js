const Unidade  = require('../models/Unidade');
const Grupo    = require('../models/Grupo');
const Usuario  = require('../models/Usuario');
const PlanoContas = require('../models/PlanoContas');
const { auditLog } = require('../utils/logger');
const { query } = require('../config/database');
const acesso = require('../services/acesso');
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// ── Multer para anexos de unidade ───────────────────────────────────────────
const storageAnexos = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(__dirname, '..', 'uploads', 'unidades');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});
const uploadAnexo = multer({ storage: storageAnexos, limits: { fileSize: 20 * 1024 * 1024 } });

// ── Helper: registrar histórico ─────────────────────────────────────────────
async function registrarHistorico(unidade_id, descricao, tipo_evento, usuario_id, dados_extras = null) {
  try {
    await query(
      `INSERT INTO unidade_historico (unidade_id, descricao, tipo_evento, usuario_id, dados_extras)
       VALUES ($1, $2, $3, $4, $5)`,
      [unidade_id, descricao, tipo_evento, usuario_id, dados_extras ? JSON.stringify(dados_extras) : null]
    );
  } catch (_) {}
}

class UnidadeController {

  // ── Listar unidades ───────────────────────────────────────────────────────
  static async listar(req, res) {
    try {
      const { cd_tipo, busca } = req.query;
      const filtros = {};
      if (cd_tipo) filtros.cd_tipo = cd_tipo;
      if (busca)   filtros.busca   = busca;
      const unidades = await Unidade.buscarTodas(filtros);
      res.render('unidades/listar', { title: 'Unidades - DataFlow', user: req.user, unidades, filtros });
    } catch (error) {
      console.error('Erro ao listar unidades:', error);
      res.status(500).render('error', { title: 'Erro - DataFlow', message: 'Erro ao carregar unidades' });
    }
  }

  // ── Detalhes da unidade (com todas as abas) ───────────────────────────────
  static async detalhes(req, res) {
    try {
      const { id } = req.params;
      const unidade = await Unidade.buscarPorId(id);
      if (!unidade) {
        return res.status(404).render('error', { title: 'Erro - DataFlow', message: 'Unidade não encontrada' });
      }

      const [grupos, usuarios, todosUsuarios, estatisticas] = await Promise.all([
        Unidade.buscarGrupos(id),
        Unidade.buscarUsuarios(id),
        Usuario.buscarTodos({ ativo: true }),
        Unidade.obterEstatisticas(id),
      ]);

      let planoTree = [];
      try { planoTree = await PlanoContas.buildTree(id); } catch (_) {}

      // Centros de Custo vinculados
      let centrosCusto = [];
      try {
        const r = await query(
          `SELECT cc.*, u.nome AS unidade_nome
           FROM centros_custo cc
           LEFT JOIN unidades u ON u.id = cc.unidade_id
           WHERE cc.unidade_id = $1 AND cc.ativo = true
           ORDER BY cc.nome`, [id]);
        centrosCusto = r.rows;
      } catch (_) {}

      // Metas
      let metas = [];
      try {
        const r = await query(
          `SELECT m.*, u.nome AS criado_por_nome
           FROM unidade_metas m
           LEFT JOIN usuarios u ON u.id = m.criado_por
           WHERE m.unidade_id = $1
           ORDER BY m.criado_em DESC`, [id]);
        metas = r.rows;
      } catch (_) {}

      // Obrigações
      let obrigacoes = [];
      try {
        const r = await query(
          `SELECT o.*, u.nome AS criado_por_nome
           FROM unidade_obrigacoes o
           LEFT JOIN usuarios u ON u.id = o.criado_por
           WHERE o.unidade_id = $1
           ORDER BY o.data_vencimento ASC NULLS LAST, o.criado_em DESC`, [id]);
        obrigacoes = r.rows;
      } catch (_) {}

      // Anexos
      let anexos = [];
      try {
        const r = await query(
          `SELECT a.*, u.nome AS criado_por_nome
           FROM unidade_anexos a
           LEFT JOIN usuarios u ON u.id = a.criado_por
           WHERE a.unidade_id = $1
           ORDER BY a.criado_em DESC`, [id]);
        anexos = r.rows;
      } catch (_) {}

      // Aditivos
      let aditivos = [];
      try {
        const r = await query(
          `SELECT ad.*, u.nome AS criado_por_nome
           FROM unidade_aditivos ad
           LEFT JOIN usuarios u ON u.id = ad.criado_por
           WHERE ad.unidade_id = $1
           ORDER BY ad.data_assinatura DESC NULLS LAST, ad.criado_em DESC`, [id]);
        aditivos = r.rows;
      } catch (_) {}

      // Histórico
      let historico = [];
      try {
        const r = await query(
          `SELECT h.*, u.nome AS usuario_nome
           FROM unidade_historico h
           LEFT JOIN usuarios u ON u.id = h.usuario_id
           WHERE h.unidade_id = $1
           ORDER BY h.criado_em DESC
           LIMIT 100`, [id]);
        historico = r.rows;
      } catch (_) {}

      res.render('unidades/detalhes', {
        title: `${unidade.nome} - DataFlow`,
        user: req.user,
        unidade,
        grupos,
        usuarios,
        todosUsuarios: todosUsuarios || [],
        planoTree,
        estatisticas,
        centrosCusto,
        metas,
        obrigacoes,
        anexos,
        aditivos,
        historico,
        abaAtiva: req.query.aba || 'geral',
        erro: req.query.erro || null,
        sucesso: req.query.sucesso || null,
      });
    } catch (error) {
      console.error('Erro ao buscar unidade:', error);
      res.status(500).render('error', { title: 'Erro - DataFlow', message: 'Erro ao carregar unidade' });
    }
  }

  // ── Formulário criar / editar ─────────────────────────────────────────────
  static async formCriar(req, res) {
    res.render('unidades/form', { title: 'Nova Unidade - DataFlow', user: req.user, unidade: null });
  }

  static async criar(req, res) {
    try {
      const campos = UnidadeController._extrairCampos(req.body);
      const unidade = await Unidade.criar({ ...campos, criado_por: req.user.id });
      // Toda unidade nasce com o grupo "Geral" e com quem a criou dentro dele:
      // sem grupo, ninguém conseguia ser vinculado à unidade nova.
      try {
        const grupoGeral = await acesso.garantirGrupoGeral(unidade.id);
        await acesso.concederAcesso({ usuarioId: req.user.id, grupoId: grupoGeral, isLider: true, quem: req.user });
      } catch (e) { console.error('Erro ao criar grupo padrão da unidade:', e); }
      try { auditLog('UNIDADE_CRIADA', req.user.id, { unidade_id: unidade.id, nome: campos.nome }); } catch (_) {}
      await registrarHistorico(unidade.id, `Unidade "${unidade.nome}" criada`, 'criacao', req.user.id);
      res.redirect(`/unidades/${unidade.id}`);
    } catch (error) {
      console.error('Erro ao criar unidade:', error);
      res.status(500).render('error', { title: 'Erro - DataFlow', message: 'Erro ao criar unidade' });
    }
  }

  static async formEditar(req, res) {
    try {
      const unidade = await Unidade.buscarPorId(req.params.id);
      if (!unidade) return res.status(404).render('error', { title: 'Erro - DataFlow', message: 'Unidade não encontrada' });
      res.render('unidades/form', { title: `Editar ${unidade.nome} - DataFlow`, user: req.user, unidade });
    } catch (error) {
      res.status(500).render('error', { title: 'Erro - DataFlow', message: 'Erro ao carregar formulário' });
    }
  }

  static async atualizar(req, res) {
    try {
      const { id } = req.params;
      const campos = UnidadeController._extrairCampos(req.body);
      const unidade = await Unidade.atualizar(id, campos);
      if (!unidade) return res.status(404).render('error', { title: 'Erro - DataFlow', message: 'Unidade não encontrada' });
      try { auditLog('UNIDADE_ATUALIZADA', req.user.id, { unidade_id: id }); } catch (_) {}
      await registrarHistorico(id, `Dados cadastrais atualizados`, 'edicao', req.user.id);
      res.redirect(`/unidades/${id}`);
    } catch (error) {
      console.error('Erro ao atualizar unidade:', error.message);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: process.env.NODE_ENV !== 'production' ? `Erro: ${error.message}` : 'Erro ao atualizar unidade'
      });
    }
  }

  static _extrairCampos(body) {
    const { nome, cd_tipo, descricao, endereco, telefone, email,
            cnpj, razao_social, inscricao_estadual, inscricao_municipal,
            responsavel_legal, codigo_unidade, site,
            cep, numero, complemento, bairro, cidade, estado } = body;
    return { nome, cd_tipo, descricao, endereco, telefone, email,
             cnpj, razao_social, inscricao_estadual, inscricao_municipal,
             responsavel_legal, codigo_unidade, site,
             cep, numero, complemento, bairro, cidade, estado };
  }

  // ── Plano de Contas ───────────────────────────────────────────────────────
  static async planoContas(req, res) {
    try {
      const { id } = req.params;
      const unidade = await Unidade.buscarPorId(id);
      if (!unidade) return res.status(404).render('error', { title: 'Erro - DataFlow', message: 'Unidade não encontrada' });
      let tree = [];
      try { tree = await PlanoContas.buildTree(id); } catch (_) {}
      res.render('unidades/plano-contas', { title: `Plano de Contas - ${unidade.nome} - DataFlow`, user: req.user, unidade, tree });
    } catch (error) {
      res.status(500).render('error', { title: 'Erro - DataFlow', message: 'Erro ao carregar plano de contas' });
    }
  }

  static async criarSubcontaContabil(req, res) {
    try {
      const { id: unidadeId } = req.params;
      const { parent_id, nome, descricao, valor } = req.body;
      if (!nome || !String(nome).trim()) return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
      const node = await PlanoContas.criarSubconta(unidadeId, {
        parent_id: parent_id || null,
        nome: String(nome).trim(),
        descricao: descricao ? String(descricao).trim() : null,
        valor: valor != null ? parseFloat(valor) : undefined,
        criado_por: req.user.id
      });
      try { auditLog('CONTA_CONTABIL_CRIADA', req.user.id, { unidade_id: unidadeId, conta_id: node.id }); } catch (_) {}
      return res.status(201).json({ success: true, conta: node });
    } catch (error) {
      if (error.code === 'TETO_EXCEDIDO') return res.status(400).json({ success: false, message: error.message, erro: 'teto', disponivel: error.disponivel });
      return res.status(500).json({ success: false, message: error.message || 'Erro ao criar subconta' });
    }
  }

  static async atualizarContaContabil(req, res) {
    try {
      const { id: unidadeId, contaId } = req.params;
      const { nome, valor } = req.body;
      const dados = {};
      if (nome !== undefined) dados.nome = String(nome).trim();
      if (valor !== undefined) { const v = parseFloat(valor); if (Number.isNaN(v)) return res.status(400).json({ success: false, message: 'Valor inválido' }); dados.valor = v; }
      if (Object.keys(dados).length === 0) return res.status(400).json({ success: false, message: 'Envie nome ou valor' });
      const node = await PlanoContas.atualizarConta(contaId, unidadeId, dados);
      if (!node) return res.status(404).json({ success: false, message: 'Conta não encontrada' });
      return res.json({ success: true, conta: node });
    } catch (error) {
      if (error.code === 'TETO_EXCEDIDO') return res.status(400).json({ success: false, erro: 'teto', disponivel: error.disponivel, mensagem: error.message });
      return res.status(500).json({ success: false, message: error.message || 'Erro ao atualizar conta' });
    }
  }

  static async excluirContaContabil(req, res) {
    try {
      const { id: unidadeId, contaId } = req.params;
      const ok = await PlanoContas.excluirConta(contaId, unidadeId);
      if (!ok) return res.status(404).json({ success: false, message: 'Conta não encontrada' });
      try { auditLog('CONTA_CONTABIL_EXCLUIDA', req.user.id, { unidade_id: unidadeId, conta_id: contaId }); } catch (_) {}
      return res.json({ success: true, message: 'Conta e subcontas excluídas' });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message || 'Erro ao excluir conta' });
    }
  }

  static async criarContaContabil(req, res) {
    try {
      const { id } = req.params;
      const { codigo, nome, descricao } = req.body;
      if (!codigo || !nome) return res.redirect(`/unidades/${id}`);
      await Unidade.criarContaContabil(id, { codigo: codigo.trim(), nome: nome.trim(), descricao: descricao ? descricao.trim() : null, criado_por: req.user.id });
      res.redirect(`/unidades/${id}`);
    } catch (error) {
      if (error.code === '23505') return res.redirect(`/unidades/${req.params.id}?erro=conta_duplicada`);
      res.redirect(`/unidades/${req.params.id}`);
    }
  }

  // ── Grupos e usuários ─────────────────────────────────────────────────────
  static async criarGrupo(req, res) {
    try {
      const { id } = req.params;
      const { nome, descricao } = req.body;
      if (!nome || !nome.trim()) return res.redirect(`/unidades/${id}?erro=grupo_nome_obrigatorio&aba=grupos`);
      const grupo = await Grupo.criar({ nome: nome.trim(), descricao: descricao ? descricao.trim() : null, unidade_id: id, criado_por: req.user.id });
      try { auditLog('GRUPO_CRIADO', req.user.id, { grupo_id: grupo.id, unidade_id: id }); } catch (_) {}
      await registrarHistorico(id, `Grupo "${grupo.nome}" criado na unidade`, 'outro', req.user.id);
      res.redirect(`/unidades/${id}?aba=grupos`);
    } catch (error) {
      res.redirect(`/unidades/${req.params.id}?aba=grupos`);
    }
  }

  static async vincularUsuarioGrupo(req, res) {
    try {
      const { id: unidadeId } = req.params;
      const { grupo_id, usuario_id, is_lider } = req.body;
      if (!grupo_id || !usuario_id) return res.redirect(`/unidades/${unidadeId}?erro=grupo_usuario_obrigatorio&aba=grupos`);
      // A unidade vem do grupo; um grupo de outra unidade é recusado
      const g = await query('SELECT unidade_id FROM grupos WHERE id = $1', [grupo_id]);
      if (!g.rows.length || String(g.rows[0].unidade_id) !== String(unidadeId)) {
        return res.redirect(`/unidades/${unidadeId}?erro=grupo_de_outra_unidade&aba=grupos`);
      }
      try {
        await acesso.concederAcesso({ usuarioId: usuario_id, grupoId: grupo_id, isLider: is_lider === 'true' || is_lider === 'on', quem: req.user });
      } catch (e) {
        if (e instanceof acesso.ErroAcesso) return res.redirect(`/unidades/${unidadeId}?erro=sem_permissao&aba=grupos`);
        throw e;
      }
      try { auditLog('USUARIO_VINCULADO_GRUPO', req.user.id, { unidade_id: unidadeId, grupo_id, usuario_id }); } catch (_) {}
      res.redirect(`/unidades/${unidadeId}?aba=grupos`);
    } catch (error) {
      if (error.code === '23505') return res.redirect(`/unidades/${req.params.id}?erro=usuario_ja_no_grupo&aba=grupos`);
      res.redirect(`/unidades/${req.params.id}?aba=grupos`);
    }
  }

  // ── Centros de Custo ──────────────────────────────────────────────────────
  static async criarCentroCusto(req, res) {
    try {
      const { id } = req.params;
      const { nome, codigo, descricao, responsavel, tipo, valor_total } = req.body;
      if (!nome || !nome.trim()) return res.redirect(`/unidades/${id}?erro=cc_nome_obrigatorio&aba=centros-custo`);
      await query(
        `INSERT INTO centros_custo (nome, codigo, descricao, responsavel, tipo, valor_total, unidade_id, criado_por, ativo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)`,
        [nome.trim(), codigo || null, descricao || null, responsavel || null, tipo || 'operacional',
         valor_total ? parseFloat(valor_total) : 0, id, req.user.id]
      );
      await registrarHistorico(id, `Centro de custo "${nome}" cadastrado`, 'centro_custo', req.user.id);
      res.redirect(`/unidades/${id}?aba=centros-custo&sucesso=cc_criado`);
    } catch (error) {
      console.error('Erro ao criar centro de custo:', error);
      res.redirect(`/unidades/${req.params.id}?aba=centros-custo&erro=cc_erro`);
    }
  }

  static async excluirCentroCusto(req, res) {
    try {
      const { id, ccId } = req.params;
      await query(`UPDATE centros_custo SET ativo = false WHERE id = $1 AND unidade_id = $2`, [ccId, id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ── Metas ─────────────────────────────────────────────────────────────────
  static async criarMeta(req, res) {
    try {
      const { id } = req.params;
      const { titulo, descricao, indicador, valor_meta, valor_atual, unidade_medida, data_inicio, data_fim, status } = req.body;
      if (!titulo || !titulo.trim()) return res.redirect(`/unidades/${id}?erro=meta_titulo_obrigatorio&aba=metas`);
      await query(
        `INSERT INTO unidade_metas
         (unidade_id, titulo, descricao, indicador, valor_meta, valor_atual, unidade_medida, data_inicio, data_fim, status, criado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [id, titulo.trim(), descricao || null, indicador || null,
         valor_meta ? parseFloat(valor_meta) : null, valor_atual ? parseFloat(valor_atual) : 0,
         unidade_medida || null,
         data_inicio || null, data_fim || null, status || 'em_andamento', req.user.id]
      );
      await registrarHistorico(id, `Meta "${titulo}" cadastrada`, 'meta', req.user.id);
      res.redirect(`/unidades/${id}?aba=metas&sucesso=meta_criada`);
    } catch (error) {
      console.error('Erro ao criar meta:', error);
      res.redirect(`/unidades/${req.params.id}?aba=metas&erro=meta_erro`);
    }
  }

  static async atualizarMeta(req, res) {
    try {
      const { id, metaId } = req.params;
      const { titulo, descricao, indicador, valor_meta, valor_atual, unidade_medida, data_inicio, data_fim, status } = req.body;
      await query(
        `UPDATE unidade_metas SET
         titulo=$1, descricao=$2, indicador=$3, valor_meta=$4, valor_atual=$5,
         unidade_medida=$6, data_inicio=$7, data_fim=$8, status=$9, atualizado_em=NOW()
         WHERE id=$10 AND unidade_id=$11`,
        [titulo, descricao || null, indicador || null,
         valor_meta ? parseFloat(valor_meta) : null, valor_atual ? parseFloat(valor_atual) : 0,
         unidade_medida || null, data_inicio || null, data_fim || null,
         status || 'em_andamento', metaId, id]
      );
      res.redirect(`/unidades/${id}?aba=metas&sucesso=meta_atualizada`);
    } catch (error) {
      res.redirect(`/unidades/${req.params.id}?aba=metas&erro=meta_erro`);
    }
  }

  static async excluirMeta(req, res) {
    try {
      const { id, metaId } = req.params;
      await query(`DELETE FROM unidade_metas WHERE id = $1 AND unidade_id = $2`, [metaId, id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ── Obrigações ────────────────────────────────────────────────────────────
  static async criarObrigacao(req, res) {
    try {
      const { id } = req.params;
      const { titulo, descricao, tipo, periodicidade, data_vencimento, responsavel, status } = req.body;
      if (!titulo || !titulo.trim()) return res.redirect(`/unidades/${id}?erro=obrig_titulo_obrigatorio&aba=obrigacoes`);
      await query(
        `INSERT INTO unidade_obrigacoes
         (unidade_id, titulo, descricao, tipo, periodicidade, data_vencimento, responsavel, status, criado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, titulo.trim(), descricao || null, tipo || 'legal', periodicidade || 'unica',
         data_vencimento || null, responsavel || null, status || 'pendente', req.user.id]
      );
      await registrarHistorico(id, `Obrigação "${titulo}" cadastrada`, 'obrigacao', req.user.id);
      res.redirect(`/unidades/${id}?aba=obrigacoes&sucesso=obrig_criada`);
    } catch (error) {
      res.redirect(`/unidades/${req.params.id}?aba=obrigacoes&erro=obrig_erro`);
    }
  }

  static async atualizarObrigacao(req, res) {
    try {
      const { id, obrigacaoId } = req.params;
      const { titulo, descricao, tipo, periodicidade, data_vencimento, data_cumprimento, responsavel, status } = req.body;
      await query(
        `UPDATE unidade_obrigacoes SET
         titulo=$1, descricao=$2, tipo=$3, periodicidade=$4,
         data_vencimento=$5, data_cumprimento=$6, responsavel=$7, status=$8, atualizado_em=NOW()
         WHERE id=$9 AND unidade_id=$10`,
        [titulo, descricao || null, tipo || 'legal', periodicidade || 'unica',
         data_vencimento || null, data_cumprimento || null, responsavel || null,
         status || 'pendente', obrigacaoId, id]
      );
      res.redirect(`/unidades/${id}?aba=obrigacoes&sucesso=obrig_atualizada`);
    } catch (error) {
      res.redirect(`/unidades/${req.params.id}?aba=obrigacoes&erro=obrig_erro`);
    }
  }

  static async excluirObrigacao(req, res) {
    try {
      const { id, obrigacaoId } = req.params;
      await query(`DELETE FROM unidade_obrigacoes WHERE id = $1 AND unidade_id = $2`, [obrigacaoId, id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ── Anexos ────────────────────────────────────────────────────────────────
  static async criarAnexo(req, res) {
    try {
      const { id } = req.params;
      const { nome, descricao } = req.body;
      const arquivo = req.file;
      if (!arquivo) return res.redirect(`/unidades/${id}?erro=anexo_arquivo_obrigatorio&aba=anexos`);
      const arquivo_url = `/uploads/unidades/${arquivo.filename}`;
      const tamanho_kb  = Math.round(arquivo.size / 1024);
      await query(
        `INSERT INTO unidade_anexos (unidade_id, nome, descricao, arquivo_url, tipo_arquivo, tamanho_kb, criado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, (nome || arquivo.originalname).trim(), descricao || null,
         arquivo_url, arquivo.mimetype, tamanho_kb, req.user.id]
      );
      await registrarHistorico(id, `Anexo "${nome || arquivo.originalname}" adicionado`, 'anexo', req.user.id);
      res.redirect(`/unidades/${id}?aba=anexos&sucesso=anexo_criado`);
    } catch (error) {
      res.redirect(`/unidades/${req.params.id}?aba=anexos&erro=anexo_erro`);
    }
  }

  static async excluirAnexo(req, res) {
    try {
      const { id, anexoId } = req.params;
      const r = await query(`SELECT arquivo_url FROM unidade_anexos WHERE id = $1 AND unidade_id = $2`, [anexoId, id]);
      if (r.rows.length > 0) {
        const filePath = path.join(__dirname, '..', r.rows[0].arquivo_url);
        try { fs.unlinkSync(filePath); } catch (_) {}
        await query(`DELETE FROM unidade_anexos WHERE id = $1 AND unidade_id = $2`, [anexoId, id]);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ── Aditivos ──────────────────────────────────────────────────────────────
  static async criarAditivo(req, res) {
    try {
      const { id } = req.params;
      const { numero, titulo, descricao, tipo, valor_original, valor_aditado, data_assinatura, data_vigencia_inicio, data_vigencia_fim } = req.body;
      const arquivo = req.file;
      if (!titulo || !titulo.trim()) return res.redirect(`/unidades/${id}?erro=aditivo_titulo_obrigatorio&aba=aditivos`);
      const arquivo_url = arquivo ? `/uploads/unidades/${arquivo.filename}` : null;
      await query(
        `INSERT INTO unidade_aditivos
         (unidade_id, numero, titulo, descricao, tipo, valor_original, valor_aditado,
          data_assinatura, data_vigencia_inicio, data_vigencia_fim, arquivo_url, criado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [id, numero || null, titulo.trim(), descricao || null, tipo || 'prazo',
         valor_original ? parseFloat(valor_original) : null,
         valor_aditado  ? parseFloat(valor_aditado)  : null,
         data_assinatura || null, data_vigencia_inicio || null, data_vigencia_fim || null,
         arquivo_url, req.user.id]
      );
      await registrarHistorico(id, `Aditivo "${titulo}" cadastrado`, 'aditivo', req.user.id);
      res.redirect(`/unidades/${id}?aba=aditivos&sucesso=aditivo_criado`);
    } catch (error) {
      console.error('Erro ao criar aditivo:', error);
      res.redirect(`/unidades/${req.params.id}?aba=aditivos&erro=aditivo_erro`);
    }
  }

  static async excluirAditivo(req, res) {
    try {
      const { id, aditivoId } = req.params;
      const r = await query(`SELECT arquivo_url FROM unidade_aditivos WHERE id = $1 AND unidade_id = $2`, [aditivoId, id]);
      if (r.rows.length > 0 && r.rows[0].arquivo_url) {
        const filePath = path.join(__dirname, '..', r.rows[0].arquivo_url);
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
      await query(`DELETE FROM unidade_aditivos WHERE id = $1 AND unidade_id = $2`, [aditivoId, id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ── Desativar unidade ─────────────────────────────────────────────────────
  static async desativar(req, res) {
    try {
      const { id } = req.params;
      const unidade = await Unidade.desativar(id);
      if (!unidade) return res.status(404).json({ success: false, message: 'Unidade não encontrada' });
      try { auditLog('UNIDADE_DESATIVADA', req.user.id, { unidade_id: id }); } catch (_) {}
      res.json({ success: true, message: 'Unidade desativada com sucesso' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message || 'Erro ao desativar unidade' });
    }
  }
}

UnidadeController.uploadAnexo = uploadAnexo;

module.exports = UnidadeController;
