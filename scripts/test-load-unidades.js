const Unidade = require('../models/Unidade');

async function testLoadUnidades() {
  try {
    console.log('🧪 Testando carregamento de unidades...\n');
    
    const unidades = await Unidade.buscarTodas();
    console.log('✅ Unidades carregadas:', unidades.length);
    console.log('\n📋 Lista:');
    unidades.forEach(u => {
      console.log(`  - [${u.id}] ${u.nome} (Ativo: ${u.ativo})`);
    });
    
    console.log('\n✅ Teste concluído com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

testLoadUnidades();
