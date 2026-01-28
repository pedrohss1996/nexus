-- Migration: Criação das tabelas principais do DataFlow
-- Executar este script no PostgreSQL

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  senha VARCHAR(255) NOT NULL,
  perfil VARCHAR(50) NOT NULL DEFAULT 'usuario', -- usuario, gestor, admin
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de centros de custo
CREATE TABLE IF NOT EXISTS centros_custo (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  codigo VARCHAR(50) UNIQUE,
  valor_total DECIMAL(15, 2) DEFAULT 0,
  valor_utilizado DECIMAL(15, 2) DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de fornecedores
CREATE TABLE IF NOT EXISTS fornecedores (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cnpj VARCHAR(18) UNIQUE,
  email VARCHAR(255),
  telefone VARCHAR(20),
  endereco TEXT,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de processos
CREATE TABLE IF NOT EXISTS processos (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  centro_custo_id INTEGER REFERENCES centros_custo(id),
  fornecedor_id INTEGER REFERENCES fornecedores(id),
  valor DECIMAL(15, 2),
  status VARCHAR(50) DEFAULT 'pendente', -- pendente, em_analise, aprovado, rejeitado, requer_atencao
  criado_por INTEGER REFERENCES usuarios(id) NOT NULL,
  aprovado_por INTEGER REFERENCES usuarios(id),
  rejeitado_por INTEGER REFERENCES usuarios(id),
  motivo_rejeicao TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  aprovado_em TIMESTAMP,
  rejeitado_em TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ativo BOOLEAN DEFAULT true
);

-- Tabela de documentos
CREATE TABLE IF NOT EXISTS documentos (
  id SERIAL PRIMARY KEY,
  processo_id INTEGER REFERENCES processos(id),
  nome_original VARCHAR(255) NOT NULL,
  nome_arquivo VARCHAR(255) NOT NULL,
  caminho VARCHAR(500) NOT NULL,
  tipo VARCHAR(100),
  tamanho BIGINT,
  status VARCHAR(50) DEFAULT 'pendente', -- pendente, em_analise, aprovado, rejeitado, enviado, arquivado
  observacoes TEXT,
  criado_por INTEGER REFERENCES usuarios(id) NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ativo BOOLEAN DEFAULT true
);

-- Tabela de notas fiscais
CREATE TABLE IF NOT EXISTS notas_fiscais (
  id SERIAL PRIMARY KEY,
  processo_id INTEGER REFERENCES processos(id),
  fornecedor_id INTEGER REFERENCES fornecedores(id),
  numero VARCHAR(50) NOT NULL,
  serie VARCHAR(10),
  valor DECIMAL(15, 2) NOT NULL,
  data_emissao DATE,
  data_vencimento DATE,
  status VARCHAR(50) DEFAULT 'pendente', -- pendente, paga, vencida, cancelada
  caminho_arquivo VARCHAR(500),
  criado_por INTEGER REFERENCES usuarios(id) NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ativo BOOLEAN DEFAULT true
);

-- Tabela de anexos
CREATE TABLE IF NOT EXISTS anexos (
  id SERIAL PRIMARY KEY,
  processo_id INTEGER REFERENCES processos(id),
  documento_id INTEGER REFERENCES documentos(id),
  nome_original VARCHAR(255) NOT NULL,
  nome_arquivo VARCHAR(255) NOT NULL,
  caminho VARCHAR(500) NOT NULL,
  tipo VARCHAR(100),
  tamanho BIGINT,
  criado_por INTEGER REFERENCES usuarios(id) NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ativo BOOLEAN DEFAULT true
);

-- Tabela de auditoria (logs de ações importantes)
CREATE TABLE IF NOT EXISTS auditoria (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id),
  acao VARCHAR(100) NOT NULL,
  tabela VARCHAR(100),
  registro_id INTEGER,
  dados_anteriores JSONB,
  dados_novos JSONB,
  ip VARCHAR(45),
  user_agent TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_processos_status ON processos(status);
CREATE INDEX IF NOT EXISTS idx_processos_criado_por ON processos(criado_por);
CREATE INDEX IF NOT EXISTS idx_processos_centro_custo ON processos(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_documentos_processo ON documentos(processo_id);
CREATE INDEX IF NOT EXISTS idx_documentos_status ON documentos(status);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_criado_em ON auditoria(criado_em);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processos_updated_at BEFORE UPDATE ON processos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documentos_updated_at BEFORE UPDATE ON documentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fornecedores_updated_at BEFORE UPDATE ON fornecedores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_centros_custo_updated_at BEFORE UPDATE ON centros_custo
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- NOTA: Execute o script de seed após criar as tabelas:
-- node scripts/seed.js
-- Isso criará o usuário admin (admin@dataflow.com / admin123) e dados iniciais
