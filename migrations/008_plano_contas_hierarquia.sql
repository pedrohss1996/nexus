-- Migration: Plano de Contas Hierárquico
-- Descrição: Adiciona parent_id, valor e ordem em contas_contabeis

ALTER TABLE contas_contabeis
  ADD COLUMN IF NOT EXISTS parent_id INT NULL REFERENCES contas_contabeis(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS valor DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ordem INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_contas_contabeis_parent ON contas_contabeis(parent_id);

COMMENT ON COLUMN contas_contabeis.parent_id IS 'Conta pai para hierarquia';
COMMENT ON COLUMN contas_contabeis.valor IS 'Valor orçado da conta';
COMMENT ON COLUMN contas_contabeis.ordem IS 'Ordem entre irmãos';
