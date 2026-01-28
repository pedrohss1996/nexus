// Script para adicionar coluna ativo nas tabelas grupos e unidades
require('dotenv').config();
const { query } = require('../config/database');

async function corrigirTabelas() {
  try {
    console.log('🔧 Adicionando coluna ativo...\n');

    // Adicionar coluna ativo em grupos
    try {
      await query('ALTER TABLE grupos ADD COLUMN ativo BOOLEAN DEFAULT true');
      console.log('✅ Coluna ativo adicionada em grupos');
    } catch (e) {
      console.log('⚠️  Coluna ativo já existe em grupos');
    }

    // Adicionar coluna ativo em unidades
    try {
      await query('ALTER TABLE unidades ADD COLUMN ativo BOOLEAN DEFAULT true');
      console.log('✅ Coluna ativo adicionada em unidades');
    } catch (e) {
      console.log('⚠️  Coluna ativo já existe em unidades');
    }

    // Criar índices
    try {
      await query('CREATE INDEX IF NOT EXISTS idx_grupos_ativo ON grupos(ativo)');
      await query('CREATE INDEX IF NOT EXISTS idx_unidades_ativo ON unidades(ativo)');
      console.log('✅ Índices criados');
    } catch (e) {
      console.log('⚠️  Índices já existem');
    }

    console.log('\n🎉 Tabelas corrigidas com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

corrigirTabelas();
