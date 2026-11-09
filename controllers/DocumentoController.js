const { query } = require('../config/database');
const { auditLog } = require('../utils/logger');
const { unidadeDaRequisicao, semUnidade } = require('../utils/unidadeScope');
const { lerPaginacao, montarMeta, limitOffset } = require('../utils/paginacao');

class DocumentoController {
  // Listar documentos
  static async index(req, res) {
    try {
      if (semUnidade(req, res)) return;
      const unidadeId = unidadeDaRequisicao(req);

      const pag = lerPaginacao(req);
      const { sql: limite, valores: valoresLimite } = limitOffset(2, pag);

      const documentos = await query(
        `SELECT d.*, p.titulo as processo_titulo,
         COUNT(*) OVER() AS _total
         FROM documentos d
         LEFT JOIN processos p ON d.processo_id = p.id
         WHERE d.ativo = true AND d.unidade_id = $1
         ORDER BY d.criado_em DESC` + limite,
        [unidadeId, ...valoresLimite]
      );

      const { itens, meta } = montarMeta(pag, documentos.rows, '/documentos', req.query);

      res.render('documentos/index', {
        title: 'Documentos - DataFlow',
        user: req.user,
        documentos: itens,
        meta
      });
    } catch (error) {
      console.error('Erro ao listar documentos:', error);
      res.status(500).json({ success: false, message: 'Erro ao listar documentos' });
    }
  }

  // Upload de documento
  static async upload(req, res) {
    try {
      // Implementar upload com multer
      res.json({ success: true, message: 'Upload em desenvolvimento' });
    } catch (error) {
      console.error('Erro no upload:', error);
      res.status(500).json({ success: false, message: 'Erro no upload' });
    }
  }

  // Mostrar documento
  static async show(req, res) {
    try {
      const { id } = req.params;

      if (semUnidade(req, res, { json: true })) return;
      const unidadeId = unidadeDaRequisicao(req);

      // O filtro por unidade fecha o IDOR: id de outra unidade devolve 404
      const documento = await query(
        `SELECT d.*, p.titulo as processo_titulo
         FROM documentos d
         LEFT JOIN processos p ON d.processo_id = p.id
         WHERE d.id = $1 AND d.ativo = true AND d.unidade_id = $2`,
        [id, unidadeId]
      );

      if (documento.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Documento não encontrado' });
      }

      res.json({ success: true, documento: documento.rows[0] });
    } catch (error) {
      console.error('Erro ao buscar documento:', error);
      res.status(500).json({ success: false, message: 'Erro ao buscar documento' });
    }
  }

  // Atualizar documento
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { status, observacoes } = req.body;

      if (semUnidade(req, res, { json: true })) return;
      const unidadeId = unidadeDaRequisicao(req);

      const result = await query(
        `UPDATE documentos
         SET status = $1, observacoes = $2, atualizado_em = NOW()
         WHERE id = $3 AND ativo = true AND unidade_id = $4
         RETURNING id`,
        [status, observacoes, id, unidadeId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Documento não encontrado' });
      }

      auditLog('DOCUMENTO_ATUALIZADO', req.user.id, { documentoId: id, status, ip: req.ip });

      res.json({ success: true, message: 'Documento atualizado' });
    } catch (error) {
      console.error('Erro ao atualizar documento:', error);
      res.status(500).json({ success: false, message: 'Erro ao atualizar documento' });
    }
  }

  // Arquivar documento
  static async arquivar(req, res) {
    try {
      const { id } = req.params;

      if (semUnidade(req, res, { json: true })) return;
      const unidadeId = unidadeDaRequisicao(req);

      const result = await query(
        `UPDATE documentos
         SET status = 'arquivado', atualizado_em = NOW()
         WHERE id = $1 AND ativo = true AND unidade_id = $2
         RETURNING id`,
        [id, unidadeId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Documento não encontrado' });
      }

      auditLog('DOCUMENTO_ARQUIVADO', req.user.id, { documentoId: id, ip: req.ip });

      res.json({ success: true, message: 'Documento arquivado' });
    } catch (error) {
      console.error('Erro ao arquivar documento:', error);
      res.status(500).json({ success: false, message: 'Erro ao arquivar documento' });
    }
  }

  // Deletar documento (soft delete)
  static async destroy(req, res) {
    try {
      const { id } = req.params;

      if (semUnidade(req, res, { json: true })) return;
      const unidadeId = unidadeDaRequisicao(req);

      const result = await query(
        `UPDATE documentos SET ativo = false, atualizado_em = NOW()
         WHERE id = $1 AND unidade_id = $2
         RETURNING id`,
        [id, unidadeId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Documento não encontrado' });
      }

      auditLog('DOCUMENTO_DELETADO', req.user.id, { documentoId: id, ip: req.ip });

      res.json({ success: true, message: 'Documento deletado' });
    } catch (error) {
      console.error('Erro ao deletar documento:', error);
      res.status(500).json({ success: false, message: 'Erro ao deletar documento' });
    }
  }
}

module.exports = DocumentoController;
