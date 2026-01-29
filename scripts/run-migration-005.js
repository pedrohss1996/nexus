const migration = require('../migrations/005-create-templates-pdf');

async function runMigration() {
  console.log('🚀 Iniciando migration 005: Templates de Documentos PDF...');
  
  try {
    await migration.up();
    console.log('✅ Migration 005 executada com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao executar migration 005:', error);
    process.exit(1);
  }
}

runMigration();
