const fs = require('fs');
const path = require('path');

// Criar diretório de logs se não existir
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Função para formatar data
const formatDate = () => {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
};

// Logger de auditoria (para ações sensíveis)
const auditLog = (action, userId, details = {}) => {
  const logEntry = {
    timestamp: formatDate(),
    action,
    userId,
    details,
    ip: details.ip || 'N/A'
  };

  const logLine = JSON.stringify(logEntry) + '\n';
  const logFile = path.join(logsDir, `audit-${new Date().toISOString().split('T')[0]}.log`);

  fs.appendFileSync(logFile, logLine, 'utf8');
  console.log(`[AUDIT] ${action} - User: ${userId}`);
};

// Logger de erros
const errorLog = (error, context = {}) => {
  const logEntry = {
    timestamp: formatDate(),
    level: 'ERROR',
    message: error.message,
    stack: error.stack,
    context
  };

  const logLine = JSON.stringify(logEntry) + '\n';
  const logFile = path.join(logsDir, `error-${new Date().toISOString().split('T')[0]}.log`);

  fs.appendFileSync(logFile, logLine, 'utf8');
  console.error(`[ERROR] ${error.message}`);
};

module.exports = {
  auditLog,
  errorLog
};
