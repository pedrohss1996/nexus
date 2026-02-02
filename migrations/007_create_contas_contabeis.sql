-- Migration: Contas contábeis por unidade
-- Descrição: Tabela de contas contábeis vinculadas a cada unidade

CREATE TABLE IF NOT EXISTS contas_contabeis (
  id SERIAL PRIMARY KEY,
  unidade_id INT NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  codigo VARCHAR(50) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por INT REFERENCES usuarios(id),
  UNIQUE(unidade_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_contas_contabeis_unidade ON contas_contabeis(unidade_id);
CREATE INDEX IF NOT EXISTS idx_contas_contabeis_ativo ON contas_contabeis(ativo);

COMMENT ON TABLE contas_contabeis IS 'Contas contábeis vinculadas a cada unidade';
