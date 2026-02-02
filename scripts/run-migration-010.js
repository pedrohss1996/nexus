// Script para executar a migration 010 (Fluxos - Workflow Engine)
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
    console.log('Iniciando migration 010 (Fluxos)...');
    const migrationPath = path.join(__dirname, '..', 'migrations', '010_create_fluxos.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration 010 executada com sucesso. Tabelas: fluxos, fluxo_etapas, fluxo_edges.');
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
