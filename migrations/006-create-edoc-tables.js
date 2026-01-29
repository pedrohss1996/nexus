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
    console.log('🚀 Iniciando migração 006 - Tabelas E-DOC...');
    
    await client.query('BEGIN');

    // 1. Tabela de Protocolos
    console.log('📋 Criando tabela protocolos...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS protocolos (
        id SERIAL PRIMARY KEY,
        numero_protocolo VARCHAR(50) UNIQUE NOT NULL,
        ano INTEGER NOT NULL,
        tipo_documento VARCHAR(100) NOT NULL,
        assunto TEXT NOT NULL,
        interessado VARCHAR(255),
        cpf_cnpj VARCHAR(20),
        origem VARCHAR(255),
        destino VARCHAR(255),
        prioridade VARCHAR(20) DEFAULT 'normal',
        status VARCHAR(50) DEFAULT 'aguardando',
        observacoes TEXT,
        documento_id INTEGER REFERENCES documentos_gerados(id),
        unidade_id INTEGER REFERENCES unidades(id),
        criado_por INTEGER REFERENCES usuarios(id),
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT prioridade_valida CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
        CONSTRAINT status_valido CHECK (status IN ('aguardando', 'em_tramite', 'arquivado', 'cancelado'))
      );
    `);

    // 2. Tabela de Tramitação
    console.log('🔄 Criando tabela tramitacoes...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS tramitacoes (
        id SERIAL PRIMARY KEY,
        protocolo_id INTEGER REFERENCES protocolos(id) ON DELETE CASCADE,
        unidade_origem_id INTEGER REFERENCES unidades(id),
        unidade_destino_id INTEGER REFERENCES unidades(id),
        usuario_origem_id INTEGER REFERENCES usuarios(id),
        usuario_destino_id INTEGER REFERENCES usuarios(id),
        tipo_tramitacao VARCHAR(50) NOT NULL,
        despacho TEXT,
        prazo_resposta DATE,
        data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_recebimento TIMESTAMP,
        status VARCHAR(50) DEFAULT 'pendente',
        anexos JSONB DEFAULT '[]'::jsonb,
        CONSTRAINT tipo_tramitacao_valido CHECK (tipo_tramitacao IN (
          'encaminhamento', 'devolucao', 'arquivamento', 'redistribuicao', 'ciencia'
        )),
        CONSTRAINT status_tramitacao_valido CHECK (status IN ('pendente', 'recebido', 'rejeitado'))
      );
    `);

    // 3. Tabela de Assinaturas Digitais
    console.log('✍️ Criando tabela assinaturas_digitais...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS assinaturas_digitais (
        id SERIAL PRIMARY KEY,
        documento_id INTEGER REFERENCES documentos_gerados(id) ON DELETE CASCADE,
        protocolo_id INTEGER REFERENCES protocolos(id),
        usuario_id INTEGER REFERENCES usuarios(id),
        tipo_assinatura VARCHAR(50) NOT NULL,
        hash_documento TEXT NOT NULL,
        certificado_digital TEXT,
        ip_assinante VARCHAR(50),
        localizacao VARCHAR(255),
        assinado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        validado BOOLEAN DEFAULT false,
        data_validacao TIMESTAMP,
        observacoes TEXT,
        CONSTRAINT tipo_assinatura_valido CHECK (tipo_assinatura IN (
          'simples', 'certificado_digital', 'gov_br', 'biometria'
        ))
      );
    `);

    // 4. Tabela de Arquivo Digital
    console.log('📦 Criando tabela arquivo_digital...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS arquivo_digital (
        id SERIAL PRIMARY KEY,
        protocolo_id INTEGER REFERENCES protocolos(id),
        documento_id INTEGER REFERENCES documentos_gerados(id),
        numero_caixa VARCHAR(50),
        localizacao_fisica VARCHAR(255),
        classificacao VARCHAR(100),
        temporalidade_anos INTEGER,
        data_arquivamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_eliminacao DATE,
        status VARCHAR(50) DEFAULT 'ativo',
        observacoes TEXT,
        arquivado_por INTEGER REFERENCES usuarios(id),
        unidade_id INTEGER REFERENCES unidades(id),
        palavras_chave TEXT[],
        CONSTRAINT status_arquivo_valido CHECK (status IN ('ativo', 'eliminado', 'transferido'))
      );
    `);

    // 5. Tabela de Histórico de Ações
    console.log('📜 Criando tabela historico_acoes...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS historico_acoes (
        id SERIAL PRIMARY KEY,
        protocolo_id INTEGER REFERENCES protocolos(id),
        documento_id INTEGER REFERENCES documentos_gerados(id),
        usuario_id INTEGER REFERENCES usuarios(id),
        acao VARCHAR(100) NOT NULL,
        descricao TEXT,
        dados_anteriores JSONB,
        dados_novos JSONB,
        ip_usuario VARCHAR(50),
        user_agent TEXT,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Índices para performance
    console.log('⚡ Criando índices...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_protocolos_numero ON protocolos(numero_protocolo);
      CREATE INDEX IF NOT EXISTS idx_protocolos_status ON protocolos(status);
      CREATE INDEX IF NOT EXISTS idx_protocolos_unidade ON protocolos(unidade_id);
      CREATE INDEX IF NOT EXISTS idx_tramitacoes_protocolo ON tramitacoes(protocolo_id);
      CREATE INDEX IF NOT EXISTS idx_tramitacoes_destino ON tramitacoes(unidade_destino_id);
      CREATE INDEX IF NOT EXISTS idx_assinaturas_documento ON assinaturas_digitais(documento_id);
      CREATE INDEX IF NOT EXISTS idx_arquivo_protocolo ON arquivo_digital(protocolo_id);
      CREATE INDEX IF NOT EXISTS idx_historico_protocolo ON historico_acoes(protocolo_id);
    `);

    // 7. Função para gerar número de protocolo
    console.log('🔢 Criando função de geração de protocolo...');
    await client.query(`
      CREATE OR REPLACE FUNCTION gerar_numero_protocolo()
      RETURNS VARCHAR AS $$
      DECLARE
        ano_atual INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
        sequencial INTEGER;
        numero_protocolo VARCHAR(50);
      BEGIN
        SELECT COALESCE(MAX(CAST(SUBSTRING(numero_protocolo FROM 1 FOR POSITION('/' IN numero_protocolo) - 1) AS INTEGER)), 0) + 1
        INTO sequencial
        FROM protocolos
        WHERE ano = ano_atual;
        
        numero_protocolo := LPAD(sequencial::TEXT, 6, '0') || '/' || ano_atual;
        
        RETURN numero_protocolo;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query('COMMIT');
    console.log('✅ Migração 006 concluída com sucesso!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro na migração 006:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('🎉 Todas as tabelas E-DOC foram criadas!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Falha na migração:', error);
    process.exit(1);
  });
