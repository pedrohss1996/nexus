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
        `INSERT INTO usuarios (nome, email, senha, perfil, ativo)
         VALUES ($1, $2, $3, $4, true)`,
        ['Administrador', 'admin@dataflow.com', senhaHash, 'admin']
      );
      console.log('✅ Usuário admin criado: admin@dataflow.com / admin123');
    } else {
      console.log('ℹ️  Usuário admin já existe');
    }

    // Criar centro de custo exemplo
    const centroExists = await query(
      'SELECT id FROM centros_custo WHERE codigo = $1',
      ['CC001']
    );

    if (centroExists.rows.length === 0) {
      await query(
        `INSERT INTO centros_custo (nome, codigo, valor_total, valor_utilizado, ativo)
         VALUES ($1, $2, $3, $4, true)`,
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
