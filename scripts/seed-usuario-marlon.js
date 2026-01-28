// Script para criar usuário Marlon no banco de dados
require('dotenv').config();
const bcrypt = require('bcrypt');
const { query } = require('../config/database');

async function seedUsuarioMarlon() {
  try {
    console.log('🌱 Criando usuário Marlon...\n');

    // Verificar se usuário já existe
    const usuarioExistente = await query(
      'SELECT id, nome, email FROM usuarios WHERE email = $1',
      ['marlon@teste.com.br']
    );

    if (usuarioExistente.rows.length > 0) {
      console.log('⚠️  Usuário já existe:');
      console.log(`   ID: ${usuarioExistente.rows[0].id}`);
      console.log(`   Nome: ${usuarioExistente.rows[0].nome}`);
      console.log(`   Email: ${usuarioExistente.rows[0].email}`);
      console.log('\n💡 Se deseja atualizar a senha, delete o usuário primeiro ou use o script de alteração de senha.');
      process.exit(0);
    }

    // Hash da senha
    console.log('🔐 Gerando hash da senha...');
    const senhaHash = await bcrypt.hash('123456', 10);
    console.log('✅ Hash gerado com sucesso\n');

    // Criar usuário
    console.log('👤 Inserindo usuário no banco...');
    const resultado = await query(
      `INSERT INTO usuarios (nome, email, senha, perfil, ativo, criado_em, atualizado_em)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, nome, email, perfil, ativo, criado_em`,
      ['Marlon', 'marlon@teste.com.br', senhaHash, 'admin', true]
    );

    const usuario = resultado.rows[0];

    console.log('✅ Usuário criado com sucesso!\n');
    console.log('📋 Detalhes do usuário:');
    console.log('   ┌─────────────────────────────────────────┐');
    console.log(`   │ ID:      ${usuario.id.toString().padEnd(30)} │`);
    console.log(`   │ Nome:    ${usuario.nome.padEnd(30)} │`);
    console.log(`   │ Email:   ${usuario.email.padEnd(30)} │`);
    console.log(`   │ Perfil:  ${usuario.perfil.padEnd(30)} │`);
    console.log(`   │ Status:  ${(usuario.ativo ? 'Ativo' : 'Inativo').padEnd(30)} │`);
    console.log('   └─────────────────────────────────────────┘');
    console.log('\n🔑 Credenciais de acesso:');
    console.log('   ┌─────────────────────────────────────────┐');
    console.log('   │ Email:   marlon@teste.com.br            │');
    console.log('   │ Senha:   123456                         │');
    console.log('   └─────────────────────────────────────────┘');
    console.log('\n🎉 Pronto! Você já pode fazer login no sistema.');
    console.log('🌐 Acesse: http://localhost:3000/auth/login\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro ao criar usuário:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Dica: Verifique se o banco de dados está rodando e as credenciais no .env estão corretas.');
    } else if (error.code === '23505') {
      console.error('\n💡 Dica: Este email já está cadastrado no banco de dados.');
    } else if (error.code === '42P01') {
      console.error('\n💡 Dica: A tabela "usuarios" não existe. Execute a migration primeiro: npm run migrate');
    }
    
    console.error('\nDetalhes do erro:', error);
    process.exit(1);
  }
}

// Verificar variáveis de ambiente
if (!process.env.DB_PASSWORD) {
  console.error('❌ Erro: Variável DB_PASSWORD não configurada no .env');
  console.error('💡 Configure as variáveis de ambiente antes de executar este script.');
  process.exit(1);
}

console.log('🔄 Conectando ao banco de dados...');
console.log(`📊 Banco: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}\n`);

seedUsuarioMarlon();
