require('dotenv').config();
const { Pool } = require('pg');

console.log('🔍 Diagnóstico de Conexão com PostgreSQL\n');
console.log('📋 Variáveis de Ambiente:');
console.log(`   DB_HOST: ${process.env.DB_HOST || 'NÃO DEFINIDO (usando padrão: localhost)'}`);
console.log(`   DB_PORT: ${process.env.DB_PORT || 'NÃO DEFINIDO (usando padrão: 5432)'}`);
console.log(`   DB_NAME: ${process.env.DB_NAME || 'NÃO DEFINIDO (usando padrão: dataflow)'}`);
console.log(`   DB_USER: ${process.env.DB_USER || 'NÃO DEFINIDO (usando padrão: postgres)'}`);
console.log(`   DB_PASSWORD: ${process.env.DB_PASSWORD ? '✅ Definido' : '❌ NÃO DEFINIDO'}`);
console.log(`\n📊 Configuração da Conexão:`);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'dataflow',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
console.log(`   Porta: ${process.env.DB_PORT || 5432}`);
console.log(`   Banco: ${process.env.DB_NAME || 'dataflow'}`);
console.log(`   Usuário: ${process.env.DB_USER || 'postgres'}`);
console.log(`\n🔗 Testando conexão...`);

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Conexão bem-sucedida!\n');
    
    // Teste 1: Versão PostgreSQL
    const versionResult = await client.query('SELECT version();');
    console.log('📌 Informações do Banco:');
    console.log(`   ${versionResult.rows[0].version}\n`);
    
    // Teste 2: Listar tabelas
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('📚 Tabelas encontradas:');
    if (tablesResult.rows.length === 0) {
      console.log('   ⚠️  Nenhuma tabela encontrada. Execute: npm run migrate');
    } else {
      tablesResult.rows.forEach(row => {
        console.log(`   ✅ ${row.table_name}`);
      });
    }
    
    // Teste 3: Usuários
    const usersResult = await client.query('SELECT id, nome, email, perfil FROM usuarios LIMIT 5;');
    console.log(`\n👥 Usuários no banco (${usersResult.rows.length} encontrados):`);
    if (usersResult.rows.length > 0) {
      usersResult.rows.forEach(user => {
        console.log(`   - ${user.nome} (${user.email}) [${user.perfil}]`);
      });
    } else {
      console.log('   ⚠️  Nenhum usuário encontrado. Execute: npm run seed');
    }
    
    client.release();
    console.log('\n✅ Diagnóstico concluído com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao conectar:\n');
    console.error(`   Mensagem: ${error.message}`);
    console.error(`   Código: ${error.code}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Dica: O PostgreSQL não está rodando. Verifique:');
      console.error('   1. Se o PostgreSQL está iniciado');
      console.error('   2. Se a porta 5432 está acessível');
      console.error('   3. As credenciais no arquivo .env');
    } else if (error.code === '3D000') {
      console.error('\n💡 Dica: O banco de dados "dataflow" não existe. Execute:');
      console.error('   psql -U postgres -c "CREATE DATABASE dataflow;"');
    } else if (error.code === '28P01') {
      console.error('\n💡 Dica: Senha incorreta. Verifique DB_PASSWORD no arquivo .env');
    } else if (error.code === '28000') {
      console.error('\n💡 Dica: Acesso negado. Verifique usuário (DB_USER) no arquivo .env');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();
