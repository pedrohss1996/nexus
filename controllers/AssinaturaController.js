const { query } = require('../config/database');
const GovBr = require('../services/GovBrAssinaturaService');
const { auditLog } = require('../utils/logger');
const path  = require('path');
const fs    = require('fs');

/* Pasta onde ficam os PDFs gerados */
const PDF_DIR = path.join(__dirname, '..', 'public', 'documentos');

/* ─────────────────────────────────────────────────────────────── */

class AssinaturaController {

  /* ── Lista assinaturas de um documento ── */
  static async index(req, res) {
    try {
      const { documentoId } = req.params;

      const docResult = await query(
        `SELECT dg.id, dg.nome_arquivo, dg.arquivo_path, dg.criado_em,
                u.nome AS criado_por
         FROM documentos_gerados dg
         LEFT JOIN usuarios u ON u.id = dg.usuario_id
         WHERE dg.id = $1`,
        [documentoId]
      );
      if (!docResult.rows.length) {
        return res.status(404).render('error', { title: 'Erro - DataFlow', message: 'Documento não encontrado', user: req.user });
      }
      const documento = docResult.rows[0];

      const assinResult = await query(
        `SELECT a.*, u.nome AS assinante_nome, u.email AS assinante_email
         FROM assinaturas_digitais a
         LEFT JOIN usuarios u ON u.id = a.usuario_id
         WHERE a.documento_id = $1
         ORDER BY a.assinado_em DESC`,
        [documentoId]
      );

      const credenciaisConfiguradas = !!(
        process.env.GOVBR_ASSINATURA_CLIENT_ID &&
        process.env.GOVBR_ASSINATURA_CLIENT_SECRET &&
        process.env.GOVBR_ASSINATURA_REDIRECT_URI
      );

      res.render('assinaturas/index', {
        title: 'Assinaturas Digitais',
        user: req.user,
        documento,
        assinaturas: assinResult.rows,
        credenciaisConfiguradas,
        success: req.query.success || null,
        error: req.query.error || null,
      });
    } catch (err) {
      console.error('AssinaturaController.index:', err);
      res.status(500).render('error', { title: 'Erro - DataFlow', message: 'Erro ao carregar assinaturas', user: req.user });
    }
  }

  /* ── Inicia fluxo OAuth2 gov.br ── */
  static async iniciarGovBr(req, res) {
    try {
      const { documentoId } = req.params;

      if (!process.env.GOVBR_ASSINATURA_CLIENT_ID) {
        return res.redirect(
          `/assinaturas/${documentoId}?error=Credenciais+gov.br+não+configuradas`
        );
      }

      /* Verifica se documento existe */
      const doc = await query('SELECT id FROM documentos_gerados WHERE id=$1', [documentoId]);
      if (!doc.rows.length) return res.status(404).send('Documento não encontrado');

      /* Gera state e salva na sessão */
      const { url, state } = GovBr.redirectUrl(documentoId, 'sign');
      req.session.govbrState = state;
      req.session.govbrDocumentoId = documentoId;

      /* Log de início */
      auditLog('ASSINATURA_GOVBR_INICIO', req.user.id, { documentoId, ip: req.ip });

      res.redirect(url);
    } catch (err) {
      console.error('AssinaturaController.iniciarGovBr:', err);
      res.redirect(`/assinaturas/${req.params.documentoId}?error=Erro+ao+iniciar+assinatura`);
    }
  }

  /* ── Callback OAuth2 gov.br ── */
  static async callbackGovBr(req, res) {
    const { code, state, error: oauthError } = req.query;

    /* Extrai documentoId do state */
    const parts = (state || '').split('.');
    const documentoId = parts[parts.length - 1];

    if (oauthError) {
      auditLog('ASSINATURA_GOVBR_CANCELADA', req.user?.id, { documentoId, oauthError });
      return res.redirect(
        `/assinaturas/${documentoId}?error=Autorização+cancelada+pelo+usuário`
      );
    }

    /* Valida state da sessão */
    if (!req.session.govbrState || req.session.govbrState !== state) {
      return res.redirect(
        `/assinaturas/${documentoId}?error=Estado+inválido,+tente+novamente`
      );
    }

    try {
      /* Passo 2: access token */
      const tokenData = await GovBr.exchangeCode(code);
      const accessToken = tokenData.access_token;

      /* Passo 3: certificado */
      let certificadoPem;
      try {
        certificadoPem = await GovBr.getCertificado(accessToken);
      } catch (certErr) {
        if (certErr.message === 'CONTA_BRONZE') {
          return res.redirect(
            `/assinaturas/${documentoId}?error=Conta+gov.br+precisa+ser+nível+Prata+ou+Ouro.+` +
            `Acesse+https://confiabilidades.acesso.gov.br/+para+fazer+upgrade`
          );
        }
        throw certErr;
      }

      /* Busca o documento */
      const docResult = await query(
        'SELECT * FROM documentos_gerados WHERE id=$1',
        [documentoId]
      );
      if (!docResult.rows.length) throw new Error('Documento não encontrado');
      const documento = docResult.rows[0];

      /* Lê o arquivo PDF */
      const arquivoPath = documento.arquivo_path
        ? path.join(PDF_DIR, path.basename(documento.arquivo_path))
        : null;

      if (!arquivoPath || !fs.existsSync(arquivoPath)) {
        return res.redirect(
          `/assinaturas/${documentoId}?error=Arquivo+PDF+não+encontrado`
        );
      }

      const pdfBuffer = fs.readFileSync(arquivoPath);

      /* Passo 4: assinar hash */
      let pkcs7, hashBase64;
      try {
        const result = await GovBr.assinarHash(accessToken, pdfBuffer);
        pkcs7 = result.pkcs7;
        hashBase64 = result.hashBase64;
      } catch (signErr) {
        if (signErr.message === 'CONTA_BRONZE') {
          return res.redirect(
            `/assinaturas/${documentoId}?error=Conta+gov.br+precisa+ser+nível+Prata+ou+Ouro`
          );
        }
        throw signErr;
      }

      /* Salva arquivo .p7s ao lado do PDF */
      const p7sPath = arquivoPath.replace(/\.pdf$/i, '_govbr.p7s');
      fs.writeFileSync(p7sPath, pkcs7);

      /* Registra no banco */
      await query(
        `INSERT INTO assinaturas_digitais
           (documento_id, usuario_id, tipo_assinatura, hash_documento,
            certificado_digital, ip_assinante, assinado_em, validado,
            govbr_pkcs7_path)
         VALUES ($1,$2,'gov_br',$3,$4,$5,NOW(),true,$6)`,
        [
          documentoId,
          req.user.id,
          hashBase64,
          certificadoPem,
          req.ip,
          path.basename(p7sPath),
        ]
      );

      /* Limpa sessão */
      delete req.session.govbrState;
      delete req.session.govbrDocumentoId;

      auditLog('ASSINATURA_GOVBR_CONCLUIDA', req.user.id, {
        documentoId,
        hash: hashBase64,
        ip: req.ip,
      });

      res.redirect(
        `/assinaturas/${documentoId}?success=Documento+assinado+com+sucesso+via+gov.br`
      );
    } catch (err) {
      console.error('AssinaturaController.callbackGovBr:', err);
      auditLog('ASSINATURA_GOVBR_ERRO', req.user?.id, { documentoId, erro: err.message });
      res.redirect(
        `/assinaturas/${documentoId}?error=Erro+ao+processar+assinatura:+${encodeURIComponent(err.message)}`
      );
    }
  }

  /* ── Assinatura simples (sem gov.br, apenas registro interno) ── */
  static async assinarSimples(req, res) {
    const { documentoId } = req.params;
    const { observacoes } = req.body;
    try {
      const docResult = await query(
        'SELECT * FROM documentos_gerados WHERE id=$1',
        [documentoId]
      );
      if (!docResult.rows.length) return res.status(404).send('Não encontrado');
      const documento = docResult.rows[0];

      /* Calcula hash do arquivo, se disponível */
      let hashBase64 = null;
      const arquivoPath = documento.arquivo_path
        ? path.join(PDF_DIR, path.basename(documento.arquivo_path))
        : null;
      if (arquivoPath && fs.existsSync(arquivoPath)) {
        hashBase64 = GovBr.calcularHash(fs.readFileSync(arquivoPath));
      }

      await query(
        `INSERT INTO assinaturas_digitais
           (documento_id, usuario_id, tipo_assinatura, hash_documento,
            ip_assinante, assinado_em, validado, observacoes)
         VALUES ($1,$2,'simples',$3,$4,NOW(),true,$5)`,
        [documentoId, req.user.id, hashBase64, req.ip, observacoes || null]
      );

      auditLog('ASSINATURA_SIMPLES', req.user.id, { documentoId, ip: req.ip });

      res.redirect(
        `/assinaturas/${documentoId}?success=Assinatura+simples+registrada+com+sucesso`
      );
    } catch (err) {
      console.error('AssinaturaController.assinarSimples:', err);
      res.redirect(
        `/assinaturas/${documentoId}?error=Erro+ao+registrar+assinatura`
      );
    }
  }

  /* ── Download do .p7s ── */
  static async downloadP7s(req, res) {
    const { assinaturaId } = req.params;
    try {
      const result = await query(
        'SELECT govbr_pkcs7_path FROM assinaturas_digitais WHERE id=$1',
        [assinaturaId]
      );
      if (!result.rows.length || !result.rows[0].govbr_pkcs7_path) {
        return res.status(404).send('Arquivo não encontrado');
      }
      const filePath = path.join(PDF_DIR, result.rows[0].govbr_pkcs7_path);
      if (!fs.existsSync(filePath)) return res.status(404).send('Arquivo não encontrado');
      res.download(filePath);
    } catch (err) {
      console.error('AssinaturaController.downloadP7s:', err);
      res.status(500).send('Erro ao baixar arquivo');
    }
  }

  /* ── Remove assinatura (somente admin/gestor) ── */
  static async remover(req, res) {
    const { assinaturaId } = req.params;
    try {
      const result = await query(
        'DELETE FROM assinaturas_digitais WHERE id=$1 RETURNING documento_id',
        [assinaturaId]
      );
      const documentoId = result.rows[0]?.documento_id;
      auditLog('ASSINATURA_REMOVIDA', req.user.id, { assinaturaId });
      res.redirect(
        `/assinaturas/${documentoId}?success=Assinatura+removida`
      );
    } catch (err) {
      console.error('AssinaturaController.remover:', err);
      res.redirect('back');
    }
  }
}

module.exports = AssinaturaController;
