require('dotenv').config();

// Validar segredos obrigatórios em produção
if (process.env.NODE_ENV === 'production') {
  const missing = ['JWT_SECRET', 'SESSION_SECRET'].filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`FATAL: Variáveis de ambiente obrigatórias não definidas: ${missing.join(', ')}`);
    process.exit(1);
  }
}

const express = require('express');

// Express 4 não encaminha ao errorHandler a rejeição de um handler async:
// ela vira unhandledRejection e o Node encerra o processo — um único erro numa
// rota (ex.: criar protocolo) derrubava o sistema inteiro para todos. Aqui a
// promise devolvida pelo handler tem o erro repassado a next(err). (Express 5
// faz isso nativamente; remover este bloco ao migrar.)
{
  const Layer = require('express/lib/router/layer');
  Layer.prototype.handle_request = function handle(req, res, next) {
    const fn = this.handle;
    if (fn.length > 3) return next();
    try {
      const r = fn(req, res, next);
      if (r && typeof r.catch === 'function') r.catch(next);
    } catch (err) {
      next(err);
    }
  };
}

// Rede de segurança para promises fora do ciclo de requisição (sockets,
// agendador): registra em vez de derrubar o servidor.
process.on('unhandledRejection', (err) => {
  console.error('❌ Promise rejeitada sem tratamento:', err);
});

const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const rateLimit = require('express-rate-limit');
const { pool } = require('./config/database');
const { jsonParaScript, sanitizarDocumento } = require('./utils/sanitizarHtml');

// Importar rotas
const authRoutes = require('./routes/authRoutes');
const apiRoutes = require('./routes/apiRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const processoRoutes = require('./routes/processoRoutes');
const documentoRoutes = require('./routes/documentoRoutes');
const fornecedorRoutes = require('./routes/fornecedorRoutes');
const fluxoRoutes = require('./routes/fluxoRoutes');
const documentoPDFRoutes = require('./routes/documentoPDFRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const protocoloRoutes = require('./routes/protocoloRoutes');
const tramitacaoRoutes = require('./routes/tramitacaoRoutes');
const grupoRoutes = require('./routes/grupoRoutes');
const unidadeRoutes = require('./routes/unidadeRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const contratoRoutes = require('./routes/contratoRoutes');
const assinaturaRoutes = require('./routes/assinaturaRoutes');
const assinaturaDocRoutes = require('./routes/assinaturaDocRoutes');
const centroCustoRoutes = require('./routes/centroCustoRoutes');
const notificacaoRoutes = require('./routes/notificacaoRoutes');
const AssinaturaDocController = require('./controllers/AssinaturaDocController');
const NotificacaoController = require('./controllers/NotificacaoController');

// Importar middlewares
const errorHandler = require('./middlewares/errorHandler');
const { csrf } = require('./middlewares/csrf');
const { authenticateToken } = require('./middlewares/authMiddleware');
const loadUnidades = require('./middlewares/loadUnidades');

// Importar Socket.io handlers
const socketHandler = require('./sockets/socketHandler');

const app = express();

// Confiar no proxy reverso (Railway/Nginx/Heroku).
// Sem isto, req.ip devolve o IP do proxy: o rate limit passa a ser global
// (10 logins falhos derrubam o login de todos) e a auditoria grava IP errado.
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Configuração de segurança
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.ckeditor.com", "https://ckeditor.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.ckeditor.com", "https://ckeditor.com", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:", "blob:", "http:"],
      fontSrc: ["'self'", "data:", "https://cdn.ckeditor.com", "https://ckeditor.com"],
      connectSrc: ["'self'", "https://cdn.ckeditor.com", "https://ckeditor.com", "https://assinatura-api.staging.iti.br", "https://assinatura-api.iti.br"],
      formAction: ["'self'", "https://cas.staging.iti.br", "https://cas.iti.br"],
    },
  },
}));

// Rate limiting geral para /api/
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: 'Muitas requisições deste IP, tente novamente mais tarde.'
});
app.use('/api/', limiter);

// Rate limiting estrito para login — protege contra brute-force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 tentativas por IP por janela
  message: 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // só conta falhas
});
app.use('/auth/login', loginLimiter);

// Middlewares básicos
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session configuration
// Armazenada no PostgreSQL: o MemoryStore padrão vaza memória, perde todas as
// sessões a cada deploy e não funciona com múltiplas instâncias.
app.use(session({
  store: new pgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 60 // limpa sessões expiradas a cada hora
  }),
  name: 'dataflow.sid',
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Proteção CSRF — depois dos parsers de corpo e do cookie-parser, para poder
// ler _csrf do body, e antes de qualquer rota que altere estado.
app.use(csrf);

// Flash messages (usa session; req.flash() grava, res.locals.flash é lido na view)
// Só toca na sessão quando existe flash de fato: atribuir em toda requisição
// marcava a sessão como modificada, anulando o saveUninitialized:false e
// gravando uma linha no banco para cada visitante anônimo.
app.use((req, res, next) => {
  res.locals.flash = req.session.flash || {};
  if (req.session.flash) delete req.session.flash;
  req.flash = (type, message) => {
    if (!req.session.flash) req.session.flash = {};
    req.session.flash[type] = message;
  };
  next();
});

// Configuração de views (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serialização segura para blocos <script> nas views.
// JSON.stringify não escapa "</script>", então dados do banco contendo essa
// sequência quebrariam fora do bloco e virariam HTML executável.
app.use((req, res, next) => {
  res.locals.jsonSeguro = jsonParaScript;
  // Defesa em profundidade para os pontos que renderizam HTML cru: a escrita já
  // sanitiza, mas registros gravados antes desta mudança seguem no banco.
  res.locals.htmlSeguro = sanitizarDocumento;
  next();
});

// Arquivos estáticos com configuração de MIME types.
// Sem maxAge o Express envia "Cache-Control: public, max-age=0" e o browser
// revalida cada asset a cada navegação — um roundtrip por arquivo, mesmo quando
// nada mudou. Bibliotecas de terceiros ficam com cache longo; o CSS/JS próprio
// depende do ETag, que o Express já envia, para invalidar após um deploy.
const CACHE_LONGO = 30 * 24 * 60 * 60 * 1000; // 30 dias
const CACHE_CURTO = 60 * 60 * 1000;           // 1 hora

app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  maxAge: CACHE_CURTO,
  setHeaders: (res, filePath) => {
    // Bibliotecas versionadas por diretório praticamente não mudam
    if (filePath.includes(`${path.sep}libs${path.sep}`) || filePath.includes(`${path.sep}imgs${path.sep}`)) {
      res.setHeader('Cache-Control', `public, max-age=${CACHE_LONGO / 1000}`);
    }
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    }
  }
}));

// Servir uploads (imagens de notificações, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rotas públicas
app.use('/auth', authRoutes);
// Verificação de assinatura (pública — sem autenticação)
app.get('/verificar', (req, res) => res.render('assinatura/verificar', {
  hash: '', valido: false, assinatura: null, baseUrl: `${req.protocol}://${req.get('host')}`
}));
app.get('/verificar/:hash', AssinaturaDocController.verificar);

// Rotas protegidas (com autenticação e carregamento de unidades)
app.use('/api', authenticateToken, loadUnidades, apiRoutes);
app.use('/inicio', authenticateToken, loadUnidades, dashboardRoutes);
app.use('/processos', authenticateToken, loadUnidades, processoRoutes);
app.use('/documentos', authenticateToken, loadUnidades, documentoRoutes);
app.use('/fornecedores', authenticateToken, loadUnidades, fornecedorRoutes);
app.use('/documentos-pdf', authenticateToken, loadUnidades, documentoPDFRoutes);
app.use('/fluxos', authenticateToken, loadUnidades, fluxoRoutes);
app.use('/upload', authenticateToken, uploadRoutes);
app.use('/protocolo', authenticateToken, loadUnidades, protocoloRoutes);
app.use('/tramitacao', authenticateToken, loadUnidades, tramitacaoRoutes);
app.use('/grupos', authenticateToken, loadUnidades, grupoRoutes);
app.use('/unidades', authenticateToken, loadUnidades, unidadeRoutes);
app.use('/cadastros/usuarios', authenticateToken, loadUnidades, usuarioRoutes);
app.use('/contratos', authenticateToken, loadUnidades, contratoRoutes);
app.use('/assinaturas', authenticateToken, loadUnidades, assinaturaRoutes);
app.use('/assinaturas-doc', authenticateToken, loadUnidades, assinaturaDocRoutes);
app.use('/centros-custo',  authenticateToken, loadUnidades, centroCustoRoutes);
app.use('/notificacoes', authenticateToken, loadUnidades, notificacaoRoutes);
app.get('/api/notificacoes/nao-lidas', authenticateToken, NotificacaoController.contarNaoLidas);

// Rota raiz
app.get('/', (req, res) => {
  res.redirect('/auth/login');
});

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Rota de diagnóstico do CSS — só fora de produção: expõe caminhos absolutos
// do servidor, informação útil para quem estiver sondando a aplicação.
if (process.env.NODE_ENV !== 'production') {
  app.get('/test-css', (req, res) => {
    const fs = require('fs');
    const cssPath = path.join(__dirname, 'public', 'css', 'output.css');
    const exists = fs.existsSync(cssPath);
    const stats = exists ? fs.statSync(cssPath) : null;

    res.json({
      cssExists: exists,
      cssPath: cssPath,
      cssSize: stats ? stats.size : 0,
      publicPath: path.join(__dirname, 'public')
    });
  });
}

// Socket.io
socketHandler(io);

// ── Verificador de aniversários ────────────────────────────────────────────
// Com múltiplas réplicas, cada instância dispararia as mesmas notificações;
// ENABLE_SCHEDULER=false desliga o agendador nas réplicas extras.
// A primeira execução espera o servidor subir para não competir com o boot.
if (process.env.ENABLE_SCHEDULER !== 'false') {
  const UM_DIA = 24 * 60 * 60 * 1000;
  const rodar = () => {
    NotificacaoController.verificarAniversarios()
      .catch(err => console.error('❌ Erro ao verificar aniversários:', err.message));
  };
  setTimeout(rodar, 30 * 1000).unref();
  setInterval(rodar, UM_DIA).unref();
}

// Error handler (deve ser o último middleware)
app.use(errorHandler);

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📝 Editor Visual de Documentos: Ativo`);
});

module.exports = { app, io };
