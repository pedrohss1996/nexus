// Script para corrigir a estrutura da tabela usuarios_grupos
require('dotenv').config();
const { query } = require('../config/database');

async function corrigirTabela() {
  try {
    console.log('🔧 Corrigindo estrutura da tabela usuarios_grupos...\n');

    // Adicionar coluna id (PRIMARY KEY)
    try {
      await query('ALTER TABLE usuarios_grupos ADD COLUMN id SERIAL PRIMARY KEY');
      console.log('✅ Coluna id adicionada');
    } catch (e) {
      console.log('⚠️  Coluna id já existe');
    }

    // Adicionar coluna unidade_id
    try {
      await query('ALTER TABLE usuarios_grupos ADD COLUMN unidade_id INT NOT NULL REFERENCES unidades(id) ON DELETE CASCADE');
      console.log('✅ Coluna unidade_id adicionada');
    } catch (e) {
      console.log('⚠️  Coluna unidade_id já existe');
    }

    // Adicionar coluna is_lider
    try {
      await query('ALTER TABLE usuarios_grupos ADD COLUMN is_lider BOOLEAN DEFAULT false');
      console.log('✅ Coluna is_lider adicionada');
    } catch (e) {
      console.log('⚠️  Coluna is_lider já existe');
    }

    // Adicionar coluna criado_em
    try {
      await query('ALTER TABLE usuarios_grupos ADD COLUMN criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
      console.log('✅ Coluna criado_em adicionada');
    } catch (e) {
      console.log('⚠️  Coluna criado_em já existe');
    }

    // Adicionar coluna criado_por
    try {
      await query('ALTER TABLE usuarios_grupos ADD COLUMN criado_por INT REFERENCES usuarios(id)');
      console.log('✅ Coluna criado_por adicionada');
    } catch (e) {
      console.log('⚠️  Coluna criado_por já existe');
    }

    // Criar índices
    try {
      await query('CREATE INDEX IF NOT EXISTS idx_usuarios_grupos_usuario ON usuarios_grupos(usuario_id)');
      await query('CREATE INDEX IF NOT EXISTS idx_usuarios_grupos_grupo ON usuarios_grupos(grupo_id)');
      await query('CREATE INDEX IF NOT EXISTS idx_usuarios_grupos_unidade ON usuarios_grupos(unidade_id)');
      console.log('✅ Índices criados');
    } catch (e) {
      console.log('⚠️  Índices já existem');
    }

    console.log('\n🎉 Tabela usuarios_grupos corrigida com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

corrigirTabela();
