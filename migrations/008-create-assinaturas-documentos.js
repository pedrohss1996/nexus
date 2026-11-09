require('dotenv').config();

const { pool } = require('../config/database');

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🚀 Iniciando migração 008 - Assinaturas de Documentos...');
    await client.query('BEGIN');

    // 1. Colunas extras em documentos_gerados
    console.log('📄 Atualizando tabela documentos_gerados...');
    await client.query(`
      ALTER TABLE documentos_gerados
        ADD COLUMN IF NOT EXISTS conteudo_html    TEXT,
        ADD COLUMN IF NOT EXISTS token_assinatura VARCHAR(64) UNIQUE,
        ADD COLUMN IF NOT EXISTS status_assinatura VARCHAR(30) DEFAULT 'nao_requer';
    `);

    // 2. Tabela principal de assinaturas
    console.log('✍️  Criando tabela assinaturas_documentos...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS assinaturas_documentos (
        id                   SERIAL PRIMARY KEY,
        documento_gerado_id  INTEGER REFERENCES documentos_gerados(id) ON DELETE CASCADE,
        template_id          INTEGER REFERENCES templates_pdf(id),
        grupo_id             INTEGER REFERENCES grupos(id),
        placeholder_key      VARCHAR(100),
        usuario_id           INTEGER REFERENCES usuarios(id),
        nome_assinante       VARCHAR(255),
        cpf_assinante        VARCHAR(30),
        cargo_assinante      VARCHAR(255),
        ip_assinante         VARCHAR(60),
        data_hora            TIMESTAMPTZ,
        hash_documento       VARCHAR(64),
        hash_assinatura      VARCHAR(16) UNIQUE,
        status               VARCHAR(20) NOT NULL DEFAULT 'pendente',
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT status_valido CHECK (status IN ('pendente','assinado','recusado'))
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_assin_doc_documento  ON assinaturas_documentos(documento_gerado_id);
      CREATE INDEX IF NOT EXISTS idx_assin_doc_usuario    ON assinaturas_documentos(usuario_id);
      CREATE INDEX IF NOT EXISTS idx_assin_doc_hash       ON assinaturas_documentos(hash_assinatura);
      CREATE INDEX IF NOT EXISTS idx_assin_doc_status     ON assinaturas_documentos(status);
    `);

    await client.query('COMMIT');
    console.log('✅ Migração 008 concluída com sucesso!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro na migração 008:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
