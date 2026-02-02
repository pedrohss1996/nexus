-- Grupos que fazem parte de cada fluxo (quais setores/raias aparecem no processo)
CREATE TABLE IF NOT EXISTS fluxo_grupos (
  fluxo_id INT NOT NULL REFERENCES fluxos(id) ON DELETE CASCADE,
  grupo_id INT NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  PRIMARY KEY (fluxo_id, grupo_id)
);

CREATE INDEX IF NOT EXISTS idx_fluxo_grupos_fluxo ON fluxo_grupos(fluxo_id);
CREATE INDEX IF NOT EXISTS idx_fluxo_grupos_grupo ON fluxo_grupos(grupo_id);
COMMENT ON TABLE fluxo_grupos IS 'Grupos (setores) que participam do fluxo; só essas raias aparecem na configuração.';
