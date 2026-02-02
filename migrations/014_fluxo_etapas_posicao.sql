-- Posição visual dos nós no designer (estilo n8n)
ALTER TABLE fluxo_etapas
  ADD COLUMN IF NOT EXISTS pos_x INT,
  ADD COLUMN IF NOT EXISTS pos_y INT;

COMMENT ON COLUMN fluxo_etapas.pos_x IS 'Posição X do nó no canvas (pixels)';
COMMENT ON COLUMN fluxo_etapas.pos_y IS 'Posição Y do nó no canvas (pixels)';
