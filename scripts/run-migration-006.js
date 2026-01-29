const { exec } = require('child_process');
const path = require('path');

const migrationPath = path.join(__dirname, '..', 'migrations', '006-create-edoc-tables.js');

console.log('🚀 Executando migração 006 - Tabelas E-DOC...\n');

exec(`node "${migrationPath}"`, (error, stdout, stderr) => {
  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);
  
  if (error) {
    console.error(`\n❌ Erro ao executar migração: ${error.message}`);
    process.exit(1);
  } else {
    console.log('\n✅ Migração executada com sucesso!');
    process.exit(0);
  }
});
