require('dotenv').config();
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
const grupoRoutes = require('./routes/grupoRoutes');
const unidadeRoutes = require('./routes/unidadeRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');

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
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requisições por IP
  message: 'Muitas requisições deste IP, tente novamente mais tarde.'
});

app.use('/api/', limiter);

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

// Configuração de views (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rotas públicas
app.use('/auth', authRoutes);

// Rotas protegidas (com autenticação e carregamento de unidades)
app.use('/api', authenticateToken, loadUnidades, apiRoutes);
app.use('/dashboard', authenticateToken, loadUnidades, dashboardRoutes);
app.use('/processos', authenticateToken, loadUnidades, processoRoutes);
app.use('/documentos', authenticateToken, loadUnidades, documentoRoutes);
app.use('/fornecedores', authenticateToken, loadUnidades, fornecedorRoutes);
app.use('/grupos', authenticateToken, loadUnidades, grupoRoutes);
app.use('/unidades', authenticateToken, loadUnidades, unidadeRoutes);
app.use('/cadastros/usuarios', authenticateToken, loadUnidades, usuarioRoutes);

// Rota raiz
app.get('/', (req, res) => {
  res.redirect('/auth/login');
});

// Socket.io
socketHandler(io);

// Error handler (deve ser o último middleware)
app.use(errorHandler);

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, io };
