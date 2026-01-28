const { query } = require('../config/database');
const { auditLog } = require('../utils/logger');

class DocumentoController {
  // Listar documentos
  static async index(req, res) {
    try {
      const documentos = await query(
        `SELECT d.*, p.titulo as processo_titulo
         FROM documentos d
         LEFT JOIN processos p ON d.processo_id = p.id
         WHERE d.ativo = true
         ORDER BY d.criado_em DESC`
      );

      res.render('documentos/index', {
        title: 'Documentos - DataFlow',
        user: req.user,
        documentos: documentos.rows
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

      const documento = await query(
        `SELECT d.*, p.titulo as processo_titulo
         FROM documentos d
         LEFT JOIN processos p ON d.processo_id = p.id
         WHERE d.id = $1 AND d.ativo = true`,
        [id]
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

      await query(
        `UPDATE documentos 
         SET status = $1, observacoes = $2, atualizado_em = NOW()
         WHERE id = $3 AND ativo = true`,
        [status, observacoes, id]
      );

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

      await query(
        `UPDATE documentos 
         SET status = 'arquivado', atualizado_em = NOW()
         WHERE id = $1 AND ativo = true`,
        [id]
      );

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

      await query(
        'UPDATE documentos SET ativo = false, atualizado_em = NOW() WHERE id = $1',
        [id]
      );

      auditLog('DOCUMENTO_DELETADO', req.user.id, { documentoId: id, ip: req.ip });

      res.json({ success: true, message: 'Documento deletado' });
    } catch (error) {
      console.error('Erro ao deletar documento:', error);
      res.status(500).json({ success: false, message: 'Erro ao deletar documento' });
    }
  }
}

module.exports = DocumentoController;
