-- Migration 018: Adiciona coluna para armazenar caminho do PKCS#7 gerado pelo gov.br
-- e colunas de auditoria adicionais na tabela assinaturas_digitais

ALTER TABLE assinaturas_digitais
  ADD COLUMN IF NOT EXISTS govbr_pkcs7_path TEXT,
  ADD COLUMN IF NOT EXISTS govbr_state      TEXT,
  ADD COLUMN IF NOT EXISTS protocolo_texto  TEXT;

COMMENT ON COLUMN assinaturas_digitais.govbr_pkcs7_path IS 'Caminho relativo do arquivo .p7s gerado pela API gov.br';
COMMENT ON COLUMN assinaturas_digitais.govbr_state      IS 'State OAuth2 utilizado no fluxo gov.br';
COMMENT ON COLUMN assinaturas_digitais.protocolo_texto  IS 'Texto/descrição do que foi assinado para registro';
