-- ============================================================================
-- Migration 022: execução de fluxo (runtime)
-- ============================================================================
-- Diagnóstico: o módulo de fluxos era só um editor. O desenho gravava etapas,
-- responsáveis, prazos, condições de transição e exigência de assinatura — e
-- nada disso era lido em tempo de execução. processos.fluxo_id era escrito na
-- criação e nunca mais consultado; o processo andava por dois botões
-- (aprovar/rejeitar) que ignoravam o fluxo inteiro.
--
-- Esta migration cria o estado que faltava: em que etapa cada processo está e
-- o histórico de quem fez o quê, quando e com qual decisão.
-- ============================================================================

-- ── Estado da instância no próprio processo ─────────────────────────────────
ALTER TABLE processos
  ADD COLUMN IF NOT EXISTS etapa_atual_id     INTEGER REFERENCES fluxo_etapas(id),
  ADD COLUMN IF NOT EXISTS fluxo_iniciado_em  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS fluxo_concluido_em TIMESTAMP;

COMMENT ON COLUMN processos.etapa_atual_id IS
  'Etapa em que o processo se encontra. NULL = fluxo não iniciado ou já concluído.';

-- ── Tarefas / histórico de execução ─────────────────────────────────────────
-- Uma linha por passagem por etapa. Serve ao mesmo tempo como caixa de tarefas
-- (status = pendente) e como trilha de auditoria (as concluídas permanecem).
CREATE TABLE IF NOT EXISTS processo_etapas (
  id             SERIAL PRIMARY KEY,
  processo_id    INTEGER NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  etapa_id       INTEGER NOT NULL REFERENCES fluxo_etapas(id),
  status         VARCHAR(20) NOT NULL DEFAULT 'pendente',
  decisao        VARCHAR(20),
  observacao     TEXT,
  prazo          TIMESTAMP,
  responsavel_id INTEGER REFERENCES usuarios(id),
  iniciada_em    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  concluida_em   TIMESTAMP,

  CONSTRAINT processo_etapas_status_valido
    CHECK (status IN ('pendente', 'concluida', 'rejeitada', 'cancelada')),
  CONSTRAINT processo_etapas_decisao_valida
    CHECK (decisao IS NULL OR decisao IN ('aprovado', 'reprovado'))
);

COMMENT ON TABLE processo_etapas IS
  'Execução do fluxo: uma linha por passagem do processo por uma etapa. status=pendente é tarefa aberta.';

-- Impede duas tarefas abertas na mesma etapa do mesmo processo (reentrada em
-- loop cria uma nova só depois que a anterior fecha).
CREATE UNIQUE INDEX IF NOT EXISTS idx_processo_etapas_pendente_unica
  ON processo_etapas(processo_id, etapa_id)
  WHERE status = 'pendente';

CREATE INDEX IF NOT EXISTS idx_processo_etapas_processo ON processo_etapas(processo_id);
CREATE INDEX IF NOT EXISTS idx_processo_etapas_etapa    ON processo_etapas(etapa_id);
-- Caixa de tarefas: busca as pendentes por etapa
CREATE INDEX IF NOT EXISTS idx_processo_etapas_abertas
  ON processo_etapas(etapa_id, prazo) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_processos_etapa_atual ON processos(etapa_atual_id);

-- ── Fluxos passam a pertencer a uma unidade ─────────────────────────────────
-- fluxos era global enquanto grupos são por unidade, então o editor oferecia
-- grupos de uma unidade para um fluxo compartilhado por todas.
ALTER TABLE fluxos
  ADD COLUMN IF NOT EXISTS unidade_id INTEGER REFERENCES unidades(id);

CREATE INDEX IF NOT EXISTS idx_fluxos_unidade ON fluxos(unidade_id);

-- Backfill: herda a unidade do grupo da primeira etapa; se não der, do criador
UPDATE fluxos f
SET unidade_id = sub.unidade_id
FROM (
  SELECT DISTINCT ON (e.fluxo_id) e.fluxo_id, g.unidade_id
  FROM fluxo_etapas e
  JOIN grupos g ON g.id = e.proprietario_id AND e.proprietario_tipo = 'grupo'
  WHERE g.unidade_id IS NOT NULL
  ORDER BY e.fluxo_id, e.ordem
) sub
WHERE f.id = sub.fluxo_id AND f.unidade_id IS NULL;

UPDATE fluxos f
SET unidade_id = sub.unidade_id
FROM (
  SELECT usuario_id, MIN(unidade_id) AS unidade_id FROM usuarios_grupos GROUP BY usuario_id
) sub
WHERE f.criado_por = sub.usuario_id AND f.unidade_id IS NULL;

-- ── Relatório ───────────────────────────────────────────────────────────────
DO $$
DECLARE
  sem_unidade INT;
  sem_inicio  INT;
BEGIN
  SELECT COUNT(*) INTO sem_unidade FROM fluxos WHERE unidade_id IS NULL AND ativo = true;
  SELECT COUNT(*) INTO sem_inicio FROM fluxos f
    WHERE f.ativo = true
      AND NOT EXISTS (SELECT 1 FROM fluxo_etapas e WHERE e.fluxo_id = f.id AND e.eh_inicio);

  RAISE NOTICE 'Execução de fluxo instalada.';
  RAISE NOTICE '  fluxos sem unidade definida : %', sem_unidade;
  RAISE NOTICE '  fluxos sem etapa inicial    : % (não podem ser iniciados)', sem_inicio;
END $$;
