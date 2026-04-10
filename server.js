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
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

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
const { authenticateToken } = require('./middlewares/authMiddleware');
const loadUnidades = require('./middlewares/loadUnidades');

// Importar Socket.io handlers
const socketHandler = require('./sockets/socketHandler');

const app = express();
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
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Flash messages (usa session; req.flash() grava, res.locals.flash é lido na view)
app.use((req, res, next) => {
  res.locals.flash = req.session.flash || {};
  req.session.flash = {};
  req.flash = (type, message) => {
    if (!req.session.flash) req.session.flash = {};
    req.session.flash[type] = message;
  };
  next();
});

// Configuração de views (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Arquivos estáticos com configuração de MIME types
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
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

// Rota para testar CSS
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

// Socket.io
socketHandler(io);

// ── Verificador de aniversários (roda no boot + a cada 24h) ─────────────────
NotificacaoController.verificarAniversarios();
setInterval(() => NotificacaoController.verificarAniversarios(), 24 * 60 * 60 * 1000);

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
