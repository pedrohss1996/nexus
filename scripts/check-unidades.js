const { pool } = require('../config/database');

async function checkUnidades() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verificando unidades no banco...\n');
    
    // Contar todas as unidades
    const total = await client.query('SELECT COUNT(*) FROM unidades');
    console.log(`📊 Total de unidades: ${total.rows[0].count}`);
    
    // Contar unidades ativas
    const ativas = await client.query('SELECT COUNT(*) FROM unidades WHERE ativo = true');
    console.log(`✅ Unidades ativas: ${ativas.rows[0].count}`);
    
    // Listar todas as unidades
    const unidades = await client.query('SELECT id, nome, cd_tipo, ativo FROM unidades ORDER BY nome');
    console.log('\n📋 Lista de unidades:');
    unidades.rows.forEach(u => {
      console.log(`  ${u.ativo ? '✅' : '❌'} [${u.id}] ${u.nome} (Tipo: ${u.cd_tipo})`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkUnidades()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
