const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Iniciando migração 007 - Tabelas de Contratos...');

    await client.query('BEGIN');

    // 1. Tabela principal de contratos
    console.log('📄 Criando tabela contratos...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS contratos (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(50) UNIQUE NOT NULL,
        nome VARCHAR(255) NOT NULL,
        tipo VARCHAR(30) NOT NULL,
        descricao TEXT,
        fornecedor_id INTEGER REFERENCES fornecedores(id),
        empresa_contratada VARCHAR(255),
        responsavel_interno_id INTEGER REFERENCES usuarios(id),
        departamento_responsavel VARCHAR(255),
        valor_total NUMERIC(14,2),
        valor_mensal NUMERIC(14,2),
        moeda VARCHAR(10) DEFAULT 'BRL',
        forma_pagamento VARCHAR(100),
        indice_reajuste VARCHAR(20),
        indice_reajuste_outro VARCHAR(100),
        data_inicio DATE,
        data_termino DATE,
        prazo_meses INTEGER,
        data_proximo_reajuste DATE,
        status VARCHAR(20) DEFAULT 'ativo',
        unidade_id INTEGER REFERENCES unidades(id),
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT tipo_contrato_valido CHECK (tipo IN ('prestacao_servico','fornecimento','locacao','terceirizacao')),
        CONSTRAINT status_contrato_valido CHECK (status IN ('ativo','suspenso','encerrado','em_renovacao')),
        CONSTRAINT indice_reajuste_valido CHECK (indice_reajuste IN ('IPCA','IGPM','OUTRO'))
      );
    `);

    // 2. Obrigações contratuais
    console.log('✅ Criando tabela contrato_obrigacoes...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS contrato_obrigacoes (
        id SERIAL PRIMARY KEY,
        contrato_id INTEGER NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
        descricao TEXT NOT NULL,
        responsavel_id INTEGER REFERENCES usuarios(id),
        prazo DATE,
        frequencia VARCHAR(20),
        status VARCHAR(20) DEFAULT 'pendente',
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT frequencia_obrigacao_valida CHECK (frequencia IN ('mensal','trimestral','anual')),
        CONSTRAINT status_obrigacao_valida CHECK (status IN ('pendente','concluido','atrasado'))
      );
    `);

    // 3. Pagamentos / controle financeiro
    console.log('💰 Criando tabela contrato_pagamentos...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS contrato_pagamentos (
        id SERIAL PRIMARY KEY,
        contrato_id INTEGER NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
        data_pagamento DATE NOT NULL,
        valor_pago NUMERIC(14,2) NOT NULL,
        numero_nota VARCHAR(100),
        responsavel_aprovacao_id INTEGER REFERENCES usuarios(id),
        status VARCHAR(20) DEFAULT 'pago',
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT status_pagamento_valido CHECK (status IN ('pendente','pago','atrasado','cancelado'))
      );
    `);

    // 4. Indicadores de SLA
    console.log('📊 Criando tabela contrato_slas...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS contrato_slas (
        id SERIAL PRIMARY KEY,
        contrato_id INTEGER NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
        nome_indicador VARCHAR(255) NOT NULL,
        meta NUMERIC(10,2),
        valor_medido NUMERIC(10,2),
        data_medicao DATE NOT NULL,
        status VARCHAR(20) NOT NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT status_sla_valido CHECK (status IN ('dentro','fora'))
      );
    `);

    // 5. Aditivos contratuais
    console.log('📝 Criando tabela contrato_aditivos...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS contrato_aditivos (
        id SERIAL PRIMARY KEY,
        contrato_id INTEGER NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
        tipo VARCHAR(30) NOT NULL,
        data_aditivo DATE NOT NULL,
        novo_valor NUMERIC(14,2),
        nova_data_termino DATE,
        descricao TEXT,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT tipo_aditivo_valido CHECK (tipo IN ('prorrogacao','alteracao_valor','alteracao_escopo'))
      );
    `);

    // 6. Anexos de contratos (PDF, documentos relacionados)
    console.log('📎 Criando tabela contrato_anexos...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS contrato_anexos (
        id SERIAL PRIMARY KEY,
        contrato_id INTEGER NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
        nome_original VARCHAR(255),
        nome_arquivo VARCHAR(255) NOT NULL,
        caminho VARCHAR(255) NOT NULL,
        tipo VARCHAR(100),
        tamanho INTEGER,
        criado_por INTEGER REFERENCES usuarios(id),
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Auditoria de alterações de contratos
    console.log('📚 Criando tabela contratos_auditoria...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS contratos_auditoria (
        id SERIAL PRIMARY KEY,
        contrato_id INTEGER NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
        usuario_id INTEGER REFERENCES usuarios(id),
        campo VARCHAR(100) NOT NULL,
        valor_anterior TEXT,
        valor_novo TEXT,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 8. Índices para performance e alertas
    console.log('⚡ Criando índices de contratos...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_contratos_status ON contratos(status);
      CREATE INDEX IF NOT EXISTS idx_contratos_data_termino ON contratos(data_termino);
      CREATE INDEX IF NOT EXISTS idx_contratos_fornecedor ON contratos(fornecedor_id);
      CREATE INDEX IF NOT EXISTS idx_contrato_obrigacoes_status ON contrato_obrigacoes(status, prazo);
      CREATE INDEX IF NOT EXISTS idx_contrato_slas_status ON contrato_slas(status);
    `);

    await client.query('COMMIT');
    console.log('✅ Migração 007 concluída com sucesso!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro na migração 007:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('🎉 Todas as tabelas de contratos foram criadas!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Falha na migração 007:', error);
    process.exit(1);
  });

