const crypto = require('crypto');
const { query } = require('../config/database');
const { gerarPDF, substituirVariaveis } = require('../utils/pdfGeneratorAdvanced');

// Remove qualquer wrapper visual do editor (tabela ou parágrafo) ao redor de {{ASSINATURA:X}},
// deixando somente a variável pura para substituição posterior.
function unwrapAssinaturaVars(html) {
  // 1. Remover <p> wrapper (novo estilo do editor)
  html = html.replace(
    /<p\b[^>]*>(?:<[^>]+>)*\s*(\{\{ASSINATURA:\d+\}\})\s*(?:<\/[^>]+>)*<\/p>/gi,
    '\n$1\n'
  );
  // 2. Remover <table> wrapper (estilos anteriores — lilás, cinza etc.)
  // Usa tempered greedy para casar a tabela mais interna primeiro (iterativo)
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

// Gera hash curto único (16 hex chars) para identificação da assinatura
function gerarHashAssinatura(dados) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(dados) + Date.now() + Math.random())
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();
}

// Gera hash SHA-256 do conteúdo do documento (integridade)
function hashConteudo(html) {
  return crypto.createHash('sha256').update(html || '').digest('hex');
}

class AssinaturaDocController {

  // GET /documentos-pdf/assinar/:token
  // Página para assinar um documento (usuário logado, membro do grupo)
  static async paginaAssinar(req, res) {
    try {
      const { token } = req.params;

      const docResult = await query(
        `SELECT d.*, t.nome as template_nome
         FROM documentos_gerados d
         LEFT JOIN templates_pdf t ON d.template_id = t.id
         WHERE d.token_assinatura = $1`,
        [token]
      );

      if (docResult.rows.length === 0) {
        return res.status(404).render('error', {
          title: 'Não encontrado', message: 'Documento não encontrado.', user: req.user
        });
      }

      const doc = docResult.rows[0];

      // Buscar assinaturas pendentes deste documento
      const assinPendentes = await query(
        `SELECT a.*, g.nome as grupo_nome
         FROM assinaturas_documentos a
         LEFT JOIN grupos g ON a.grupo_id = g.id
         WHERE a.documento_gerado_id = $1
         ORDER BY a.id ASC`,
        [doc.id]
      );

      // Verificar se o usuário atual pode assinar alguma pendência
      const pendentesParaUsuario = [];
      for (const assin of assinPendentes.rows.filter(a => a.status === 'pendente')) {
        const pertence = await query(
          `SELECT 1 FROM usuarios_grupos WHERE grupo_id = $1 AND usuario_id = $2`,
          [assin.grupo_id, req.user.id]
        );
        if (pertence.rows.length > 0) {
          pendentesParaUsuario.push(assin);
        }
      }

      res.render('assinatura/assinar', {
        title: `Assinar: ${doc.titulo || doc.template_nome}`,
        user: req.user,
        doc,
        todasAssinaturas: assinPendentes.rows,
        pendentesParaUsuario,
        baseUrl: `${req.protocol}://${req.get('host')}`
      });
    } catch (err) {
      console.error('Erro paginaAssinar:', err);
      res.status(500).render('error', { title: 'Erro', message: err.message, user: req.user });
    }
  }

  // POST /documentos-pdf/assinar/:token
  // Efetiva a assinatura
  static async assinar(req, res) {
    try {
      const { token } = req.params;
      const { assinatura_id } = req.body;

      const docResult = await query(
        `SELECT * FROM documentos_gerados WHERE token_assinatura = $1`,
        [token]
      );
      if (docResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Documento não encontrado.' });
      }
      const doc = docResult.rows[0];

      // Verificar que a assinatura pertence ao documento e está pendente
      const assinResult = await query(
        `SELECT a.*, g.nome as grupo_nome
         FROM assinaturas_documentos a
         LEFT JOIN grupos g ON a.grupo_id = g.id
         WHERE a.id = $1 AND a.documento_gerado_id = $2 AND a.status = 'pendente'`,
        [assinatura_id, doc.id]
      );
      if (assinResult.rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Assinatura não encontrada ou já realizada.' });
      }
      const assin = assinResult.rows[0];

      // Verificar que usuário pertence ao grupo
      const pertence = await query(
        `SELECT 1 FROM usuarios_grupos WHERE grupo_id = $1 AND usuario_id = $2`,
        [assin.grupo_id, req.user.id]
      );
      if (pertence.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Você não pertence ao grupo responsável por esta assinatura.' });
      }

      // Buscar dados completos do usuário (CPF, cargo, etc.)
      const usuResult = await query(
        `SELECT u.nome, u.cpf, u.email, u.cargo, u.matricula,
                ug.is_lider,
                g.nome as grupo_nome
         FROM usuarios u
         LEFT JOIN usuarios_grupos ug ON ug.usuario_id = u.id AND ug.grupo_id = $2
         LEFT JOIN grupos g ON g.id = ug.grupo_id
         WHERE u.id = $1`,
        [req.user.id, assin.grupo_id]
      );
      const usu = usuResult.rows[0] || {};

      // IP do cliente — priorizar x-forwarded-for (produção atrás de proxy)
      const ip = await _resolverIP(req);

      // Cargo: preferir do cadastro, fallback para "membro do grupo"
      const cargoAssinante = usu.cargo
        ? usu.cargo + (usu.is_lider ? ' (Líder de ' + (usu.grupo_nome || '') + ')' : '')
        : (usu.is_lider ? 'Líder de ' + (usu.grupo_nome || '') : 'Membro de ' + (usu.grupo_nome || ''));

      // CPF formatado
      const cpfFormatado = usu.cpf
        ? usu.cpf.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
        : null;

      // Hash de integridade do documento
      const hDoc = hashConteudo(doc.conteudo_html || '');

      // Hash único da assinatura
      const hAssin = gerarHashAssinatura({
        docId: doc.id, userId: req.user.id, assinId: assin.id, hDoc, ip
      });

      // Gravar assinatura
      await query(
        `UPDATE assinaturas_documentos SET
           usuario_id      = $1,
           nome_assinante  = $2,
           cpf_assinante   = $3,
           cargo_assinante = $4,
           ip_assinante    = $5,
           data_hora       = NOW(),
           hash_documento  = $6,
           hash_assinatura = $7,
           status          = 'assinado'
         WHERE id = $8`,
        [
          req.user.id,
          usu.nome || req.user.nome,
          cpfFormatado,
          cargoAssinante,
          ip,
          hDoc,
          hAssin,
          assin.id
        ]
      );

      // Verificar se todas as assinaturas foram concluídas
      const pendentes = await query(
        `SELECT COUNT(*) FROM assinaturas_documentos WHERE documento_gerado_id = $1 AND status = 'pendente'`,
        [doc.id]
      );
      const totalPendente = parseInt(pendentes.rows[0].count, 10);

      if (totalPendente === 0) {
        await query(
          `UPDATE documentos_gerados SET status_assinatura = 'assinado' WHERE id = $1`,
          [doc.id]
        );
      }

      return res.json({
        success: true,
        message: 'Documento assinado com sucesso!',
        hash_assinatura: hAssin,
        link_verificacao: `${req.protocol}://${req.get('host')}/verificar/${hAssin}`,
        total_pendente: totalPendente
      });
    } catch (err) {
      console.error('Erro assinar:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // GET /verificar/:hash  (público — sem autenticação)
  static async verificar(req, res) {
    try {
      const { hash } = req.params;

      const result = await query(
        `SELECT a.*,
                u.nome  as usuario_nome, u.email as usuario_email,
                g.nome  as grupo_nome,
                d.titulo as doc_titulo,
                d.nome_arquivo,
                d.token_assinatura,
                t.nome  as template_nome
         FROM assinaturas_documentos a
         LEFT JOIN usuarios            u ON u.id = a.usuario_id
         LEFT JOIN grupos              g ON g.id = a.grupo_id
         LEFT JOIN documentos_gerados  d ON d.id = a.documento_gerado_id
         LEFT JOIN templates_pdf       t ON t.id = a.template_id
         WHERE a.hash_assinatura = $1`,
        [hash.toUpperCase()]
      );

      const assinatura = result.rows[0] || null;
      const valido = !!(assinatura && assinatura.status === 'assinado');

      res.render('assinatura/verificar', {
        title: 'Verificar Assinatura - DataFlow',
        user: null,
        assinatura,
        valido,
        hash,
        baseUrl: `${req.protocol}://${req.get('host')}`
      });
    } catch (err) {
      console.error('Erro verificar:', err);
      res.status(500).render('error', { title: 'Erro', message: err.message, user: null });
    }
  }

  // GET /documentos-pdf/pendentes-assinatura (privado)
  static async pendentes(req, res) {
    try {
      // Buscar todos os grupos do usuário
      const gruposResult = await query(
        `SELECT grupo_id FROM usuarios_grupos WHERE usuario_id = $1`,
        [req.user.id]
      );
      const grupoIds = gruposResult.rows.map(r => r.grupo_id);

      let documentos = [];
      if (grupoIds.length > 0) {
        const result = await query(
          `SELECT DISTINCT d.id, d.titulo, d.nome_arquivo, d.token_assinatura, d.gerado_em,
                  t.nome as template_nome,
                  COUNT(a.id) FILTER (WHERE a.status='pendente') as total_pendentes,
                  COUNT(a.id) FILTER (WHERE a.status='assinado') as total_assinados
           FROM assinaturas_documentos a
           JOIN documentos_gerados d ON d.id = a.documento_gerado_id
           LEFT JOIN templates_pdf t ON t.id = d.template_id
           WHERE a.grupo_id = ANY($1) AND a.status = 'pendente'
             AND a.documento_gerado_id NOT IN (
               SELECT documento_gerado_id FROM assinaturas_documentos
               WHERE usuario_id = $2 AND status = 'assinado'
             )
           GROUP BY d.id, t.nome
           ORDER BY d.gerado_em DESC`,
          [grupoIds, req.user.id]
        );
        documentos = result.rows;
      }

      res.render('assinatura/pendentes', {
        title: 'Documentos Pendentes de Assinatura',
        user: req.user,
        documentos
      });
    } catch (err) {
      console.error('Erro pendentes:', err);
      res.status(500).render('error', { title: 'Erro', message: err.message, user: req.user });
    }
  }

  // GET /documentos-pdf/:id/gerar-pdf-assinado/:token  (re-gera PDF com assinaturas)
  static async gerarPDFAssinado(req, res) {
    try {
      const { token } = req.params;

      const docResult = await query(
        `SELECT d.*, t.conteudo_html as template_html
         FROM documentos_gerados d
         LEFT JOIN templates_pdf t ON t.id = d.template_id
         WHERE d.token_assinatura = $1`,
        [token]
      );
      if (docResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Documento não encontrado.' });
      }
      const doc = docResult.rows[0];

      // Buscar todas as assinaturas (assinadas) deste documento
      const assinResult = await query(
        `SELECT a.*, g.nome as grupo_nome
         FROM assinaturas_documentos a
         LEFT JOIN grupos g ON g.id = a.grupo_id
         WHERE a.documento_gerado_id = $1
         ORDER BY a.id ASC`,
        [doc.id]
      );

      // Substituir placeholders no HTML salvo
      // conteudo_html já tem variáveis preenchidas e {{ASSINATURA:X}} intactos
      let html = doc.conteudo_html || doc.template_html || '';

      // Remove wrappers visuais (tabela lilás/cinza do editor) ao redor dos placeholders
      html = unwrapAssinaturaVars(html);

      // Fallback: se ainda houver {{VAR}} no HTML (docs gerados antes da correção), substituir
      if (/\{\{[A-Z_]+\}\}/.test(html)) {
        let dadosVarObj = {};
        try { dadosVarObj = JSON.parse(doc.dados_variaveis || '{}'); } catch (_) {}
        if (Object.keys(dadosVarObj).length > 0) {
          html = substituirVariaveis(html, dadosVarObj);
        }
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      for (const assin of assinResult.rows) {
        const bloco = assin.status === 'assinado'
          ? _blocoAssinaturaHTML(assin, baseUrl)
          : _blocoPendenteHTML(assin);
        html = html.replace(new RegExp(`\\{\\{${escapeRegex(assin.placeholder_key)}\\}\\}`, 'g'), bloco);
      }

      const resultado = await gerarPDF({ templateHTML: html, variaveis: {}, retornarBuffer: true });

      const nomeArquivo = `${(doc.titulo || 'documento').replace(/[^a-z0-9]/gi, '_')}_assinado.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
      res.setHeader('Content-Length', resultado.buffer.length);
      res.send(resultado.buffer);
    } catch (err) {
      console.error('Erro gerarPDFAssinado:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // GET /assinaturas-doc/i/:tokenIndividual
  static async paginaAssinarIndividual(req, res) {
    try {
      const { tokenIndividual } = req.params;

      const assinResult = await query(
        `SELECT a.*, g.nome as grupo_nome, d.conteudo_html, d.titulo, d.token_assinatura,
                d.id as doc_id, t.nome as template_nome
         FROM assinaturas_documentos a
         LEFT JOIN grupos g ON g.id = a.grupo_id
         LEFT JOIN documentos_gerados d ON d.id = a.documento_gerado_id
         LEFT JOIN templates_pdf t ON t.id = a.template_id
         WHERE a.token_individual = $1`,
        [tokenIndividual]
      );

      if (assinResult.rows.length === 0) {
        return res.status(404).render('error', {
          title: 'Não encontrado',
          message: 'Link de assinatura inválido ou expirado.',
          user: req.user
        });
      }

      const assin = assinResult.rows[0];

      // Todas as assinaturas do documento para mostrar estado atual
      const todasResult = await query(
        `SELECT a.*, g.nome as grupo_nome
         FROM assinaturas_documentos a
         LEFT JOIN grupos g ON g.id = a.grupo_id
         WHERE a.documento_gerado_id = $1
         ORDER BY a.id ASC`,
        [assin.doc_id]
      );
      const todasAssinaturas = todasResult.rows;

      // Verificar se o usuário é membro do grupo desta assinatura
      const pertence = await query(
        `SELECT 1 FROM usuarios_grupos WHERE grupo_id = $1 AND usuario_id = $2`,
        [assin.grupo_id, req.user.id]
      );
      const podeAssinar = pertence.rows.length > 0 && assin.status === 'pendente';

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const htmlEstadoAtual = _buildDocumentoEstadoAtual(assin.conteudo_html, todasAssinaturas, baseUrl);

      res.render('assinatura/assinar-individual', {
        title: `Assinar: ${assin.titulo || assin.template_nome || 'Documento'}`,
        user: req.user,
        assin,
        todasAssinaturas,
        podeAssinar,
        tokenIndividual,
        docToken: assin.token_assinatura,
        htmlEstadoAtual,
        baseUrl
      });
    } catch (err) {
      console.error('Erro paginaAssinarIndividual:', err);
      res.status(500).render('error', { title: 'Erro', message: err.message, user: req.user });
    }
  }

  // POST /assinaturas-doc/i/:tokenIndividual
  static async assinarIndividual(req, res) {
    try {
      const { tokenIndividual } = req.params;

      const assinRow = await query(
        `SELECT a.*, d.token_assinatura, d.id as doc_id
         FROM assinaturas_documentos a
         LEFT JOIN documentos_gerados d ON d.id = a.documento_gerado_id
         WHERE a.token_individual = $1 AND a.status = 'pendente'`,
        [tokenIndividual]
      );

      if (assinRow.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Assinatura não encontrada ou já realizada.' });
      }

      // Reutilizar lógica do assinar via token do documento
      req.params.token = assinRow.rows[0].token_assinatura;
      req.body.assinatura_id = assinRow.rows[0].id;
      return AssinaturaDocController.assinar(req, res);
    } catch (err) {
      console.error('Erro assinarIndividual:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Retorna IP público real do cliente.
 * Em produção (Railway/Heroku) vem no x-forwarded-for.
 * Em localhost, consulta api.ipify.org para obter o IP externo da rede.
 */
async function _resolverIP(req) {
  // 1. X-Forwarded-For — em produção atrás de proxy contém o IP real do cliente
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim().replace(/^::ffff:/i, '');
    if (ip && ip !== '::1' && ip !== '127.0.0.1' && !ip.startsWith('10.')
        && !ip.startsWith('192.168.') && !/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) {
      return ip;
    }
  }

  // 2. IP direto do socket
  const raw = ((req.connection && req.connection.remoteAddress)
            || (req.socket && req.socket.remoteAddress)
            || '').replace(/^::ffff:/i, '');

  const isLocal = !raw || raw === '::1' || raw === '127.0.0.1'
                || raw.startsWith('10.') || raw.startsWith('192.168.')
                || /^172\.(1[6-9]|2\d|3[01])\./.test(raw);

  if (!isLocal) return raw;

  // 3. Localhost / rede privada → buscar IP público externo
  try {
    const https = require('https');
    const ip = await new Promise((resolve, reject) => {
      const req2 = https.get('https://api.ipify.org?format=text', { timeout: 3000 }, (res) => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => resolve(data.trim()));
      });
      req2.on('error', reject);
      req2.on('timeout', () => { req2.destroy(); reject(new Error('timeout')); });
    });
    if (ip && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip;
  } catch (_) {
    // silencioso — retorna o IP local como fallback
  }

  return raw || '127.0.0.1';
}

/**
 * Formata Date para "dd/mm/yyyy hh:mm:ss" no fuso de Brasília.
 */
function _formatarDataHora(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(',', '');  // remove vírgula entre data e hora
}

// ── Blocos de assinatura HTML ────────────────────────────────────────────────

function _blocoAssinaturaHTML(assin, baseUrl) {
  const dataHora = _formatarDataHora(assin.data_hora);

  const cpfMask = assin.cpf_assinante
    ? assin.cpf_assinante.replace(/(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/, '***.$2.***-$4')
    : 'Não informado';

  const link = `${baseUrl}/verificar/${assin.hash_assinatura}`;

  return `
<table cellpadding="0" cellspacing="0" width="100%"
  style="border-collapse:collapse;border-top:2px solid #222;border-bottom:1px solid #aaa;
         margin:10px 0;font-family:Arial,Helvetica,sans-serif;font-size:8pt;
         color:#222;page-break-inside:avoid;">
  <tr>
    <td colspan="2" style="padding:5px 0 4px;">
      <span style="font-size:7pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#555;">
        Assinado Eletronicamente
      </span>
    </td>
  </tr>
  <tr>
    <td style="padding:0 16px 6px 0;vertical-align:top;width:55%;">
      <p style="margin:0 0 2px;font-size:9pt;font-weight:700;">${assin.nome_assinante || ''}</p>
      <p style="margin:0 0 2px;color:#444;">${assin.cargo_assinante || ''}</p>
      <p style="margin:0 0 2px;color:#444;">CPF: ${cpfMask} &nbsp;|&nbsp; Grupo: ${assin.grupo_nome || ''}</p>
    </td>
    <td style="padding:0 0 6px;vertical-align:top;width:45%;border-left:1px solid #ddd;padding-left:14px;">
      <p style="margin:0 0 2px;color:#333;">Data/Hora: <strong>${dataHora}</strong></p>
      <p style="margin:0 0 2px;color:#333;">IP de origem: ${assin.ip_assinante || ''}</p>
      <p style="margin:0;color:#333;font-size:7.5pt;">Cód. verificador: <strong>${assin.hash_assinatura}</strong></p>
    </td>
  </tr>
  <tr>
    <td colspan="2" style="border-top:1px solid #ddd;padding-top:4px;">
      <p style="margin:0;font-size:6.5pt;color:#888;word-break:break-all;">
        Verificar autenticidade: ${link} &nbsp;|&nbsp; Hash: ${assin.hash_documento || ''}
      </p>
    </td>
  </tr>
</table>`;
}

function _blocoPendenteHTML(assin) {
  return `
<table cellpadding="0" cellspacing="0" width="100%"
  style="border-collapse:collapse;border-top:2px solid #aaa;border-bottom:1px solid #aaa;
         margin:10px 0;font-family:Arial,Helvetica,sans-serif;font-size:8pt;color:#555;page-break-inside:avoid;">
  <tr>
    <td style="padding:6px 0;">
      <p style="margin:0 0 2px;font-size:7pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#888;">Assinatura Eletrônica Pendente</p>
      <p style="margin:0;color:#666;">Grupo responsável: ${assin.grupo_nome || ''}</p>
    </td>
  </tr>
</table>`;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Constrói o HTML do documento no estado atual (assinaturas já aplicadas + pendentes marcadas)
function _buildDocumentoEstadoAtual(htmlBase, todasAssinaturas, baseUrl) {
  let html = unwrapAssinaturaVars(htmlBase || '');
  for (const assin of todasAssinaturas) {
    const bloco = assin.status === 'assinado'
      ? _blocoAssinaturaHTML(assin, baseUrl)
      : _blocoPendenteHTML(assin);
    html = html.replace(
      new RegExp(`\\{\\{${escapeRegex(assin.placeholder_key)}\\}\\}`, 'g'),
      bloco
    );
  }
  return html;
}

module.exports = AssinaturaDocController;
