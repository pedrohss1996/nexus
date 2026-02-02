-- Migration: Novo formulário de processo (número auto, observação, emergencial, data vencimento, fluxo)
-- Nº Processo gerado na aplicação (formato PROC-YYYY-NNNNN). Demais campos abaixo.

ALTER TABLE processos
  ADD COLUMN IF NOT EXISTS numero_processo VARCHAR(50) UNIQUE,
  ADD COLUMN IF NOT EXISTS descricao_detalhada TEXT,
  ADD COLUMN IF NOT EXISTS observacao TEXT,
  ADD COLUMN IF NOT EXISTS emergencial BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_vencimento DATE,
  ADD COLUMN IF NOT EXISTS fluxo_id INT REFERENCES fluxos(id);

CREATE INDEX IF NOT EXISTS idx_processos_numero ON processos(numero_processo);
CREATE INDEX IF NOT EXISTS idx_processos_fluxo ON processos(fluxo_id);
CREATE INDEX IF NOT EXISTS idx_processos_data_vencimento ON processos(data_vencimento);

COMMENT ON COLUMN processos.numero_processo IS 'Número único do processo (ex: PROC-2025-00001), gerado na aplicação';
COMMENT ON COLUMN processos.descricao_detalhada IS 'Descrição detalhada do processo';
COMMENT ON COLUMN processos.observacao IS 'Observações gerais';
COMMENT ON COLUMN processos.emergencial IS 'Se o processo é emergencial (sim/não)';
COMMENT ON COLUMN processos.data_vencimento IS 'Data de vencimento';
COMMENT ON COLUMN processos.fluxo_id IS 'Fluxo (workflow) que define os próximos passos';
