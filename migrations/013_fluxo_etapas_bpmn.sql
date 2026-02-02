-- Fluxo etapas: campos para designer BPMN (documentos, prazo, assinatura)
ALTER TABLE fluxo_etapas
  ADD COLUMN IF NOT EXISTS documentos_vinculados JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS prazo_em_dias INT,
  ADD COLUMN IF NOT EXISTS exige_assinatura BOOLEAN DEFAULT false;

COMMENT ON COLUMN fluxo_etapas.documentos_vinculados IS 'Lista de documentos a preencher na etapa, ex: [{"nome": "Formulário solicitação"}]';
COMMENT ON COLUMN fluxo_etapas.prazo_em_dias IS 'Prazo em dias para conclusão da etapa (SLA)';
COMMENT ON COLUMN fluxo_etapas.exige_assinatura IS 'Se a etapa exige assinatura do responsável';
