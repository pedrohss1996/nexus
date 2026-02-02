// Script para executar a migration 011 (Processos - novo formulário)
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Iniciando migration 011 (Processos - novo formulário)...');
    const migrationPath = path.join(__dirname, '..', 'migrations', '011_processos_novo_formulario.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration 011 executada. Colunas adicionadas em processos: numero_processo, descricao_detalhada, observacao, emergencial, data_vencimento, fluxo_id.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro na migration:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
