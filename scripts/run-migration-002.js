// Script para executar a migration 002 (Grupos e Unidades)
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
    console.log('🔄 Iniciando migration 002...');
    console.log(`📊 Conectado ao banco: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}\n`);

    // Ler o arquivo SQL
    const migrationPath = path.join(__dirname, '..', 'migrations', '002_create_grupos_unidades.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Executando migration...\n');

    // Executar a migration
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    console.log('✅ Migration 002 executada com sucesso!\n');
    console.log('📋 Tabelas criadas:');
    console.log('   - unidades');
    console.log('   - grupos');
    console.log('   - usuarios_grupos');
    console.log('\n📊 Views criadas:');
    console.log('   - vw_usuarios_grupos_unidades');
    console.log('   - vw_grupos_estatisticas');
    console.log('\n🌱 Dados iniciais inseridos:');
    console.log('   - 3 unidades padrão');
    console.log('   - 5 grupos padrão');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Erro na migration:', error.message);
    if (error.code) {
      console.error('   Código:', error.code);
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Verificar variáveis de ambiente
if (!process.env.DB_PASSWORD) {
  console.error('❌ Erro: Variável DB_PASSWORD não configurada no .env');
  process.exit(1);
}

runMigration();
