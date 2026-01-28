// Script para popular dados iniciais de grupos e unidades
require('dotenv').config();
const { query } = require('../config/database');

async function seedGruposUnidades() {
  try {
    console.log('🌱 Populando dados iniciais...\n');

    // Inserir ou buscar unidades
    console.log('📍 Configurando unidades...');
    
    // Hospital São Lucas
    let hospitalResult = await query("SELECT id FROM unidades WHERE nome = 'Hospital São Lucas' LIMIT 1");
    if (hospitalResult.rows.length === 0) {
      hospitalResult = await query("INSERT INTO unidades (nome, cd_tipo, ativo) VALUES ('Hospital São Lucas', 1, true) RETURNING id");
      console.log(`   ✅ Hospital São Lucas criado (ID: ${hospitalResult.rows[0].id})`);
    } else {
      console.log(`   ✅ Hospital São Lucas encontrado (ID: ${hospitalResult.rows[0].id})`);
    }
    const hospitalId = hospitalResult.rows[0].id;

    // Clínica Ortopédica
    let clinicaResult = await query("SELECT id FROM unidades WHERE nome = 'Clínica Ortopédica' LIMIT 1");
    if (clinicaResult.rows.length === 0) {
      clinicaResult = await query("INSERT INTO unidades (nome, cd_tipo, ativo) VALUES ('Clínica Ortopédica', 2, true) RETURNING id");
      console.log(`   ✅ Clínica Ortopédica criada (ID: ${clinicaResult.rows[0].id})`);
    } else {
      console.log(`   ✅ Clínica Ortopédica encontrada (ID: ${clinicaResult.rows[0].id})`);
    }
    const clinicaId = clinicaResult.rows[0].id;

    // Departamento Administrativo
    let adminResult = await query("SELECT id FROM unidades WHERE nome = 'Departamento Administrativo' LIMIT 1");
    if (adminResult.rows.length === 0) {
      adminResult = await query("INSERT INTO unidades (nome, cd_tipo, ativo) VALUES ('Departamento Administrativo', 3, true) RETURNING id");
      console.log(`   ✅ Departamento Administrativo criado (ID: ${adminResult.rows[0].id})`);
    } else {
      console.log(`   ✅ Departamento Administrativo encontrado (ID: ${adminResult.rows[0].id})`);
    }
    const adminId = adminResult.rows[0].id;

    // Inserir grupos
    console.log('\n👥 Inserindo grupos...');
    const grupos = await query(`
      INSERT INTO grupos (nome, descricao, unidade_id, ativo)
      VALUES 
        ('Administração', 'Grupo de administradores do sistema', ${hospitalId}, true),
        ('Farmácia', 'Equipe da farmácia hospitalar', ${hospitalId}, true),
        ('Manutenção', 'Equipe de manutenção e infraestrutura', ${hospitalId}, true),
        ('Compras', 'Setor de compras e suprimentos', ${adminId}, true),
        ('Ortopedia', 'Equipe médica de ortopedia', ${clinicaId}, true),
        ('Enfermagem', 'Equipe de enfermagem', ${hospitalId}, true),
        ('Financeiro', 'Setor financeiro e contabilidade', ${adminId}, true),
        ('TI', 'Tecnologia da Informação', ${hospitalId}, true)
      ON CONFLICT DO NOTHING
      RETURNING id, nome, unidade_id
    `);

    if (grupos.rows.length > 0) {
      grupos.rows.forEach(g => console.log(`   ✅ ${g.nome} (ID: ${g.id}, Unidade: ${g.unidade_id})`));
    } else {
      console.log('   ⚠️  Grupos já existem');
    }

    // Buscar usuário admin
    const adminUser = await query("SELECT id FROM usuarios WHERE email = 'admin@dataflow.com' LIMIT 1");
    
    if (adminUser.rows.length > 0) {
      const adminUserId = adminUser.rows[0].id;
      
      // Vincular usuário admin aos grupos
      console.log('\n🔗 Vinculando usuário admin aos grupos...');
      const grupoAdmin = await query("SELECT id FROM grupos WHERE nome = 'Administração' LIMIT 1");
      const grupoTI = await query("SELECT id FROM grupos WHERE nome = 'TI' LIMIT 1");

      if (grupoAdmin.rows.length > 0) {
        await query(`
          INSERT INTO usuarios_grupos (usuario_id, grupo_id, unidade_id, is_lider)
          VALUES ($1, $2, $3, true)
          ON CONFLICT DO NOTHING
        `, [adminUserId, grupoAdmin.rows[0].id, hospitalId]);
        console.log('   ✅ Admin vinculado ao grupo Administração como líder');
      }

      if (grupoTI.rows.length > 0) {
        await query(`
          INSERT INTO usuarios_grupos (usuario_id, grupo_id, unidade_id, is_lider)
          VALUES ($1, $2, $3, true)
          ON CONFLICT DO NOTHING
        `, [adminUserId, grupoTI.rows[0].id, hospitalId]);
        console.log('   ✅ Admin vinculado ao grupo TI como líder');
      }
    } else {
      console.log('\n⚠️  Usuário admin não encontrado. Execute o seed principal primeiro.');
    }

    // Mostrar estatísticas
    console.log('\n📊 Estatísticas:');
    const stats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM unidades WHERE ativo = true) as total_unidades,
        (SELECT COUNT(*) FROM grupos WHERE ativo = true) as total_grupos,
        (SELECT COUNT(*) FROM usuarios_grupos) as total_vinculos
    `);
    
    console.log(`   📍 Unidades ativas: ${stats.rows[0].total_unidades}`);
    console.log(`   👥 Grupos ativos: ${stats.rows[0].total_grupos}`);
    console.log(`   🔗 Vínculos usuário-grupo: ${stats.rows[0].total_vinculos}`);

    console.log('\n🎉 Seed de grupos e unidades concluído com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    console.error('Detalhes:', error);
    process.exit(1);
  }
}

seedGruposUnidades();
