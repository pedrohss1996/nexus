// Script para executar a migration 009 (Fornecedores completo + anexos)
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
    console.log('Iniciando migration 009...');
    console.log(`Conectado ao banco: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}\n`);

    const migrationPath = path.join(__dirname, '..', 'migrations', '009_fornecedores_completo.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executando migration...\n');

    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    console.log('Migration 009 executada com sucesso.\n');
    console.log('Fornecedores: novas colunas (razao_social, nome_fantasia, endereco completo, contatos, dados bancarios, plano de contas). Tabela fornecedor_anexos criada.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\nErro na migration:', error.message);
    if (error.code) console.error('Codigo:', error.code);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
