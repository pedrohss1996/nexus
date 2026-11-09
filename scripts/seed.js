require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

async function seed() {
  try {
    console.log('🌱 Iniciando seed do banco de dados...');

    // Criar usuário admin
    const senhaHash = await bcrypt.hash('admin123', 10);
    
    const adminExists = await query(
      'SELECT id FROM usuarios WHERE email = $1',
      ['admin@dataflow.com']
    );

    if (adminExists.rows.length === 0) {
      await query(
        `INSERT INTO usuarios (nome, email, login, senha, perfil, ativo)
         VALUES ($1, $2, $3, $4, $5, true)`,
        ['Administrador', 'admin@dataflow.com', 'admin', senhaHash, 'admin']
      );
      console.log('✅ Usuário admin criado: login "admin" / senha admin123 — troque a senha no primeiro acesso');
    } else {
      console.log('ℹ️  Usuário admin já existe');
    }

    // Vincular o admin a um grupo/unidade.
    // A migration 002 tenta fazer isso, mas roda ANTES do seed — em banco novo
    // o usuário ainda não existe e o vínculo nunca é criado.
    const vinculo = await query(
      `INSERT INTO usuarios_grupos (usuario_id, grupo_id, unidade_id, is_lider)
       SELECT u.id, g.id, g.unidade_id, true
       FROM usuarios u
       CROSS JOIN grupos g
       WHERE u.email = 'admin@dataflow.com' AND g.nome = 'Administração'
       ON CONFLICT DO NOTHING
       RETURNING id`
    );
    console.log(vinculo.rows.length > 0
      ? '✅ Admin vinculado ao grupo Administração'
      : 'ℹ️  Vínculo do admin já existe (ou grupo padrão ausente)');

    // Criar centro de custo exemplo
    const centroExists = await query(
      'SELECT id FROM centros_custo WHERE codigo = $1',
      ['CC001']
    );

    if (centroExists.rows.length === 0) {
      // unidade_id é obrigatório para o centro aparecer no dashboard, que passou
      // a filtrar por unidade — sem ele o registro fica invisível.
      await query(
        `INSERT INTO centros_custo (nome, codigo, valor_total, valor_utilizado, unidade_id, ativo)
         SELECT $1, $2, $3, $4, MIN(id), true FROM unidades WHERE ativo = true`,
        ['Centro de Custos Principal', 'CC001', 330000.00, 248500.00]
      );
      console.log('✅ Centro de custo exemplo criado');
    } else {
      console.log('ℹ️  Centro de custo já existe');
    }

    console.log('✅ Seed concluído com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro no seed:', error);
    process.exit(1);
  }
}

seed();
