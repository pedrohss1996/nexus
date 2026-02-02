// Script para executar a migration 007 (Contas contábeis por unidade)
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
    console.log('🔄 Iniciando migration 007...');
    console.log(`📊 Conectado ao banco: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}\n`);

    const migrationPath = path.join(__dirname, '..', 'migrations', '007_create_contas_contabeis.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Executando migration...\n');

    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    console.log('✅ Migration 007 executada com sucesso!\n');
    console.log('📋 Tabela criada: contas_contabeis');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Erro na migration:', error.message);
    if (error.code) console.error('   Código:', error.code);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
