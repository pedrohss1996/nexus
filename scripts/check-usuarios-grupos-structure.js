const { pool } = require('../config/database');

async function checkStructure() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verificando estrutura da tabela usuarios_grupos...\n');
    
    // Verificar colunas
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'usuarios_grupos'
      ORDER BY ordinal_position;
    `);
    
    console.log('📊 Colunas:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    // Verificar constraints
    const constraints = await client.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'usuarios_grupos'
      ORDER BY constraint_type;
    `);
    
    console.log('\n🔒 Constraints:');
    constraints.rows.forEach(con => {
      console.log(`  - ${con.constraint_name} (${con.constraint_type})`);
    });
    
    // Verificar dados existentes
    const data = await client.query('SELECT * FROM usuarios_grupos LIMIT 5');
    console.log(`\n📦 Registros existentes: ${data.rows.length}`);
    if (data.rows.length > 0) {
      console.log('Exemplo:', data.rows[0]);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkStructure()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
