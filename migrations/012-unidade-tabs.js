/**
 * Migration 012 – Tabelas complementares de Unidade
 * Cria: unidade_metas, unidade_obrigacoes, unidade_anexos,
 *       unidade_aditivos, unidade_historico
 */
const { pool } = require('../config/database');

async function up() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Metas ────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS unidade_metas (
        id              SERIAL PRIMARY KEY,
        unidade_id      INTEGER NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
        titulo          VARCHAR(255) NOT NULL,
        descricao       TEXT,
        indicador       VARCHAR(100),
        valor_meta      NUMERIC(15,2),
        valor_atual     NUMERIC(15,2) DEFAULT 0,
        unidade_medida  VARCHAR(50),
        data_inicio     DATE,
        data_fim        DATE,
        status          VARCHAR(30) DEFAULT 'em_andamento'
                          CHECK (status IN ('pendente','em_andamento','atingida','nao_atingida','cancelada')),
        criado_por      INTEGER REFERENCES usuarios(id),
        criado_em       TIMESTAMP DEFAULT NOW(),
        atualizado_em   TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_unidade_metas_unidade ON unidade_metas(unidade_id);`);

    // ── Obrigações ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS unidade_obrigacoes (
        id              SERIAL PRIMARY KEY,
        unidade_id      INTEGER NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
        titulo          VARCHAR(255) NOT NULL,
        descricao       TEXT,
        tipo            VARCHAR(50) DEFAULT 'legal'
                          CHECK (tipo IN ('fiscal','legal','contratual','trabalhista','ambiental','outro')),
        periodicidade   VARCHAR(30) DEFAULT 'unica'
                          CHECK (periodicidade IN ('diaria','semanal','mensal','bimestral','trimestral','semestral','anual','unica')),
        data_vencimento DATE,
        data_cumprimento DATE,
        status          VARCHAR(20) DEFAULT 'pendente'
                          CHECK (status IN ('pendente','cumprida','atrasada','cancelada')),
        responsavel     VARCHAR(150),
        criado_por      INTEGER REFERENCES usuarios(id),
        criado_em       TIMESTAMP DEFAULT NOW(),
        atualizado_em   TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_unidade_obrigacoes_unidade ON unidade_obrigacoes(unidade_id);`);

    // ── Anexos ───────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS unidade_anexos (
        id              SERIAL PRIMARY KEY,
        unidade_id      INTEGER NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
        nome            VARCHAR(255) NOT NULL,
        descricao       TEXT,
        arquivo_url     VARCHAR(500) NOT NULL,
        tipo_arquivo    VARCHAR(100),
        tamanho_kb      INTEGER,
        criado_por      INTEGER REFERENCES usuarios(id),
        criado_em       TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_unidade_anexos_unidade ON unidade_anexos(unidade_id);`);

    // ── Aditivos ─────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS unidade_aditivos (
        id                  SERIAL PRIMARY KEY,
        unidade_id          INTEGER NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
        numero              VARCHAR(50),
        titulo              VARCHAR(255) NOT NULL,
        descricao           TEXT,
        tipo                VARCHAR(50) DEFAULT 'prazo'
                              CHECK (tipo IN ('prazo','valor','escopo','prazo_valor','outro')),
        valor_original      NUMERIC(15,2),
        valor_aditado       NUMERIC(15,2),
        data_assinatura     DATE,
        data_vigencia_inicio DATE,
        data_vigencia_fim   DATE,
        arquivo_url         VARCHAR(500),
        criado_por          INTEGER REFERENCES usuarios(id),
        criado_em           TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_unidade_aditivos_unidade ON unidade_aditivos(unidade_id);`);

    // ── Histórico ────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS unidade_historico (
        id          SERIAL PRIMARY KEY,
        unidade_id  INTEGER NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
        descricao   TEXT NOT NULL,
        tipo_evento VARCHAR(50) DEFAULT 'edicao'
                      CHECK (tipo_evento IN ('criacao','edicao','contrato','aditivo','meta','obrigacao','anexo','centro_custo','outro')),
        dados_extras JSONB,
        usuario_id  INTEGER REFERENCES usuarios(id),
        criado_em   TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_unidade_historico_unidade ON unidade_historico(unidade_id);`);

    await client.query('COMMIT');
    console.log('Migration 012 executada com sucesso.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro na migration 012:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

up().catch(err => { console.error(err); process.exit(1); });
