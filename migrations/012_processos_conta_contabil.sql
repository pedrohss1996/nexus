-- Processo pode vincular a uma conta contábil (centro de custo do plano de contas)
ALTER TABLE processos
  ADD COLUMN IF NOT EXISTS conta_contabil_id INT REFERENCES contas_contabeis(id);

CREATE INDEX IF NOT EXISTS idx_processos_conta_contabil ON processos(conta_contabil_id);
COMMENT ON COLUMN processos.conta_contabil_id IS 'Conta contábil (centro de custo) do plano de contas da unidade';
