const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('🚀 Migração 011 — Módulo de Notificações');
    await client.query('BEGIN');

    // ── 1. data_nascimento em usuarios ─────────────────────────────────────
    await client.query(`
      ALTER TABLE usuarios
        ADD COLUMN IF NOT EXISTS data_nascimento DATE;
    `);

    // ── 2. Tabela principal de notificações ────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS notificacoes (
        id            SERIAL PRIMARY KEY,
        titulo        VARCHAR(255) NOT NULL,
        mensagem      TEXT,
        imagem_url    VARCHAR(500),
        tipo          VARCHAR(50) DEFAULT 'manual',
        criado_por    INTEGER REFERENCES usuarios(id),
        criado_em     TIMESTAMP DEFAULT NOW(),
        ativo         BOOLEAN DEFAULT true
      );
    `);

    // ── 3. Destinatários por usuário ───────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS notificacoes_destinatarios (
        id              SERIAL PRIMARY KEY,
        notificacao_id  INTEGER NOT NULL REFERENCES notificacoes(id) ON DELETE CASCADE,
        usuario_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        lida            BOOLEAN DEFAULT false,
        lida_em         TIMESTAMP,
        UNIQUE(notificacao_id, usuario_id)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notif_dest_usuario ON notificacoes_destinatarios(usuario_id);
      CREATE INDEX IF NOT EXISTS idx_notif_dest_nao_lida ON notificacoes_destinatarios(usuario_id, lida)
        WHERE lida = false;
    `);

    await client.query('COMMIT');
    console.log('✅ Migração 011 concluída!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro migração 011:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
