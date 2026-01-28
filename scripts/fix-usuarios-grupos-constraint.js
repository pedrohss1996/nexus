const { pool } = require('../config/database');

async function fixConstraint() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Adicionando UNIQUE constraint em usuarios_grupos...');
    
    // Verificar se a constraint já existe
    const checkConstraint = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'usuarios_grupos' 
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'usuarios_grupos_unique';
    `);
    
    if (checkConstraint.rows.length > 0) {
      console.log('✅ Constraint já existe!');
      return;
    }
    
    // Remover duplicatas antes de adicionar a constraint (se houver)
    console.log('🧹 Removendo possíveis duplicatas...');
    await client.query(`
      DELETE FROM usuarios_grupos 
      WHERE ctid NOT IN (
        SELECT MIN(ctid)
        FROM usuarios_grupos
        GROUP BY usuario_id, grupo_id, unidade_id
      );
    `);
    
    // Adicionar a constraint UNIQUE
    console.log('➕ Adicionando constraint UNIQUE...');
    await client.query(`
      ALTER TABLE usuarios_grupos 
      ADD CONSTRAINT usuarios_grupos_unique 
      UNIQUE (usuario_id, grupo_id, unidade_id);
    `);
    
    console.log('✅ Constraint adicionada com sucesso!');
    
    // Verificar a estrutura final
    const result = await client.query(`
      SELECT 
        constraint_name, 
        constraint_type 
      FROM information_schema.table_constraints 
      WHERE table_name = 'usuarios_grupos'
      ORDER BY constraint_type;
    `);
    
    console.log('\n📊 Constraints da tabela usuarios_grupos:');
    result.rows.forEach(row => {
      console.log(`  - ${row.constraint_name} (${row.constraint_type})`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao adicionar constraint:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixConstraint()
  .then(() => {
    console.log('\n✅ Script concluído com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro ao executar script:', error);
    process.exit(1);
  });
