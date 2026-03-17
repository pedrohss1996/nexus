/**
 * GovBrAssinaturaService
 * Integração com a API de Assinatura Eletrônica Avançada do gov.br
 *
 * Documentação oficial:
 * https://manual-integracao-assinatura-eletronica.readthedocs.io/en/latest/
 *
 * Fluxo:
 *  1. redirectUrl()   → redireciona usuário para gov.br (OAuth2 Authorization Code)
 *  2. exchangeCode()  → troca o code pelo access_token
 *  3. getCertificado() → busca o certificado público do usuário
 *  4. assinarHash()   → envia hash SHA-256 e recebe pacote PKCS#7
 */

const https = require('https');
const http  = require('http');
const crypto = require('crypto');
const fs     = require('fs');
const { URLSearchParams } = require('url');

const IS_PROD = process.env.NODE_ENV === 'production';

/* ── Endpoints ── */
const OAUTH_HOST   = IS_PROD ? 'cas.iti.br'                        : 'cas.staging.iti.br';
const API_HOST     = IS_PROD ? 'assinatura-api.iti.br'              : 'assinatura-api.staging.iti.br';
const OAUTH_AUTH   = `/oauth2.0/authorize`;
const OAUTH_TOKEN  = `/oauth2.0/token`;
const API_CERT     = `/externo/v2/certificadoPublico`;
const API_ASSINAR  = `/externo/v2/assinarPKCS7`;

/* ── Credenciais (variáveis de ambiente) ── */
const CLIENT_ID     = process.env.GOVBR_ASSINATURA_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.GOVBR_ASSINATURA_CLIENT_SECRET || '';
const REDIRECT_URI  = process.env.GOVBR_ASSINATURA_REDIRECT_URI  || '';

/* ─────────────────────────────────────────────────────────── */

/**
 * Gera URL de autorização gov.br para redirect do usuário.
 * @param {string} documentoId  - ID do documento a ser assinado (salvo no state)
 * @param {string} scope        - 'sign' (único) | 'signature_session' (lote)
 * @returns {{ url: string, state: string }}
 */
function redirectUrl(documentoId, scope = 'sign') {
  const state = crypto.randomBytes(16).toString('hex') + '.' + documentoId;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope,
    redirect_uri: REDIRECT_URI,
    state,
    nonce: crypto.randomBytes(8).toString('hex'),
  });
  return {
    url: `https://${OAUTH_HOST}${OAUTH_AUTH}?${params.toString()}`,
    state,
  };
}

/* ── helpers HTTP ── */
function httpsPost(host, path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const options = {
      hostname: host,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...extraHeaders,
      },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpsGet(host, path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      path,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({ status: res.statusCode, body: buf, text: buf.toString() });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Passo 2: Troca authorization code por access_token.
 * @param {string} code
 * @returns {{ access_token, token_type, expires_in }}
 */
async function exchangeCode(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  }).toString();

  const result = await new Promise((resolve, reject) => {
    const options = {
      hostname: OAUTH_HOST,
      path: OAUTH_TOKEN,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  if (result.status !== 200) {
    throw new Error(`Erro ao obter token gov.br: ${JSON.stringify(result.data)}`);
  }
  return result.data;
}

/**
 * Passo 3: Obtém certificado público do usuário.
 * @param {string} accessToken
 * @returns {string} certificado PEM
 */
async function getCertificado(accessToken) {
  const res = await httpsGet(API_HOST, API_CERT, accessToken);
  if (res.status === 403) {
    throw new Error('CONTA_BRONZE'); // conta não é prata/ouro
  }
  if (res.status !== 200) {
    throw new Error(`Erro ao obter certificado: ${res.status} ${res.text}`);
  }
  return res.text; // PEM string
}

/**
 * Passo 4: Calcula hash SHA-256 do arquivo e envia para assinatura.
 * @param {string} accessToken
 * @param {string|Buffer} conteudo - conteúdo do arquivo (Buffer ou caminho)
 * @returns {Buffer} pacote PKCS#7 (.p7s)
 */
async function assinarHash(accessToken, conteudo) {
  const buf = Buffer.isBuffer(conteudo) ? conteudo : fs.readFileSync(conteudo);
  const hashHex = crypto.createHash('sha256').update(buf).digest('base64');

  const res = await new Promise((resolve, reject) => {
    const data = JSON.stringify({ hashBase64: hashHex });
    const options = {
      hostname: API_HOST,
      path: API_ASSINAR,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (r) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => resolve({ status: r.statusCode, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });

  if (res.status === 403) throw new Error('CONTA_BRONZE');
  if (res.status !== 200) throw new Error(`Erro na assinatura: ${res.status} ${res.body.toString()}`);

  return { pkcs7: res.body, hashBase64: hashHex };
}

/**
 * Calcula o hash SHA-256 de um Buffer, retornando em base64.
 */
function calcularHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('base64');
}

module.exports = { redirectUrl, exchangeCode, getCertificado, assinarHash, calcularHash };
