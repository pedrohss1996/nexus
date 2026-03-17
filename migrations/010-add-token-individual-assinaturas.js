const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('🚀 Migração 010 — token_individual em assinaturas_documentos');
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE assinaturas_documentos
        ADD COLUMN IF NOT EXISTS token_individual VARCHAR(64) UNIQUE;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_assin_token_individual
        ON assinaturas_documentos(token_individual);
    `);

    await client.query('COMMIT');
    console.log('✅ Migração 010 concluída!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro migração 010:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
