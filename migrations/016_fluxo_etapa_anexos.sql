-- Anexos de arquivos nas etapas do fluxo
CREATE TABLE IF NOT EXISTS fluxo_etapa_anexos (
  id SERIAL PRIMARY KEY,
  etapa_id INT NOT NULL REFERENCES fluxo_etapas(id) ON DELETE CASCADE,
  nome_arquivo VARCHAR(255) NOT NULL,
  nome_original VARCHAR(255) NOT NULL,
  tamanho INT DEFAULT 0,
  tipo_mime VARCHAR(100),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fluxo_etapa_anexos_etapa ON fluxo_etapa_anexos(etapa_id);
COMMENT ON TABLE fluxo_etapa_anexos IS 'Arquivos anexados às etapas do fluxo (modelos, referências).';
