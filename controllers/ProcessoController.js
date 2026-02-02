const { query } = require('../config/database');
const { auditLog } = require('../utils/logger');

class ProcessoController {
  // Listar processos
  static async index(req, res) {
    try {
      const processos = await query(
        `SELECT p.*,
         COALESCE(cta.nome, cc.nome) as centro_custo_nome,
         u.nome as criado_por_nome
         FROM processos p
         LEFT JOIN centros_custo cc ON p.centro_custo_id = cc.id
         LEFT JOIN contas_contabeis cta ON p.conta_contabil_id = cta.id
         LEFT JOIN usuarios u ON p.criado_por = u.id
         WHERE p.ativo = true
         ORDER BY p.criado_em DESC`
      );

      res.render('processos/index', {
        title: 'Processos - DataFlow',
        user: req.user,
        processos: processos.rows
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

      if (!titulo || !String(titulo).trim()) {
        req.flash && req.flash('error', 'Título é obrigatório.');
        return res.redirect('/processos/novo');
      }

      const numeroProcesso = await ProcessoController.gerarNumeroProcesso();

      const result = await query(
        `INSERT INTO processos (
          titulo, descricao, descricao_detalhada, observacao, numero_processo,
          emergencial, fornecedor_id, data_vencimento, centro_custo_id, conta_contabil_id, fluxo_id,
          status, criado_por, criado_em
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pendente', $12, NOW())
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
          userId
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

      const processo = await query(
        `SELECT p.*,
         COALESCE(cta.nome, cc.nome) as centro_custo_nome,
         u.nome as criado_por_nome
         FROM processos p
         LEFT JOIN centros_custo cc ON p.centro_custo_id = cc.id
         LEFT JOIN contas_contabeis cta ON p.conta_contabil_id = cta.id
         LEFT JOIN usuarios u ON p.criado_por = u.id
         WHERE p.id = $1 AND p.ativo = true`,
        [id]
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

      res.render('processos/show', {
        title: `Processo #${id} - DataFlow`,
        user: req.user,
        processo: processo.rows[0],
        documentos: documentos.rows
      });
    } catch (error) {
      console.error('Erro ao buscar processo:', error);
      res.status(500).json({ success: false, message: 'Erro ao buscar processo' });
    }
  }

  // Aprovar processo
  static async aprovar(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const result = await query(
        `UPDATE processos 
         SET status = 'aprovado', aprovado_por = $1, aprovado_em = NOW()
         WHERE id = $2 AND ativo = true
         RETURNING *`,
        [userId, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Processo não encontrado' });
      }

      auditLog('PROCESSO_APROVADO', userId, { processoId: id, ip: req.ip });

      res.json({ success: true, message: 'Processo aprovado com sucesso' });
    } catch (error) {
      console.error('Erro ao aprovar processo:', error);
      res.status(500).json({ success: false, message: 'Erro ao aprovar processo' });
    }
  }

  // Rejeitar processo
  static async rejeitar(req, res) {
    try {
      const { id } = req.params;
      const { motivo } = req.body;
      const userId = req.user.id;

      const result = await query(
        `UPDATE processos 
         SET status = 'rejeitado', rejeitado_por = $1, rejeitado_em = NOW(), motivo_rejeicao = $2
         WHERE id = $3 AND ativo = true
         RETURNING *`,
        [userId, motivo, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Processo não encontrado' });
      }

      auditLog('PROCESSO_REJEITADO', userId, { processoId: id, motivo, ip: req.ip });

      res.json({ success: true, message: 'Processo rejeitado' });
    } catch (error) {
      console.error('Erro ao rejeitar processo:', error);
      res.status(500).json({ success: false, message: 'Erro ao rejeitar processo' });
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

      await query(
        'UPDATE processos SET ativo = false, atualizado_em = NOW() WHERE id = $1',
        [id]
      );

      auditLog('PROCESSO_DELETADO', userId, { processoId: id, ip: req.ip });

      res.json({ success: true, message: 'Processo deletado' });
    } catch (error) {
      console.error('Erro ao deletar processo:', error);
      res.status(500).json({ success: false, message: 'Erro ao deletar processo' });
    }
  }
}

module.exports = ProcessoController;
