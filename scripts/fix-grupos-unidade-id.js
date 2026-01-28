// Script para adicionar coluna unidade_id na tabela grupos
require('dotenv').config();
const { query } = require('../config/database');

async function corrigirGrupos() {
  try {
    console.log('🔧 Adicionando coluna unidade_id em grupos...\n');

    // Adicionar coluna unidade_id em grupos
    try {
      await query('ALTER TABLE grupos ADD COLUMN unidade_id INT NOT NULL REFERENCES unidades(id) ON DELETE CASCADE');
      console.log('✅ Coluna unidade_id adicionada em grupos');
    } catch (e) {
      console.log('⚠️  Coluna unidade_id já existe em grupos');
    }

    // Criar índice
    try {
      await query('CREATE INDEX IF NOT EXISTS idx_grupos_unidade ON grupos(unidade_id)');
      console.log('✅ Índice criado');
    } catch (e) {
      console.log('⚠️  Índice já existe');
    }

    console.log('\n🎉 Tabela grupos corrigida com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error('Detalhes:', error);
    process.exit(1);
  }
}

corrigirGrupos();
