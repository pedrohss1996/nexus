require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false } // Obrigatório para conexões externas na Railway/Cloud
});

async function testConnection() {
  try {
    console.log('🔄 Tentando conectar ao PostgreSQL...');
    await client.connect();
    console.log('✅ Conexão bem-sucedida!');
    
    const res = await client.query('SELECT NOW()');
    console.log('🕒 Hora no servidor do banco:', res.rows[0].now);
    
    await client.end();
  } catch (err) {
    console.error('❌ Erro na conexão:', err);
  }
}

testConnection();