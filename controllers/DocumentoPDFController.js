const { query } = require('../config/database');
const { gerarPDF, extrairVariaveis } = require('../utils/pdfGeneratorAdvanced');
const path = require('path');
const fs = require('fs');

class DocumentoPDFController {
  // Listar todos os templates
  static async index(req, res) {
    try {
      const templates = await query(
        `SELECT t.*, u.nome as criador_nome 
         FROM templates_pdf t
         LEFT JOIN usuarios u ON t.criado_por = u.id
         WHERE t.ativo = true 
         ORDER BY t.tipo_documento, t.nome`
      );

      res.render('documentos-pdf/index', {
        title: 'Templates de Documentos - DataFlow',
        user: req.user,
        templates: templates.rows
      });
    } catch (error) {
      console.error('Erro ao listar templates:', error);
      res.status(500).json({ success: false, message: 'Erro ao listar templates' });
    }
  }

  // Mostrar formulário de novo template
  static async novo(req, res) {
    try {
      res.render('documentos-pdf/form-ckeditor', {
        title: 'Novo Template - DataFlow',
        user: req.user,
        template: null,
        action: '/documentos-pdf/criar'
      });
    } catch (error) {
      console.error('Erro ao mostrar formulário:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar formulário',
        user: req.user
      });
    }
  }

  // Criar novo template
  static async criar(req, res) {
    try {
      const { nome, descricao, tipo_documento, conteudo_html, configuracoes } = req.body;

      // Extrair variáveis automaticamente do HTML
      const variaveis = extrairVariaveis(conteudo_html);

      // Parse das configurações se vier como string
      let config = configuracoes;
      if (typeof configuracoes === 'string') {
        config = JSON.parse(configuracoes);
      }

      const resultado = await query(
        `INSERT INTO templates_pdf 
         (nome, descricao, tipo_documento, conteudo_html, variaveis, configuracoes, criado_por, criado_em)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING id`,
        [nome, descricao, tipo_documento, conteudo_html, JSON.stringify(variaveis), JSON.stringify(config), req.user.id]
      );

      res.redirect('/documentos-pdf');
    } catch (error) {
      console.error('Erro ao criar template:', error);
      res.status(500).json({ success: false, message: 'Erro ao criar template' });
    }
  }

  // Mostrar formulário de edição
  static async editar(req, res) {
    try {
      const { id } = req.params;

      const resultado = await query(
        'SELECT * FROM templates_pdf WHERE id = $1 AND ativo = true',
        [id]
      );

      if (resultado.rows.length === 0) {
        return res.status(404).render('error', {
          title: 'Erro - DataFlow',
          message: 'Template não encontrado',
          user: req.user
        });
      }

      res.render('documentos-pdf/form-ckeditor', {
        title: 'Editar Template - DataFlow',
        user: req.user,
        template: resultado.rows[0],
        action: `/documentos-pdf/${id}/atualizar`
      });
    } catch (error) {
      console.error('Erro ao buscar template:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar template',
        user: req.user
      });
    }
  }

  // Atualizar template
  static async atualizar(req, res) {
    try {
      const { id } = req.params;
      const { nome, descricao, tipo_documento, conteudo_html, configuracoes } = req.body;

      // Extrair variáveis automaticamente do HTML
      const variaveis = extrairVariaveis(conteudo_html);

      // Parse das configurações se vier como string
      let config = configuracoes;
      if (typeof configuracoes === 'string') {
        config = JSON.parse(configuracoes);
      }

      await query(
        `UPDATE templates_pdf 
         SET nome = $1, descricao = $2, tipo_documento = $3, 
             conteudo_html = $4, variaveis = $5, configuracoes = $6, 
             atualizado_em = NOW()
         WHERE id = $7`,
        [nome, descricao, tipo_documento, conteudo_html, JSON.stringify(variaveis), JSON.stringify(config), id]
      );

      res.redirect('/documentos-pdf');
    } catch (error) {
      console.error('Erro ao atualizar template:', error);
      res.status(500).json({ success: false, message: 'Erro ao atualizar template' });
    }
  }

  // Excluir template (soft delete)
  static async excluir(req, res) {
    try {
      const { id } = req.params;

      await query(
        'UPDATE templates_pdf SET ativo = false, atualizado_em = NOW() WHERE id = $1',
        [id]
      );

      res.json({ success: true, message: 'Template excluído com sucesso' });
    } catch (error) {
      console.error('Erro ao excluir template:', error);
      res.status(500).json({ success: false, message: 'Erro ao excluir template' });
    }
  }

  // Mostrar formulário para preencher variáveis e gerar PDF
  static async gerarFormulario(req, res) {
    try {
      const { id } = req.params;

      const resultado = await query(
        'SELECT * FROM templates_pdf WHERE id = $1 AND ativo = true',
        [id]
      );

      if (resultado.rows.length === 0) {
        return res.status(404).render('error', {
          title: 'Erro - DataFlow',
          message: 'Template não encontrado',
          user: req.user
        });
      }

      const template = resultado.rows[0];

      res.render('documentos-pdf/gerar', {
        title: `Gerar ${template.nome} - DataFlow`,
        user: req.user,
        template: template
      });
    } catch (error) {
      console.error('Erro ao carregar formulário de geração:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar formulário',
        user: req.user
      });
    }
  }

  // Gerar PDF a partir do template e variáveis
  static async gerar(req, res) {
    try {
      const { id } = req.params;
      const variaveis = req.body;

      // Buscar template
      const templateResult = await query(
        'SELECT * FROM templates_pdf WHERE id = $1 AND ativo = true',
        [id]
      );

      if (templateResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Template não encontrado' });
      }

      const template = templateResult.rows[0];

      // Gerar nome do arquivo
      const timestamp = Date.now();
      const nomeArquivo = `${template.tipo_documento}_${timestamp}.pdf`;
      const uploadsDir = path.join(__dirname, '..', 'uploads', 'documentos-gerados');
      const outputPath = path.join(uploadsDir, nomeArquivo);

      // Criar diretório se não existir
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Gerar PDF
      const resultado = await gerarPDF({
        templateHTML: template.conteudo_html,
        variaveis: variaveis,
        outputPath: outputPath,
        configuracoes: template.configuracoes
      });

      // Salvar registro no banco
      await query(
        `INSERT INTO documentos_gerados 
         (template_id, nome_arquivo, titulo, dados_variaveis, caminho_arquivo, tamanho_bytes, gerado_por, unidade_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          template.id,
          nomeArquivo,
          variaveis.titulo || template.nome,
          JSON.stringify(variaveis),
          resultado.caminho,
          resultado.tamanho,
          req.user.id,
          req.user.unidade_id || null
        ]
      );

      res.json({
        success: true,
        message: 'PDF gerado com sucesso',
        arquivo: nomeArquivo,
        downloadUrl: `/documentos-pdf/download/${nomeArquivo}`
      });

    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erro ao gerar PDF',
        erro: error.message 
      });
    }
  }

  // Download do PDF gerado
  static async download(req, res) {
    try {
      const { nomeArquivo } = req.params;
      const filePath = path.join(__dirname, '..', 'uploads', 'documentos-gerados', nomeArquivo);

      if (!fs.existsSync(filePath)) {
        return res.status(404).render('error', {
          title: 'Erro - DataFlow',
          message: 'Arquivo não encontrado',
          user: req.user
        });
      }

      res.download(filePath);
    } catch (error) {
      console.error('Erro ao fazer download:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao fazer download',
        user: req.user
      });
    }
  }

  // Listar documentos gerados
  static async historico(req, res) {
    try {
      const documentos = await query(
        `SELECT d.*, t.nome as template_nome, u.nome as gerador_nome, un.nome as unidade_nome
         FROM documentos_gerados d
         LEFT JOIN templates_pdf t ON d.template_id = t.id
         LEFT JOIN usuarios u ON d.gerado_por = u.id
         LEFT JOIN unidades un ON d.unidade_id = un.id
         ORDER BY d.gerado_em DESC
         LIMIT 100`
      );

      res.render('documentos-pdf/historico', {
        title: 'Histórico de Documentos - DataFlow',
        user: req.user,
        documentos: documentos.rows
      });
    } catch (error) {
      console.error('Erro ao listar histórico:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar histórico',
        user: req.user
      });
    }
  }
}

module.exports = DocumentoPDFController;
