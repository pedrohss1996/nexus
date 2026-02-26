-- Migration 017: Índices de performance faltantes
-- Execute: node scripts/run-migration.js 017 (ou psql -f migrations/017_performance_indexes.sql)

-- Índice em fluxo_etapas(proprietario_id) - usado em JOINs com grupos
CREATE INDEX IF NOT EXISTS idx_fluxo_etapas_proprietario ON fluxo_etapas(proprietario_id)
  WHERE proprietario_id IS NOT NULL;

-- Índice em grupos(unidade_id) - listagem de grupos por unidade é muito frequente
CREATE INDEX IF NOT EXISTS idx_grupos_unidade ON grupos(unidade_id);

-- Índice composto em usuarios_grupos - consultas por unidade e grupo
CREATE INDEX IF NOT EXISTS idx_usuarios_grupos_unidade ON usuarios_grupos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_grupos_grupo_unidade ON usuarios_grupos(grupo_id, unidade_id);

-- Índice em processos(fluxo_id) - navegação processo->fluxo
CREATE INDEX IF NOT EXISTS idx_processos_fluxo ON processos(fluxo_id)
  WHERE fluxo_id IS NOT NULL;

-- Índice em processos(status, ativo) - filtros comuns de listagem
CREATE INDEX IF NOT EXISTS idx_processos_status_ativo ON processos(status, ativo)
  WHERE ativo = true;

-- Índice em processos(criado_por) - dashboard e listagem "meus processos"
CREATE INDEX IF NOT EXISTS idx_processos_criado_por ON processos(criado_por);

-- Índice em tramitacoes(status, data_recebimento) - tramitações pendentes (dashboard)
CREATE INDEX IF NOT EXISTS idx_tramitacoes_pendentes ON tramitacoes(status, data_recebimento)
  WHERE status = 'enviado' AND data_recebimento IS NULL;

-- Índice em documentos_gerados(gerado_em) - contagem mensal no dashboard
CREATE INDEX IF NOT EXISTS idx_documentos_gerados_em ON documentos_gerados(gerado_em);

-- Índice em protocolos(status) - listagem por status
CREATE INDEX IF NOT EXISTS idx_protocolos_status_ativo ON protocolos(status)
  WHERE status NOT IN ('arquivado', 'encerrado');

-- Índice em assinaturas_digitais(validado) - contagem de pendentes
CREATE INDEX IF NOT EXISTS idx_assinaturas_pendentes ON assinaturas_digitais(validado)
  WHERE validado = false;

-- Índice em fluxo_etapa_anexos(etapa_id) - já existe via migration 016, garantindo aqui
CREATE INDEX IF NOT EXISTS idx_fluxo_etapa_anexos_etapa ON fluxo_etapa_anexos(etapa_id);

COMMENT ON INDEX idx_fluxo_etapas_proprietario IS 'Acelera JOINs de etapas com grupos';
COMMENT ON INDEX idx_grupos_unidade IS 'Acelera listagem de grupos por unidade';
COMMENT ON INDEX idx_tramitacoes_pendentes IS 'Acelera contagem de tramitações pendentes no dashboard';
