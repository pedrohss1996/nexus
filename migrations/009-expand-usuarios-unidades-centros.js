require('dotenv').config();

const { pool } = require('../config/database');

async function run() {
  const client = await pool.connect();
  try {
    console.log('🚀 Migração 009 — Expand usuarios + unidades + centros_custo');
    await client.query('BEGIN');

    // ── 1. Usuários: dados pessoais e endereço ──────────────────────────
    console.log('👤 Expandindo tabela usuarios...');
    await client.query(`
      ALTER TABLE usuarios
        ADD COLUMN IF NOT EXISTS cpf          VARCHAR(20),
        ADD COLUMN IF NOT EXISTS telefone     VARCHAR(25),
        ADD COLUMN IF NOT EXISTS cargo        VARCHAR(150),
        ADD COLUMN IF NOT EXISTS matricula    VARCHAR(50),
        ADD COLUMN IF NOT EXISTS cep          VARCHAR(10),
        ADD COLUMN IF NOT EXISTS logradouro   VARCHAR(255),
        ADD COLUMN IF NOT EXISTS numero       VARCHAR(20),
        ADD COLUMN IF NOT EXISTS complemento  VARCHAR(100),
        ADD COLUMN IF NOT EXISTS bairro       VARCHAR(100),
        ADD COLUMN IF NOT EXISTS cidade       VARCHAR(100),
        ADD COLUMN IF NOT EXISTS estado       CHAR(2);
    `);

    // ── 2. Unidades: dados contratuais e endereço ────────────────────────
    console.log('🏢 Expandindo tabela unidades...');
    await client.query(`
      ALTER TABLE unidades
        ADD COLUMN IF NOT EXISTS cnpj               VARCHAR(20),
        ADD COLUMN IF NOT EXISTS razao_social        VARCHAR(255),
        ADD COLUMN IF NOT EXISTS inscricao_estadual  VARCHAR(50),
        ADD COLUMN IF NOT EXISTS inscricao_municipal VARCHAR(50),
        ADD COLUMN IF NOT EXISTS responsavel_legal   VARCHAR(255),
        ADD COLUMN IF NOT EXISTS codigo_unidade      VARCHAR(50),
        ADD COLUMN IF NOT EXISTS site                VARCHAR(255),
        ADD COLUMN IF NOT EXISTS cep                 VARCHAR(10),
        ADD COLUMN IF NOT EXISTS numero              VARCHAR(20),
        ADD COLUMN IF NOT EXISTS complemento         VARCHAR(100),
        ADD COLUMN IF NOT EXISTS bairro              VARCHAR(100),
        ADD COLUMN IF NOT EXISTS cidade              VARCHAR(100),
        ADD COLUMN IF NOT EXISTS estado              CHAR(2);
    `);

    // ── 3. Centros de Custo: vincular a unidade ─────────────────────────
    console.log('💰 Expandindo tabela centros_custo...');
    await client.query(`
      ALTER TABLE centros_custo
        ADD COLUMN IF NOT EXISTS unidade_id    INTEGER REFERENCES unidades(id),
        ADD COLUMN IF NOT EXISTS descricao     TEXT,
        ADD COLUMN IF NOT EXISTS responsavel   VARCHAR(255),
        ADD COLUMN IF NOT EXISTS tipo          VARCHAR(50) DEFAULT 'operacional',
        ADD COLUMN IF NOT EXISTS criado_por    INTEGER REFERENCES usuarios(id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_centros_custo_unidade ON centros_custo(unidade_id);
    `);

    await client.query('COMMIT');
    console.log('✅ Migração 009 concluída!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro migração 009:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
