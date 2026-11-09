const crypto = require('crypto');
const { query } = require('../config/database');
const { unidadeDaRequisicao, semUnidade } = require('../utils/unidadeScope');
const { sanitizarDocumento } = require('../utils/sanitizarHtml');
const { lerPaginacao, montarMeta, limitOffset } = require('../utils/paginacao');
const { gerarPDF, extrairVariaveis, extrairVariaveisAssinatura, substituirVariaveis } = require('../utils/pdfGeneratorAdvanced');
const path = require('path');
const fs = require('fs');
// Import lazy para evitar dependência circular
function getNotifController() {
  try { return require('./NotificacaoController'); } catch(_) { return null; }
}

// Remove wrapper visual do editor (tabela ou parágrafo) ao redor de {{ASSINATURA:X}},
// garantindo que o placeholder fique solto no HTML para substituição posterior.
function unwrapAssinaturaVars(html) {
  // 1. Remover <p> wrapper (novo estilo do editor)
  html = html.replace(
    /<p\b[^>]*>(?:<[^>]+>)*\s*(\{\{ASSINATURA:\d+\}\})\s*(?:<\/[^>]+>)*<\/p>/gi,
    '\n$1\n'
  );
  // 2. Remover <table> wrapper (estilos anteriores — lilás, cinza etc.)
  let prev;
  do {
    prev = html;
    html = html.replace(
      /<table\b[^>]*>(?:(?!<table\b)[\s\S])*?(\{\{ASSINATURA:\d+\}\})(?:(?!<table\b)[\s\S])*?<\/table>/gi,
      '\n$1\n'
    );
  } while (html !== prev);
  return html;
}

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
      const grupos = await query('SELECT id, nome FROM grupos WHERE ativo = true ORDER BY nome');
      res.render('documentos-pdf/form-ckeditor', {
        title: 'Novo Template - DataFlow',
        user: req.user,
        template: null,
        action: '/documentos-pdf/criar',
        grupos: grupos.rows
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
      const { nome, descricao, tipo_documento, configuracoes } = req.body;
      // Sanitiza na escrita: o HTML vem de editor WYSIWYG e era gravado cru,
      // virando XSS armazenado ao ser renderizado com <%- %> na listagem.
      const conteudo_html = sanitizarDocumento(req.body.conteudo_html);

      // Extrair variáveis automaticamente do HTML
      const variaveis = extrairVariaveis(conteudo_html);

      // Parse robusto das configurações
      let config = {};
      try {
        if (configuracoes && typeof configuracoes === 'string' && configuracoes.trim()) {
          config = JSON.parse(configuracoes);
        } else if (configuracoes && typeof configuracoes === 'object') {
          config = configuracoes;
        }
      } catch (_) { config = {}; }

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

      const [resultado, grupos] = await Promise.all([
        query('SELECT * FROM templates_pdf WHERE id = $1 AND ativo = true', [id]),
        query('SELECT id, nome FROM grupos WHERE ativo = true ORDER BY nome')
      ]);

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
        action: `/documentos-pdf/${id}/atualizar`,
        grupos: grupos.rows
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
      const { nome, descricao, tipo_documento, configuracoes } = req.body;
      // Sanitiza na escrita: o HTML vem de editor WYSIWYG e era gravado cru,
      // virando XSS armazenado ao ser renderizado com <%- %> na listagem.
      const conteudo_html = sanitizarDocumento(req.body.conteudo_html);

      // Extrair variáveis automaticamente do HTML
      const variaveis = extrairVariaveis(conteudo_html);

      // Parse robusto das configurações
      let config = {};
      try {
        if (configuracoes && typeof configuracoes === 'string' && configuracoes.trim()) {
          config = JSON.parse(configuracoes);
        } else if (configuracoes && typeof configuracoes === 'object') {
          config = configuracoes;
        }
      } catch (_) { config = {}; }

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

  // Excluir template (soft delete) — aceita POST (formulário) e DELETE (fetch); redireciona se for form
  static async excluir(req, res) {
    try {
      const { id } = req.params;

      await query(
        'UPDATE templates_pdf SET ativo = false, atualizado_em = NOW() WHERE id = $1',
        [id]
      );

      const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1);
      if (wantsJson) {
        return res.json({ success: true, message: 'Template excluído com sucesso' });
      }
      res.redirect('/documentos-pdf');
    } catch (error) {
      console.error('Erro ao excluir template:', error);
      const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1);
      if (wantsJson) {
        return res.status(500).json({ success: false, message: 'Erro ao excluir template' });
      }
      res.redirect('/documentos-pdf');
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

  // Gerar PDF e enviar diretamente para download
  static async gerar(req, res) {
    try {
      const { id } = req.params;
      const variaveis = req.body || {};

      // Buscar template
      const templateResult = await query(
        'SELECT * FROM templates_pdf WHERE id = $1 AND ativo = true',
        [id]
      );

      if (templateResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Template não encontrado' });
      }

      const template = templateResult.rows[0];

      // Detectar variáveis de assinatura no template
      const varAssinaturas = extrairVariaveisAssinatura(template.conteudo_html || '');
      const requerAssinatura = varAssinaturas.length > 0;

      // HTML com variáveis comuns substituídas — {{ASSINATURA:X}} PERMANECEM intactos
      // unwrapAssinaturaVars remove o wrapper visual (tabela do editor) ao redor dos placeholders
      const htmlParaSalvar = unwrapAssinaturaVars(substituirVariaveis(template.conteudo_html, variaveis));

      // Para o PDF de prévia, substituir {{ASSINATURA:X}} pelo bloco "Aguardando"
      let htmlPreview = htmlParaSalvar;
      if (requerAssinatura) {
        for (const va of varAssinaturas) {
          const blocoAguardando = `<table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border-top:2px solid #aaa;border-bottom:1px solid #aaa;margin:10px 0;font-family:Arial,Helvetica,sans-serif;font-size:8pt;color:#555;page-break-inside:avoid;"><tr><td style="padding:6px 0;"><p style="margin:0 0 2px;font-size:7pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#888;">Assinatura Eletrônica Pendente</p><p style="margin:0;color:#666;">Esta área será preenchida após a assinatura eletrônica.</p></td></tr></table>`;
          htmlPreview = htmlPreview.replace(
            new RegExp(`\\{\\{ASSINATURA:${va.grupo_id}\\}\\}`, 'g'),
            blocoAguardando
          );
        }
      }

      // Gerar nome para o arquivo de download
      const timestamp = Date.now();
      const nomeArquivo = `${(template.nome || 'documento').replace(/[^a-z0-9]/gi, '_')}_${timestamp}.pdf`;

      // Gerar token único de assinatura
      const tokenAssinatura = requerAssinatura
        ? crypto.randomBytes(24).toString('hex')
        : null;

      // Salvar no banco: htmlParaSalvar mantém {{ASSINATURA:X}} para substituição posterior
      let docId = null;
      try {
        const ins = await query(
          `INSERT INTO documentos_gerados
           (template_id, nome_arquivo, titulo, dados_variaveis, caminho_arquivo, tamanho_bytes,
            gerado_por, unidade_id, conteudo_html, token_assinatura, status_assinatura)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            template.id,
            nomeArquivo,
            variaveis.titulo || template.nome,
            JSON.stringify(variaveis),
            nomeArquivo,
            0,
            req.user.id,
            // req.user.unidade_id nunca é carregado pelo authMiddleware — usar a
            // unidade ativa da sessão, já validada em loadUnidades.
            unidadeDaRequisicao(req),
            htmlParaSalvar,     // variáveis preenchidas, {{ASSINATURA:X}} intactos para assinar depois
            tokenAssinatura,
            requerAssinatura ? 'pendente' : 'nao_requer'
          ]
        );
        docId = ins.rows[0].id;

        // Criar registros de assinatura pendentes com token individual por grupo
        if (requerAssinatura && docId) {
          for (const va of varAssinaturas) {
            const tokenIndividual = crypto.randomBytes(24).toString('hex');
            va._tokenIndividual = tokenIndividual; // guardar para o header de resposta
            await query(
              `INSERT INTO assinaturas_documentos
               (documento_gerado_id, template_id, grupo_id, placeholder_key, status, token_individual)
               VALUES ($1, $2, $3, $4, 'pendente', $5)`,
              [docId, template.id, va.grupo_id, `ASSINATURA:${va.grupo_id}`, tokenIndividual]
            );
          }
        }
      } catch (dbErr) {
        console.warn('Aviso: não foi possível registrar o documento gerado:', dbErr.message);
      }

      // Gerar PDF de prévia com o bloco "Aguardando assinatura"
      const resultado = await gerarPDF({
        templateHTML: htmlPreview,
        variaveis: {},
        retornarBuffer: true
      });

      // Atualizar tamanho no banco
      if (docId) {
        query('UPDATE documentos_gerados SET tamanho_bytes = $1 WHERE id = $2',
          [resultado.tamanho, docId]).catch(() => {});
      }

      // Buscar nomes dos grupos para montar os links individuais
      let assinaturasLinks = [];
      if (requerAssinatura && varAssinaturas.length > 0) {
        for (const va of varAssinaturas) {
          if (!va._tokenIndividual) continue;
          try {
            const g = await query('SELECT nome FROM grupos WHERE id = $1', [va.grupo_id]);
            const grupoNome = g.rows[0] ? g.rows[0].nome : `Grupo ${va.grupo_id}`;
            assinaturasLinks.push({
              grupo_id: va.grupo_id,
              grupo_nome: grupoNome,
              token_individual: va._tokenIndividual,
              link: `/assinaturas-doc/i/${va._tokenIndividual}`,
            });
          } catch (_) {}
        }
      }

      // Criar notificações automáticas para os grupos que precisam assinar
      if (requerAssinatura && varAssinaturas.length > 0) {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const NC = getNotifController();
        if (NC) {
          const grupoIds = varAssinaturas.map(va => va.grupo_id);
          NC.criarNotificacaoDocPendente(
            variaveis.titulo || template.nome,
            grupoIds,
            tokenAssinatura,
            baseUrl
          ).catch(() => {});
        }
      }

      // Enviar PDF com metadados de assinatura nos headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
      res.setHeader('Content-Length', resultado.buffer.length);
      if (requerAssinatura && tokenAssinatura) {
        res.setHeader('X-Assinatura-Token', tokenAssinatura);
        res.setHeader('X-Assinatura-Link', `/assinaturas-doc/assinar/${tokenAssinatura}`);
        if (assinaturasLinks.length > 0) {
          res.setHeader('X-Assinaturas-JSON', JSON.stringify(assinaturasLinks));
        }
      }
      res.send(resultado.buffer);

    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao gerar PDF: ' + error.message
      });
    }
  }

  // Download do PDF gerado
  static async download(req, res) {
    try {
      if (semUnidade(req, res)) return;
      const unidadeId = unidadeDaRequisicao(req);

      const naoEncontrado = () => res.status(404).render('error', {
        title: 'Erro - DataFlow',
        message: 'Arquivo não encontrado',
        user: req.user
      });

      // O parâmetro vinha direto para path.join: "..%2F..%2F.env" é decodificado
      // pelo Express e entregava o .env (JWT_SECRET, senha do banco). Agora:
      // 1) só aceita um nome simples, sem separadores;
      // 2) o arquivo precisa estar registrado em documentos_gerados na unidade
      //    do usuário (antes qualquer unidade baixava PDF de outra pelo nome);
      // 3) o caminho resolvido precisa continuar dentro do diretório base.
      const { nomeArquivo } = req.params;
      if (!nomeArquivo || nomeArquivo !== path.basename(nomeArquivo) || !/^[\w.-]+\.pdf$/i.test(nomeArquivo)) {
        return naoEncontrado();
      }

      const registro = await query(
        'SELECT 1 FROM documentos_gerados WHERE nome_arquivo = $1 AND unidade_id = $2 LIMIT 1',
        [nomeArquivo, unidadeId]
      );
      if (registro.rows.length === 0) return naoEncontrado();

      const baseDir = path.resolve(__dirname, '..', 'uploads', 'documentos-gerados');
      const filePath = path.resolve(baseDir, nomeArquivo);
      if (!filePath.startsWith(baseDir + path.sep) || !fs.existsSync(filePath)) {
        return naoEncontrado();
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
      if (semUnidade(req, res)) return;
      const unidadeId = unidadeDaRequisicao(req);

      const pag = lerPaginacao(req);
      const { sql: limite, valores: valoresLimite } = limitOffset(2, pag);

      // Não seleciona d.* de propósito: documentos_gerados guarda conteudo_html
      // inteiro, que o histórico não usa e pesaria megabytes por página.
      const documentos = await query(
        `SELECT d.id, d.titulo, d.nome_arquivo, d.gerado_em, d.status_assinatura,
                d.token_assinatura, d.template_id, d.gerado_por, d.unidade_id,
                t.nome as template_nome, u.nome as gerador_nome, un.nome as unidade_nome,
                COUNT(*) OVER() AS _total
         FROM documentos_gerados d
         LEFT JOIN templates_pdf t ON d.template_id = t.id
         LEFT JOIN usuarios u ON d.gerado_por = u.id
         LEFT JOIN unidades un ON d.unidade_id = un.id
         WHERE d.unidade_id = $1
         ORDER BY d.gerado_em DESC` + limite,
        [unidadeId, ...valoresLimite]
      );

      const { itens, meta } = montarMeta(pag, documentos.rows, '/documentos-pdf/historico', req.query);

      res.render('documentos-pdf/historico', {
        title: 'Histórico de Documentos - DataFlow',
        user: req.user,
        documentos: itens,
        meta
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
