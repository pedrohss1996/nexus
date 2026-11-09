// Middleware: proteção CSRF (double-submit cookie)
//
// Por que double-submit e não token em sessão: guardar o token na sessão
// obrigaria a criar uma sessão para todo visitante anônimo que abrisse a tela de
// login, gravando uma linha no Postgres por visita. O double-submit é stateless
// — o token vive num cookie e precisa ser reapresentado no corpo/header da
// requisição. Um site atacante consegue disparar a requisição, mas não consegue
// ler o cookie (same-origin policy) nem forjar o campo correspondente.
//
// Complementa o SameSite=Lax dos cookies de sessão e de auth: aquele bloqueia o
// POST cross-site, este cobre o caso de o navegador não honrar SameSite e
// requisições same-site vindas de subdomínio comprometido.

const crypto = require('crypto');

const NOME_COOKIE = 'csrf_token';
const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);
const VALIDADE = 24 * 60 * 60 * 1000; // 24h, alinhado com a sessão

// Comparação em tempo constante; strings de tamanhos diferentes já falham antes
function tokensConferem(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function extrairToken(req) {
  // Ordem: corpo (form comum) → header (fetch/AJAX) → query (form multipart,
  // cujo corpo ainda não foi parseado quando este middleware roda)
  return req.body?._csrf
    || req.get('x-csrf-token')
    || req.query?._csrf
    || null;
}

function csrf(req, res, next) {
  let token = req.cookies?.[NOME_COOKIE];

  if (!token) {
    token = crypto.randomBytes(32).toString('hex');
    res.cookie(NOME_COOKIE, token, {
      // Precisa ser legível por JS para o fetch mandar no header.
      // O valor não é segredo de autenticação — só prova mesma origem.
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: VALIDADE
    });
  }

  res.locals.csrfToken = token;

  if (METODOS_SEGUROS.has(req.method)) return next();

  const enviado = extrairToken(req);
  if (!tokensConferem(enviado, token)) {
    console.warn(
      `⚠️  CSRF rejeitado: ${req.method} ${req.originalUrl} (usuário: ${req.user?.email || 'anônimo'})`
    );

    if (req.get('x-csrf-token') !== undefined || req.xhr
        || req.headers.accept?.includes('application/json')) {
      return res.status(403).json({
        success: false,
        message: 'Token de segurança inválido. Recarregue a página e tente novamente.'
      });
    }

    return res.status(403).render('error', {
      title: 'Sessão Expirada - DataFlow',
      message: 'Token de segurança inválido. Recarregue a página e tente novamente.',
      user: req.user
    });
  }

  next();
}

module.exports = { csrf, NOME_COOKIE };
