// Script para verificar a estrutura de todas as tabelas
require('dotenv').config();
const { query } = require('../config/database');

async function verificar() {
  try {
    console.log('🔍 Verificando estrutura das tabelas...\n');

    // Verificar unidades
    const unidades = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'unidades'
      ORDER BY ordinal_position
    `);
    console.log('📋 Tabela: unidades');
    unidades.rows.forEach(col => console.log(`   - ${col.column_name} (${col.data_type})`));

    // Verificar grupos
    const grupos = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'grupos'
      ORDER BY ordinal_position
    `);
    console.log('\n📋 Tabela: grupos');
    grupos.rows.forEach(col => console.log(`   - ${col.column_name} (${col.data_type})`));

    // Verificar usuarios_grupos
    const usuariosGrupos = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'usuarios_grupos'
      ORDER BY ordinal_position
    `);
    console.log('\n📋 Tabela: usuarios_grupos');
    usuariosGrupos.rows.forEach(col => console.log(`   - ${col.column_name} (${col.data_type})`));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

verificar();
