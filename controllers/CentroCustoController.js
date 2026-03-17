const { query } = require('../config/database');
const { auditLog } = require('../utils/logger');

class CentroCustoController {

  // GET /centros-custo
  static async listar(req, res) {
    try {
      const { unidade_id, busca } = req.query;

      let sql = `
        SELECT cc.*, u.nome as unidade_nome
        FROM centros_custo cc
        LEFT JOIN unidades u ON u.id = cc.unidade_id
        WHERE cc.ativo = true
      `;
      const params = [];
      let n = 1;

      if (unidade_id) { sql += ` AND cc.unidade_id = $${n++}`; params.push(unidade_id); }
      if (busca)      { sql += ` AND (cc.nome ILIKE $${n} OR cc.codigo ILIKE $${n})`; params.push('%'+busca+'%'); n++; }

      sql += ' ORDER BY u.nome NULLS LAST, cc.codigo ASC, cc.nome ASC';

      const [ccRes, unidadesRes] = await Promise.all([
        query(sql, params),
        query('SELECT id, nome FROM unidades WHERE ativo = true ORDER BY nome')
      ]);

      res.render('centros-custo/listar', {
        title: 'Centros de Custo - DataFlow',
        user: req.user,
        centros: ccRes.rows,
        unidades: unidadesRes.rows,
        filtros: { unidade_id, busca }
      });
    } catch (err) {
      console.error('Erro listar centros custo:', err);
      res.status(500).render('error', { title: 'Erro', message: err.message, user: req.user });
    }
  }

  // GET /centros-custo/novo
  static async formCriar(req, res) {
    try {
      const unidadesRes = await query('SELECT id, nome FROM unidades WHERE ativo = true ORDER BY nome');
      res.render('centros-custo/form', {
        title: 'Novo Centro de Custo - DataFlow',
        user: req.user,
        centro: null,
        unidades: unidadesRes.rows,
        erro: null
      });
    } catch (err) {
      res.status(500).render('error', { title: 'Erro', message: err.message, user: req.user });
    }
  }

  // POST /centros-custo
  static async criar(req, res) {
    try {
      const { nome, codigo, descricao, responsavel, tipo, unidade_id, valor_total } = req.body;

      if (!nome) {
        const unidadesRes = await query('SELECT id, nome FROM unidades WHERE ativo = true ORDER BY nome');
        return res.render('centros-custo/form', {
          title: 'Novo Centro de Custo - DataFlow', user: req.user,
          centro: req.body, unidades: unidadesRes.rows, erro: 'Nome é obrigatório'
        });
      }

      const result = await query(
        `INSERT INTO centros_custo
           (nome, codigo, descricao, responsavel, tipo, unidade_id, valor_total, criado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          nome.trim(),
          codigo ? codigo.trim() : null,
          descricao || null,
          responsavel || null,
          tipo || 'operacional',
          unidade_id || null,
          parseFloat(valor_total) || 0,
          req.user.id
        ]
      );

      try { auditLog('CENTRO_CUSTO_CRIADO', req.user.id, { id: result.rows[0].id, nome }); } catch (_) {}
      res.redirect('/centros-custo');
    } catch (err) {
      if (err.code === '23505') {
        const unidadesRes = await query('SELECT id, nome FROM unidades WHERE ativo = true ORDER BY nome');
        return res.render('centros-custo/form', {
          title: 'Novo Centro de Custo', user: req.user,
          centro: req.body, unidades: unidadesRes.rows, erro: 'Código já cadastrado'
        });
      }
      console.error('Erro criar centro custo:', err);
      res.status(500).render('error', { title: 'Erro', message: err.message, user: req.user });
    }
  }

  // GET /centros-custo/:id/editar
  static async formEditar(req, res) {
    try {
      const [ccRes, unidadesRes] = await Promise.all([
        query('SELECT * FROM centros_custo WHERE id = $1 AND ativo = true', [req.params.id]),
        query('SELECT id, nome FROM unidades WHERE ativo = true ORDER BY nome')
      ]);
      if (!ccRes.rows[0]) return res.status(404).render('error', { title: 'Erro', message: 'Não encontrado', user: req.user });
      res.render('centros-custo/form', {
        title: `Editar ${ccRes.rows[0].nome} - DataFlow`,
        user: req.user, centro: ccRes.rows[0], unidades: unidadesRes.rows, erro: null
      });
    } catch (err) {
      res.status(500).render('error', { title: 'Erro', message: err.message, user: req.user });
    }
  }

  // POST /centros-custo/:id
  static async atualizar(req, res) {
    try {
      const { id } = req.params;
      const { nome, codigo, descricao, responsavel, tipo, unidade_id, valor_total } = req.body;

      await query(
        `UPDATE centros_custo
         SET nome=$1, codigo=$2, descricao=$3, responsavel=$4, tipo=$5,
             unidade_id=$6, valor_total=$7, atualizado_em=NOW()
         WHERE id=$8 AND ativo=true`,
        [
          nome, codigo || null, descricao || null, responsavel || null,
          tipo || 'operacional', unidade_id || null,
          parseFloat(valor_total) || 0, id
        ]
      );

      try { auditLog('CENTRO_CUSTO_ATUALIZADO', req.user.id, { id, nome }); } catch (_) {}
      res.redirect('/centros-custo');
    } catch (err) {
      console.error('Erro atualizar centro custo:', err);
      res.status(500).render('error', { title: 'Erro', message: err.message, user: req.user });
    }
  }

  // DELETE/POST /centros-custo/:id/excluir
  static async excluir(req, res) {
    try {
      await query('UPDATE centros_custo SET ativo=false, atualizado_em=NOW() WHERE id=$1', [req.params.id]);
      try { auditLog('CENTRO_CUSTO_EXCLUIDO', req.user.id, { id: req.params.id }); } catch (_) {}
      const wants = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
      if (wants) return res.json({ success: true });
      res.redirect('/centros-custo');
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = CentroCustoController;
