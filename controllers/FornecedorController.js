const { query } = require('../config/database');
const { auditLog } = require('../utils/logger');
const path = require('path');
const fs = require('fs');

// Campos de fornecedor (insert/update)
const CAMPOS = [
  'cnpj', 'razao_social', 'nome_fantasia', 'nome', 'inscricao_estadual', 'inscricao_municipal',
  'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'cep', 'latitude', 'longitude',
  'email', 'email_vendas', 'email_financeiro', 'telefone', 'endereco',
  'banco', 'agencia', 'conta', 'condicao_pagamento_padrao', 'conta_contabil_id'
];

function parseBody(body) {
  const o = {};
  CAMPOS.forEach(campo => {
    const v = body[campo];
    if (v === '' || v === undefined) o[campo] = null;
    else if (campo === 'conta_contabil_id' || campo === 'latitude' || campo === 'longitude') o[campo] = v ? Number(v) : null;
    else o[campo] = String(v).trim();
  });
  return o;
}

class FornecedorController {
  // Listar fornecedores (ordenar por nome fantasia/razão)
  static async index(req, res) {
    try {
      const result = await query(`
        SELECT id, cnpj, razao_social, nome_fantasia, nome, cidade, uf, email, telefone, ativo
        FROM fornecedores
        WHERE ativo = true
        ORDER BY COALESCE(nome_fantasia, razao_social, nome) ASC
      `);
      res.render('fornecedores/index', {
        title: 'Fornecedores - DataFlow',
        user: req.user,
        fornecedores: result.rows
      });
    } catch (error) {
      console.error('Erro ao listar fornecedores:', error);
      res.status(500).render('error', { title: 'Erro', message: 'Erro ao listar fornecedores' });
    }
  }

  // Formulário novo fornecedor
  static async create(req, res) {
    try {
      let contasContabeis = [];
      const unidadeId = req.session && req.session.unidadeSelecionada;
      if (unidadeId) {
        try {
          const PlanoContas = require('../models/PlanoContas');
          const flat = await PlanoContas.buscarContasFlat(unidadeId);
          contasContabeis = flat || [];
        } catch (_) {}
      }
      res.render('fornecedores/form', {
        title: 'Novo Fornecedor - DataFlow',
        user: req.user,
        fornecedor: null,
        contasContabeis
      });
    } catch (error) {
      console.error('Erro ao abrir formulário:', error);
      res.status(500).render('error', { title: 'Erro', message: 'Erro ao abrir formulário' });
    }
  }

  // Criar fornecedor
  static async store(req, res) {
    try {
      const dados = parseBody(req.body);
      dados.nome = dados.nome || dados.nome_fantasia || dados.razao_social || 'Fornecedor';
      if (!dados.cnpj) {
        req.flash && req.flash('error', 'CNPJ é obrigatório.');
        return res.redirect('/fornecedores/novo');
      }
      const sql = `
        INSERT INTO fornecedores (
          cnpj, razao_social, nome_fantasia, nome, inscricao_estadual, inscricao_municipal,
          logradouro, numero, complemento, bairro, cidade, uf, cep, latitude, longitude,
          email, email_vendas, email_financeiro, telefone, endereco,
          banco, agencia, conta, condicao_pagamento_padrao, conta_contabil_id, criado_em
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,NOW()
        ) RETURNING *
      `;
      const params = CAMPOS.map(c => dados[c] ?? null);
      const result = await query(sql, params);
      const row = result.rows[0];
      auditLog('FORNECEDOR_CRIADO', req.user.id, { fornecedorId: row.id, cnpj: row.cnpj, ip: req.ip });
      req.flash && req.flash('success', 'Fornecedor cadastrado com sucesso.');
      res.redirect('/fornecedores/' + row.id);
    } catch (error) {
      if (error.code === '23505') {
        req.flash && req.flash('error', 'CNPJ já cadastrado.');
        return res.redirect('/fornecedores/novo');
      }
      console.error('Erro ao criar fornecedor:', error);
      res.status(500).render('error', { title: 'Erro', message: error.message || 'Erro ao criar fornecedor' });
    }
  }

  // Detalhes do fornecedor (com anexos)
  static async show(req, res) {
    try {
      const { id } = req.params;
      const fornecedor = await query('SELECT * FROM fornecedores WHERE id = $1 AND ativo = true', [id]);
      if (fornecedor.rows.length === 0) {
        req.flash && req.flash('error', 'Fornecedor não encontrado.');
        return res.redirect('/fornecedores');
      }
      const anexos = await query(
        'SELECT * FROM fornecedor_anexos WHERE fornecedor_id = $1 ORDER BY criado_em DESC',
        [id]
      );
      res.render('fornecedores/detalhes', {
        title: 'Fornecedor - DataFlow',
        user: req.user,
        fornecedor: fornecedor.rows[0],
        anexos: anexos.rows
      });
    } catch (error) {
      console.error('Erro ao buscar fornecedor:', error);
      res.status(500).render('error', { title: 'Erro', message: 'Erro ao buscar fornecedor' });
    }
  }

  // Formulário edição
  static async edit(req, res) {
    try {
      const { id } = req.params;
      const fornecedor = await query('SELECT * FROM fornecedores WHERE id = $1 AND ativo = true', [id]);
      if (fornecedor.rows.length === 0) {
        req.flash && req.flash('error', 'Fornecedor não encontrado.');
        return res.redirect('/fornecedores');
      }
      let contasContabeis = [];
      const unidadeId = req.session && req.session.unidadeSelecionada;
      if (unidadeId) {
        try {
          const PlanoContas = require('../models/PlanoContas');
          const flat = await PlanoContas.buscarContasFlat(unidadeId);
          contasContabeis = flat || [];
        } catch (_) {}
      }
      res.render('fornecedores/form', {
        title: 'Editar Fornecedor - DataFlow',
        user: req.user,
        fornecedor: fornecedor.rows[0],
        contasContabeis
      });
    } catch (error) {
      console.error('Erro ao abrir formulário:', error);
      res.status(500).render('error', { title: 'Erro', message: 'Erro ao abrir formulário' });
    }
  }

  // Atualizar fornecedor
  static async update(req, res) {
    try {
      const { id } = req.params;
      const dados = parseBody(req.body);
      dados.nome = dados.nome || dados.nome_fantasia || dados.razao_social || 'Fornecedor';
      if (!dados.cnpj) {
        req.flash && req.flash('error', 'CNPJ é obrigatório.');
        return res.redirect('/fornecedores/' + id + '/editar');
      }
      const sql = `
        UPDATE fornecedores SET
          cnpj=$1, razao_social=$2, nome_fantasia=$3, nome=$4, inscricao_estadual=$5, inscricao_municipal=$6,
          logradouro=$7, numero=$8, complemento=$9, bairro=$10, cidade=$11, uf=$12, cep=$13, latitude=$14, longitude=$15,
          email=$16, email_vendas=$17, email_financeiro=$18, telefone=$19, endereco=$20,
          banco=$21, agencia=$22, conta=$23, condicao_pagamento_padrao=$24, conta_contabil_id=$25, atualizado_em=NOW()
        WHERE id = $26 AND ativo = true
      `;
      const params = [...CAMPOS.map(c => dados[c] ?? null), id];
      await query(sql, params);
      auditLog('FORNECEDOR_ATUALIZADO', req.user.id, { fornecedorId: id, ip: req.ip });
      req.flash && req.flash('success', 'Fornecedor atualizado com sucesso.');
      res.redirect('/fornecedores/' + id);
    } catch (error) {
      if (error.code === '23505') {
        req.flash && req.flash('error', 'CNPJ já cadastrado.');
        return res.redirect('/fornecedores/' + req.params.id + '/editar');
      }
      console.error('Erro ao atualizar fornecedor:', error);
      res.status(500).render('error', { title: 'Erro', message: error.message || 'Erro ao atualizar fornecedor' });
    }
  }

  // Deletar fornecedor (soft delete)
  static async destroy(req, res) {
    try {
      const { id } = req.params;
      await query('UPDATE fornecedores SET ativo = false, atualizado_em = NOW() WHERE id = $1', [id]);
      auditLog('FORNECEDOR_DELETADO', req.user.id, { fornecedorId: id, ip: req.ip });
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.json({ success: true, message: 'Fornecedor excluído' });
      }
      req.flash && req.flash('success', 'Fornecedor excluído.');
      res.redirect('/fornecedores');
    } catch (error) {
      console.error('Erro ao deletar fornecedor:', error);
      res.status(500).json({ success: false, message: 'Erro ao excluir fornecedor' });
    }
  }

  // Upload de anexo
  static async uploadAnexo(req, res) {
    try {
      const { id } = req.params;
      if (!req.file) {
        req.flash && req.flash('error', 'Nenhum arquivo enviado.');
        return res.redirect('/fornecedores/' + id);
      }
      const fornecedor = await query('SELECT id FROM fornecedores WHERE id = $1 AND ativo = true', [id]);
      if (fornecedor.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Fornecedor não encontrado' });
      }
      const nomeArquivo = req.file.filename;
      const caminho = ['uploads', 'fornecedores', id, nomeArquivo].join('/');
      await query(
        `INSERT INTO fornecedor_anexos (fornecedor_id, nome_original, nome_arquivo, caminho, tipo, tamanho, criado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, req.file.originalname || nomeArquivo, nomeArquivo, caminho, req.file.mimetype || null, req.file.size || null, req.user.id]
      );
      req.flash && req.flash('success', 'Arquivo anexado.');
      res.redirect('/fornecedores/' + id);
    } catch (error) {
      console.error('Erro ao anexar arquivo:', error);
      req.flash && req.flash('error', 'Erro ao anexar arquivo.');
      res.redirect('/fornecedores/' + req.params.id);
    }
  }

  // Excluir anexo
  static async destroyAnexo(req, res) {
    try {
      const { id, anexoId } = req.params;
      const anexo = await query('SELECT * FROM fornecedor_anexos WHERE id = $1 AND fornecedor_id = $2', [anexoId, id]);
      if (anexo.rows.length === 0) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(404).json({ success: false, message: 'Anexo não encontrado' });
        }
        req.flash && req.flash('error', 'Anexo não encontrado.');
        return res.redirect('/fornecedores/' + id);
      }
      const caminhoFisico = path.join(__dirname, '..', 'public', anexo.rows[0].caminho);
      if (fs.existsSync(caminhoFisico)) fs.unlinkSync(caminhoFisico);
      await query('DELETE FROM fornecedor_anexos WHERE id = $1 AND fornecedor_id = $2', [anexoId, id]);
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.json({ success: true });
      }
      req.flash && req.flash('success', 'Anexo excluído.');
      res.redirect('/fornecedores/' + id);
    } catch (error) {
      console.error('Erro ao excluir anexo:', error);
      res.status(500).json({ success: false, message: 'Erro ao excluir anexo' });
    }
  }
}

module.exports = FornecedorController;
