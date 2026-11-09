-- ============================================================================
-- Migration 020: Índices em foreign keys consultadas
-- ============================================================================
-- O banco tinha 51 FKs sem índice. As mais custosas são as tabelas filhas de
-- contratos: a tela de detalhes dispara 8 queries filtrando por contrato_id e
-- todas caíam em Seq Scan (medido: 2ms para devolver 20 de 40.000 linhas, com
-- crescimento linear).
--
-- Índice em FK também importa para escrita: sem ele, todo DELETE/UPDATE na
-- tabela pai varre a filha inteira para validar a constraint.
--
-- Indexadas aqui apenas as FKs efetivamente usadas em WHERE/JOIN pelo código
-- ou necessárias para integridade referencial em cascata — não as 51.
-- ============================================================================

-- ── Contratos: tabelas filhas (tela de detalhes) ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contrato_obrigacoes_contrato ON contrato_obrigacoes(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contrato_pagamentos_contrato ON contrato_pagamentos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contrato_slas_contrato       ON contrato_slas(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contrato_aditivos_contrato   ON contrato_aditivos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contrato_anexos_contrato     ON contrato_anexos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contratos_auditoria_contrato ON contratos_auditoria(contrato_id);

-- ── Contratos: filtros da listagem ──────────────────────────────────────────
-- unidade_id passou a ser filtro obrigatório no isolamento multi-unidade
CREATE INDEX IF NOT EXISTS idx_contratos_unidade        ON contratos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_contratos_unidade_status ON contratos(unidade_id, status);
CREATE INDEX IF NOT EXISTS idx_contratos_fornecedor     ON contratos(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_contratos_responsavel    ON contratos(responsavel_interno_id);
-- Alertas: contratos vencendo / com reajuste próximo
CREATE INDEX IF NOT EXISTS idx_contratos_data_termino   ON contratos(data_termino) WHERE status = 'ativo';

-- ── Processos e anexos ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_processos_fornecedor  ON processos(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_anexos_processo       ON anexos(processo_id);
CREATE INDEX IF NOT EXISTS idx_anexos_documento      ON anexos(documento_id);
CREATE INDEX IF NOT EXISTS idx_documentos_processo   ON documentos(processo_id);
CREATE INDEX IF NOT EXISTS idx_documentos_criado_por ON documentos(criado_por);

-- ── Notas fiscais ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_processo   ON notas_fiscais(processo_id);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_fornecedor ON notas_fiscais(fornecedor_id);

-- ── Assinaturas ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_assin_digitais_protocolo ON assinaturas_digitais(protocolo_id);
CREATE INDEX IF NOT EXISTS idx_assin_digitais_usuario   ON assinaturas_digitais(usuario_id);
CREATE INDEX IF NOT EXISTS idx_assin_docs_grupo         ON assinaturas_documentos(grupo_id);
CREATE INDEX IF NOT EXISTS idx_assin_docs_template      ON assinaturas_documentos(template_id);
CREATE INDEX IF NOT EXISTS idx_docgerados_gerado_por    ON documentos_gerados(gerado_por);

-- ── Protocolos, tramitações e arquivo digital ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_protocolos_documento       ON protocolos(documento_id);
CREATE INDEX IF NOT EXISTS idx_tramitacoes_protocolo      ON tramitacoes(protocolo_id);
CREATE INDEX IF NOT EXISTS idx_tramitacoes_unid_origem    ON tramitacoes(unidade_origem_id);
CREATE INDEX IF NOT EXISTS idx_tramitacoes_unid_destino   ON tramitacoes(unidade_destino_id);
CREATE INDEX IF NOT EXISTS idx_arquivo_digital_documento  ON arquivo_digital(documento_id);
CREATE INDEX IF NOT EXISTS idx_arquivo_digital_unidade    ON arquivo_digital(unidade_id);
CREATE INDEX IF NOT EXISTS idx_historico_acoes_documento  ON historico_acoes(documento_id);
CREATE INDEX IF NOT EXISTS idx_historico_acoes_usuario    ON historico_acoes(usuario_id);

-- ── Fluxos ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fluxo_edges_destino ON fluxo_edges(etapa_destino_id);

-- ── Centros de custo e anexos de fornecedor ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_centros_custo_unidade_ativo ON centros_custo(unidade_id, ativo);
CREATE INDEX IF NOT EXISTS idx_fornecedor_anexos_forn      ON fornecedor_anexos(fornecedor_id);

-- ── Ordenação das listagens paginadas ───────────────────────────────────────
-- As listagens ordenam por data desc dentro da unidade; o índice composto
-- evita o Sort quando a paginação pede só a primeira página.
CREATE INDEX IF NOT EXISTS idx_processos_unidade_criado  ON processos(unidade_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_documentos_unidade_criado ON documentos(unidade_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_contratos_unidade_criado  ON contratos(unidade_id, criado_em DESC);
