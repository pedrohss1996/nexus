-- Migration: Workflow Engine - Definição de Fluxos
-- Cada processo segue um fluxo. O fluxo define etapas, proprietários e regras de transição.

-- Tabela principal: definição do workflow (nome, descrição, versão, SLA)
CREATE TABLE IF NOT EXISTS fluxos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  slug VARCHAR(120) UNIQUE,
  descricao TEXT,
  versao VARCHAR(50) DEFAULT '1.0',
  criticidade_sla TEXT,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por INT REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_fluxos_ativo ON fluxos(ativo);
CREATE INDEX IF NOT EXISTS idx_fluxos_slug ON fluxos(slug);
COMMENT ON TABLE fluxos IS 'Definição de workflows (fluxos). Cada processo instancia um fluxo.';

-- Etapas do fluxo (Steps): proprietário, tipo de ação, campos requeridos (JSON Schema)
CREATE TABLE IF NOT EXISTS fluxo_etapas (
  id SERIAL PRIMARY KEY,
  fluxo_id INT NOT NULL REFERENCES fluxos(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  codigo VARCHAR(80) NOT NULL,
  ordem INT DEFAULT 0,
  eh_inicio BOOLEAN DEFAULT false,
  eh_fim BOOLEAN DEFAULT false,
  proprietario_tipo VARCHAR(50) NOT NULL DEFAULT 'grupo',
  proprietario_id INT,
  tipo_acao VARCHAR(50) NOT NULL DEFAULT 'formulario',
  campos_requeridos JSONB,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(fluxo_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_fluxo_etapas_fluxo ON fluxo_etapas(fluxo_id);
COMMENT ON TABLE fluxo_etapas IS 'Etapas dinâmicas do fluxo. proprietario_tipo: grupo, perfil. tipo_acao: formulario, aprovacao, parecer_tecnico, assinatura_digital.';

-- Regras de transição (Edges): de qual etapa, para qual etapa, condição (expressão)
CREATE TABLE IF NOT EXISTS fluxo_edges (
  id SERIAL PRIMARY KEY,
  fluxo_id INT NOT NULL REFERENCES fluxos(id) ON DELETE CASCADE,
  etapa_origem_id INT NOT NULL REFERENCES fluxo_etapas(id) ON DELETE CASCADE,
  etapa_destino_id INT NOT NULL REFERENCES fluxo_etapas(id) ON DELETE CASCADE,
  condicao_tipo VARCHAR(50) DEFAULT 'sempre',
  condicao_expressao TEXT,
  label VARCHAR(120),
  ordem INT DEFAULT 0,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fluxo_edges_fluxo ON fluxo_edges(fluxo_id);
CREATE INDEX IF NOT EXISTS idx_fluxo_edges_origem ON fluxo_edges(etapa_origem_id);
COMMENT ON TABLE fluxo_edges IS 'Regras de transição entre etapas. condicao_tipo: sempre, aprovado, reprovado, expressao.';
