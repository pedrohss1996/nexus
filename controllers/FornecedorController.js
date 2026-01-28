const { query } = require('../config/database');
const { auditLog } = require('../utils/logger');

class FornecedorController {
  // Listar fornecedores
  static async index(req, res) {
    try {
      const fornecedores = await query(
        'SELECT * FROM fornecedores WHERE ativo = true ORDER BY nome'
      );

      res.render('fornecedores/index', {
        title: 'Fornecedores - DataFlow',
        user: req.user,
        fornecedores: fornecedores.rows
      });
    } catch (error) {
      console.error('Erro ao listar fornecedores:', error);
      res.status(500).json({ success: false, message: 'Erro ao listar fornecedores' });
    }
  }

  // Mostrar formulário de criação
  static create(req, res) {
    res.render('fornecedores/create', {
      title: 'Novo Fornecedor - DataFlow',
      user: req.user
    });
  }

  // Criar fornecedor
  static async store(req, res) {
    try {
      const { nome, cnpj, email, telefone, endereco } = req.body;

      const result = await query(
        `INSERT INTO fornecedores (nome, cnpj, email, telefone, endereco, criado_em)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING *`,
        [nome, cnpj, email, telefone, endereco]
      );

      auditLog('FORNECEDOR_CRIADO', req.user.id, { 
        fornecedorId: result.rows[0].id, 
        nome,
        ip: req.ip 
      });

      res.redirect('/fornecedores');
    } catch (error) {
      console.error('Erro ao criar fornecedor:', error);
      res.status(500).json({ success: false, message: 'Erro ao criar fornecedor' });
    }
  }

  // Mostrar fornecedor
  static async show(req, res) {
    try {
      const { id } = req.params;

      const fornecedor = await query(
        'SELECT * FROM fornecedores WHERE id = $1 AND ativo = true',
        [id]
      );

      if (fornecedor.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Fornecedor não encontrado' });
      }

      res.json({ success: true, fornecedor: fornecedor.rows[0] });
    } catch (error) {
      console.error('Erro ao buscar fornecedor:', error);
      res.status(500).json({ success: false, message: 'Erro ao buscar fornecedor' });
    }
  }

  // Editar fornecedor
  static async edit(req, res) {
    try {
      const { id } = req.params;

      const fornecedor = await query(
        'SELECT * FROM fornecedores WHERE id = $1 AND ativo = true',
        [id]
      );

      if (fornecedor.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Fornecedor não encontrado' });
      }

      res.render('fornecedores/edit', {
        title: 'Editar Fornecedor - DataFlow',
        user: req.user,
        fornecedor: fornecedor.rows[0]
      });
    } catch (error) {
      console.error('Erro ao carregar formulário:', error);
      res.status(500).json({ success: false, message: 'Erro ao carregar formulário' });
    }
  }

  // Atualizar fornecedor
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { nome, cnpj, email, telefone, endereco } = req.body;

      await query(
        `UPDATE fornecedores 
         SET nome = $1, cnpj = $2, email = $3, telefone = $4, endereco = $5, atualizado_em = NOW()
         WHERE id = $6 AND ativo = true`,
        [nome, cnpj, email, telefone, endereco, id]
      );

      auditLog('FORNECEDOR_ATUALIZADO', req.user.id, { fornecedorId: id, ip: req.ip });

      res.redirect('/fornecedores');
    } catch (error) {
      console.error('Erro ao atualizar fornecedor:', error);
      res.status(500).json({ success: false, message: 'Erro ao atualizar fornecedor' });
    }
  }

  // Deletar fornecedor (soft delete)
  static async destroy(req, res) {
    try {
      const { id } = req.params;

      await query(
        'UPDATE fornecedores SET ativo = false, atualizado_em = NOW() WHERE id = $1',
        [id]
      );

      auditLog('FORNECEDOR_DELETADO', req.user.id, { fornecedorId: id, ip: req.ip });

      res.json({ success: true, message: 'Fornecedor deletado' });
    } catch (error) {
      console.error('Erro ao deletar fornecedor:', error);
      res.status(500).json({ success: false, message: 'Erro ao deletar fornecedor' });
    }
  }
}

module.exports = FornecedorController;
