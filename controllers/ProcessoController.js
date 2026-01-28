const { query } = require('../config/database');
const { auditLog } = require('../utils/logger');

class ProcessoController {
  // Listar processos
  static async index(req, res) {
    try {
      const processos = await query(
        `SELECT p.*, cc.nome as centro_custo_nome, u.nome as criado_por_nome
         FROM processos p
         LEFT JOIN centros_custo cc ON p.centro_custo_id = cc.id
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
      const centrosCusto = await query(
        'SELECT id, nome FROM centros_custo WHERE ativo = true ORDER BY nome'
      );

      res.render('processos/create', {
        title: 'Novo Processo - DataFlow',
        user: req.user,
        centrosCusto: centrosCusto.rows
      });
    } catch (error) {
      console.error('Erro ao carregar formulário:', error);
      res.status(500).json({ success: false, message: 'Erro ao carregar formulário' });
    }
  }

  // Criar processo
  static async store(req, res) {
    try {
      const { titulo, descricao, centro_custo_id, valor } = req.body;
      const userId = req.user.id;

      const result = await query(
        `INSERT INTO processos (titulo, descricao, centro_custo_id, valor, status, criado_por, criado_em)
         VALUES ($1, $2, $3, $4, 'pendente', $5, NOW())
         RETURNING *`,
        [titulo, descricao, centro_custo_id || null, valor || null, userId]
      );

      auditLog('PROCESSO_CRIADO', userId, { 
        processoId: result.rows[0].id, 
        titulo,
        ip: req.ip 
      });

      res.redirect('/processos');
    } catch (error) {
      console.error('Erro ao criar processo:', error);
      res.status(500).json({ success: false, message: 'Erro ao criar processo' });
    }
  }

  // Mostrar processo
  static async show(req, res) {
    try {
      const { id } = req.params;

      const processo = await query(
        `SELECT p.*, cc.nome as centro_custo_nome, u.nome as criado_por_nome
         FROM processos p
         LEFT JOIN centros_custo cc ON p.centro_custo_id = cc.id
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
