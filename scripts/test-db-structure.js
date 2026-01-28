// Script para verificar a estrutura das tabelas
require('dotenv').config();
const { query } = require('../config/database');

async function verificarEstrutura() {
  try {
    console.log('🔍 Verificando estrutura das tabelas...\n');

    // Verificar tabela usuarios
    const usuarios = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'usuarios'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Tabela: usuarios');
    usuarios.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });

    // Verificar se tabelas grupos e unidades existem
    const tabelas = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('unidades', 'grupos', 'usuarios_grupos')
    `);
    
    console.log('\n📊 Tabelas existentes:');
    if (tabelas.rows.length === 0) {
      console.log('   ❌ Nenhuma tabela de grupos/unidades encontrada');
    } else {
      tabelas.rows.forEach(t => console.log(`   ✅ ${t.table_name}`));
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

verificarEstrutura();
