const { Pool } = require('pg');
require('dotenv').config();

// Configuração TLS do banco.
// rejectUnauthorized:false criptografa mas aceita qualquer certificado — não
// protege contra MITM. Para dados de saúde, o padrão passa a ser verificar;
// informe o CA do provedor em DB_SSL_CA. Só desligue em desenvolvimento local.
function sslConfig() {
  if (process.env.DB_SSL === 'false') return false;

  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
  const ca = process.env.DB_SSL_CA;

  if (!rejectUnauthorized && process.env.NODE_ENV === 'production') {
    console.warn(
      '⚠️  DB_SSL_REJECT_UNAUTHORIZED=false em produção: a conexão com o banco ' +
      'está criptografada mas sem verificação de certificado (risco de MITM). ' +
      'Configure DB_SSL_CA com o certificado do provedor.'
    );
  }

  return ca ? { ca, rejectUnauthorized } : { rejectUnauthorized };
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'dataflow',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: sslConfig(),
  max: 20, // máximo de clientes no pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
});

// Testar conexão
pool.on('connect', () => {
  console.log('✅ Conectado ao PostgreSQL');
});

// Erro em cliente ocioso do pool é quase sempre transitório (queda de rede,
// restart do banco). Derrubar o processo aqui transformava isso em indisponi-
// bilidade total: o pool descarta o cliente ruim e segue com os demais.
pool.on('error', (err) => {
  console.error('❌ Erro inesperado no pool do PostgreSQL:', err.message);
});

const isDev = process.env.NODE_ENV !== 'production';

// Função helper para executar queries
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    if (isDev) {
      const duration = Date.now() - start;
      console.log('Query executada', { duration: `${duration}ms`, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Erro na query:', { text: text.substring(0, 120), error: error.message });
    throw error;
  }
};

// Função helper para transações
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  query,
  transaction
};
