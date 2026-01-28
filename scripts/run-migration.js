require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runMigration() {
  // Criar pool temporário para migration
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'dataflow',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  });

  const client = await pool.connect();
  
  try {
    console.log('🔄 Iniciando migration...');
    console.log(`📊 Conectado ao banco: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}\n`);
    
    // Ler o arquivo SQL
    const migrationPath = path.join(__dirname, '../migrations/001_create_tables.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Executar o SQL inteiro de uma vez
    // O PostgreSQL suporta múltiplos comandos separados por ponto e vírgula
    console.log('📝 Executando migration...\n');
    
    try {
      await client.query(sql);
      console.log('✅ Migration executada com sucesso!');
      console.log('\n📋 Próximos passos:');
      console.log('   1. Execute: npm run seed');
      console.log('   2. Inicie o servidor: npm run dev');
    } catch (error) {
      // Se der erro, tentar executar comando por comando
      if (error.message.includes('unterminated') || error.code === '42601') {
        console.log('⚠️  Erro ao executar SQL completo. Tentando executar comando por comando...\n');
        
        // Dividir por ponto e vírgula, mas preservar funções PL/pgSQL
        const commands = splitSQLCommands(sql);
        
        await client.query('BEGIN');
        
        for (let i = 0; i < commands.length; i++) {
          const command = commands[i].trim();
          
          if (!command || command.length < 5) continue;
          
          try {
            await client.query(command);
            const cmdType = command.split(/\s+/)[0].toUpperCase();
            console.log(`✅ [${i + 1}/${commands.length}] ${cmdType} executado`);
          } catch (cmdError) {
            // Ignorar erros de "já existe"
            if (cmdError.message.includes('already exists') || 
                cmdError.message.includes('duplicate') ||
                cmdError.code === '42P07' ||
                cmdError.code === '42710') {
              console.log(`⚠️  [${i + 1}/${commands.length}] Ignorado (já existe)`);
            } else {
              throw cmdError;
            }
          }
        }
        
        await client.query('COMMIT');
        console.log('\n✅ Migration executada com sucesso!');
        console.log('\n📋 Próximos passos:');
        console.log('   1. Execute: npm run seed');
        console.log('   2. Inicie o servidor: npm run dev');
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // Ignorar erro de rollback
    }
    console.error('\n❌ Erro na migration:', error.message);
    if (error.code) {
      console.error(`   Código: ${error.code}`);
    }
    if (error.detail) {
      console.error(`   Detalhes: ${error.detail}`);
    }
    if (error.position) {
      console.error(`   Posição: ${error.position}`);
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Função auxiliar para dividir comandos SQL respeitando dollar quoting
function splitSQLCommands(sql) {
  const commands = [];
  let currentCommand = '';
  let inDollarQuote = false;
  let dollarTag = '';
  let i = 0;
  
  while (i < sql.length) {
    const remaining = sql.substring(i);
    
    // Detectar início de dollar quote
    if (!inDollarQuote && sql[i] === '$') {
      const dollarMatch = remaining.match(/^\$([^$]*)\$/);
      if (dollarMatch) {
        dollarTag = dollarMatch[0];
        inDollarQuote = true;
        currentCommand += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }
    
    // Detectar fim de dollar quote
    if (inDollarQuote && remaining.startsWith(dollarTag)) {
      currentCommand += dollarTag;
      i += dollarTag.length;
      inDollarQuote = false;
      dollarTag = '';
      continue;
    }
    
    currentCommand += sql[i];
    
    // Se não estiver em dollar quote e encontrar ;, finalizar comando
    if (!inDollarQuote && sql[i] === ';') {
      const trimmed = currentCommand.trim();
      if (trimmed && trimmed.length > 5) {
        commands.push(trimmed);
      }
      currentCommand = '';
    }
    
    i++;
  }
  
  // Adicionar último comando se houver
  const trimmed = currentCommand.trim();
  if (trimmed && trimmed.length > 5) {
    commands.push(trimmed);
  }
  
  return commands;
}

// Verificar se as variáveis de ambiente estão configuradas
if (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USER) {
  console.error('❌ Erro: Variáveis de ambiente do banco de dados não configuradas!');
  console.error('   Verifique o arquivo .env');
  console.error('\n   Variáveis necessárias:');
  console.error('   - DB_HOST');
  console.error('   - DB_PORT');
  console.error('   - DB_NAME');
  console.error('   - DB_USER');
  console.error('   - DB_PASSWORD');
  process.exit(1);
}

runMigration().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
