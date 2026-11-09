-- ============================================================================
-- Migration 019: Isolamento multi-unidade
-- ============================================================================
-- Contexto: processos e documentos não possuíam coluna de unidade, então todas
-- as listagens retornavam dados de todas as unidades para qualquer usuário
-- autenticado. Esta migration cria a coluna, faz o backfill a partir do vínculo
-- de grupo do criador (usuarios_grupos.unidade_id) e indexa.
--
-- Linhas que não puderem ser atribuídas ficam com unidade_id NULL de propósito:
-- elas somem das listagens filtradas (fail-closed) em vez de vazarem para a
-- unidade errada. Use scripts/check-orfaos-unidade.js para triá-las.
-- ============================================================================

-- ── 1. Coluna de unidade nas tabelas centrais ───────────────────────────────
ALTER TABLE processos
  ADD COLUMN IF NOT EXISTS unidade_id INTEGER REFERENCES unidades(id);

ALTER TABLE documentos
  ADD COLUMN IF NOT EXISTS unidade_id INTEGER REFERENCES unidades(id);

-- ── 2. Backfill: processos herdam a unidade do criador ──────────────────────
-- Quando o criador pertence a mais de uma unidade, usa-se a de menor id
-- (vínculo mais antigo) — determinístico e auditável.
UPDATE processos p
SET unidade_id = sub.unidade_id
FROM (
  SELECT usuario_id, MIN(unidade_id) AS unidade_id
  FROM usuarios_grupos
  GROUP BY usuario_id
) sub
WHERE p.criado_por = sub.usuario_id
  AND p.unidade_id IS NULL;

-- ── 3. Backfill: documentos herdam a unidade do processo ────────────────────
UPDATE documentos d
SET unidade_id = p.unidade_id
FROM processos p
WHERE d.processo_id = p.id
  AND d.unidade_id IS NULL
  AND p.unidade_id IS NOT NULL;

-- Documentos sem processo: herdam do criador
UPDATE documentos d
SET unidade_id = sub.unidade_id
FROM (
  SELECT usuario_id, MIN(unidade_id) AS unidade_id
  FROM usuarios_grupos
  GROUP BY usuario_id
) sub
WHERE d.criado_por = sub.usuario_id
  AND d.unidade_id IS NULL;

-- ── 4. Backfill: documentos_gerados ─────────────────────────────────────────
-- A coluna já existia, mas o controller gravava req.user.unidade_id, campo que
-- nunca é carregado pelo authMiddleware — ou seja, sempre NULL.
UPDATE documentos_gerados dg
SET unidade_id = sub.unidade_id
FROM (
  SELECT usuario_id, MIN(unidade_id) AS unidade_id
  FROM usuarios_grupos
  GROUP BY usuario_id
) sub
WHERE dg.gerado_por = sub.usuario_id
  AND dg.unidade_id IS NULL;

-- ── 5. Índices ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_processos_unidade          ON processos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_processos_unidade_ativo    ON processos(unidade_id, ativo);
CREATE INDEX IF NOT EXISTS idx_documentos_unidade         ON documentos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_documentos_unidade_ativo   ON documentos(unidade_id, ativo);
CREATE INDEX IF NOT EXISTS idx_docgerados_unidade         ON documentos_gerados(unidade_id);

-- Acelera a resolução de unidades permitidas por usuário (loadUnidades)
CREATE INDEX IF NOT EXISTS idx_usuarios_grupos_usuario_unidade
  ON usuarios_grupos(usuario_id, unidade_id);

-- ── 6. Relatório de órfãos ──────────────────────────────────────────────────
DO $$
DECLARE
  orf_processos INT;
  orf_documentos INT;
  orf_gerados INT;
BEGIN
  SELECT COUNT(*) INTO orf_processos  FROM processos          WHERE unidade_id IS NULL;
  SELECT COUNT(*) INTO orf_documentos FROM documentos         WHERE unidade_id IS NULL;
  SELECT COUNT(*) INTO orf_gerados    FROM documentos_gerados WHERE unidade_id IS NULL;

  RAISE NOTICE 'Backfill concluído. Registros sem unidade (invisíveis nas listagens):';
  RAISE NOTICE '  processos.............: %', orf_processos;
  RAISE NOTICE '  documentos............: %', orf_documentos;
  RAISE NOTICE '  documentos_gerados....: %', orf_gerados;

  IF orf_processos + orf_documentos + orf_gerados > 0 THEN
    RAISE NOTICE 'Rode "npm run check:orfaos" para listar e atribuir manualmente.';
  END IF;
END $$;
