-- Migration: Fornecedores completo (razão/fantasia, endereço, contatos, bancário, plano de contas, anexos)
-- Executar após 001 (fornecedores já existe com id, nome, cnpj, email, telefone, endereco, ativo, criado_em, atualizado_em)
-- CNPJ permanece UNIQUE; use como chave de negócio na aplicação.

-- Novas colunas: razão social e nome fantasia (nome atual vira nome_fantasia se não tiver)
ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS razao_social VARCHAR(255),
  ADD COLUMN IF NOT EXISTS nome_fantasia VARCHAR(255);

-- Inscrições
ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS inscricao_estadual VARCHAR(50),
  ADD COLUMN IF NOT EXISTS inscricao_municipal VARCHAR(50);

-- Endereço completo + geolocalização
ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS logradouro VARCHAR(255),
  ADD COLUMN IF NOT EXISTS numero VARCHAR(20),
  ADD COLUMN IF NOT EXISTS complemento VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bairro VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cidade VARCHAR(100),
  ADD COLUMN IF NOT EXISTS uf CHAR(2),
  ADD COLUMN IF NOT EXISTS cep VARCHAR(10),
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Contatos vendas e financeiro
ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS email_vendas VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_financeiro VARCHAR(255);

-- Dados bancários
ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS banco VARCHAR(100),
  ADD COLUMN IF NOT EXISTS agencia VARCHAR(20),
  ADD COLUMN IF NOT EXISTS conta VARCHAR(30);

-- Condição de pagamento padrão
ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS condicao_pagamento_padrao VARCHAR(100);

-- Vínculo com plano de contas (conta contábil da unidade; FK opcional se tabela contas_contabeis existir)
ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS conta_contabil_id INT;

-- Migrar nome antigo para nome_fantasia/razao_social se colunas novas estão vazias (opcional, em uma atualização)
-- UPDATE fornecedores SET nome_fantasia = nome WHERE nome_fantasia IS NULL AND nome IS NOT NULL;
-- UPDATE fornecedores SET razao_social = nome WHERE razao_social IS NULL AND nome IS NOT NULL;

-- Tabela de anexos do fornecedor
CREATE TABLE IF NOT EXISTS fornecedor_anexos (
  id SERIAL PRIMARY KEY,
  fornecedor_id INT NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  nome_original VARCHAR(255) NOT NULL,
  nome_arquivo VARCHAR(255) NOT NULL,
  caminho VARCHAR(500) NOT NULL,
  tipo VARCHAR(100),
  tamanho BIGINT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por INT REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_fornecedor_anexos_fornecedor ON fornecedor_anexos(fornecedor_id);
COMMENT ON TABLE fornecedor_anexos IS 'Anexos (documentos) vinculados ao fornecedor';
