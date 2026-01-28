// Script para criar as views de grupos e unidades
require('dotenv').config();
const { query } = require('../config/database');

async function criarViews() {
  try {
    console.log('🔄 Criando views...\n');

    // Remover views antigas
    await query('DROP VIEW IF EXISTS vw_usuarios_grupos_unidades CASCADE');
    await query('DROP VIEW IF EXISTS vw_grupos_estatisticas CASCADE');
    console.log('✅ Views antigas removidas\n');

    // Criar view: vw_usuarios_grupos_unidades
    await query(`
      CREATE VIEW vw_usuarios_grupos_unidades AS
      SELECT 
        u.id as usuario_id,
        u.nome as usuario_nome,
        u.email as usuario_email,
        u.perfil as usuario_perfil,
        g.id as grupo_id,
        g.nome as grupo_nome,
        g.descricao as grupo_descricao,
        un.id as unidade_id,
        un.nome as unidade_nome,
        un.cd_tipo as unidade_tipo,
        ug.is_lider,
        ug.criado_em as vinculo_criado_em
      FROM usuarios u
      INNER JOIN usuarios_grupos ug ON u.id = ug.usuario_id
      INNER JOIN grupos g ON ug.grupo_id = g.id
      INNER JOIN unidades un ON ug.unidade_id = un.id
      WHERE u.ativo = true AND g.ativo = true AND un.ativo = true
    `);
    console.log('✅ View criada: vw_usuarios_grupos_unidades');

    // Criar view: vw_grupos_estatisticas
    await query(`
      CREATE VIEW vw_grupos_estatisticas AS
      SELECT 
        g.id as grupo_id,
        g.nome as grupo_nome,
        g.descricao as grupo_descricao,
        un.id as unidade_id,
        un.nome as unidade_nome,
        COUNT(ug.usuario_id) as total_membros,
        COUNT(CASE WHEN ug.is_lider = true THEN 1 END) as total_lideres,
        g.ativo,
        g.criado_em
      FROM grupos g
      INNER JOIN unidades un ON g.unidade_id = un.id
      LEFT JOIN usuarios_grupos ug ON g.id = ug.grupo_id
      GROUP BY g.id, g.nome, g.descricao, un.id, un.nome, g.ativo, g.criado_em
    `);
    console.log('✅ View criada: vw_grupos_estatisticas\n');

    console.log('🎉 Views criadas com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

criarViews();
