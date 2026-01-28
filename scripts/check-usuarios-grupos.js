// Script para verificar a estrutura da tabela usuarios_grupos
require('dotenv').config();
const { query } = require('../config/database');

async function verificar() {
  try {
    const result = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'usuarios_grupos'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Estrutura da tabela usuarios_grupos:\n');
    result.rows.forEach(col => {
      console.log(`   ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

verificar();
