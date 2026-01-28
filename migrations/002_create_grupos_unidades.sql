-- Migration: Criação de tabelas de Grupos e Unidades
-- Data: 2026-01-27
-- Descrição: Estrutura para gerenciar grupos, unidades e seus vínculos com usuários

-- ============================================
-- TABELA: unidades
-- Descrição: Armazena as unidades hospitalares/departamentos
-- ============================================
CREATE TABLE IF NOT EXISTS unidades (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cd_tipo INT NOT NULL DEFAULT 1, -- 1=Hospital, 2=Clínica, 3=Departamento, etc
  descricao TEXT,
  endereco VARCHAR(255),
  telefone VARCHAR(20),
  email VARCHAR(255),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por INT REFERENCES usuarios(id)
);

-- ============================================
-- TABELA: grupos
-- Descrição: Armazena os grupos de usuários (equipes, setores, etc)
-- ============================================
CREATE TABLE IF NOT EXISTS grupos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  unidade_id INT NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por INT REFERENCES usuarios(id)
);

-- ============================================
-- TABELA: usuarios_grupos
-- Descrição: Relacionamento N:N entre usuários e grupos
-- ============================================
CREATE TABLE IF NOT EXISTS usuarios_grupos (
  id SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  grupo_id INT NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  unidade_id INT NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  is_lider BOOLEAN DEFAULT false, -- Define se o usuário é líder do grupo
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por INT REFERENCES usuarios(id),
  UNIQUE(usuario_id, grupo_id, unidade_id) -- Evita duplicatas
);

-- ============================================
-- ÍNDICES para melhor performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_unidades_ativo ON unidades(ativo);
CREATE INDEX IF NOT EXISTS idx_unidades_cd_tipo ON unidades(cd_tipo);
CREATE INDEX IF NOT EXISTS idx_grupos_unidade ON grupos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_grupos_ativo ON grupos(ativo);
CREATE INDEX IF NOT EXISTS idx_usuarios_grupos_usuario ON usuarios_grupos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_grupos_grupo ON usuarios_grupos(grupo_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_grupos_unidade ON usuarios_grupos(unidade_id);

-- ============================================
-- TRIGGERS para atualização automática de timestamps
-- ============================================
CREATE OR REPLACE FUNCTION atualizar_timestamp_unidades()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_unidades
BEFORE UPDATE ON unidades
FOR EACH ROW
EXECUTE FUNCTION atualizar_timestamp_unidades();

CREATE OR REPLACE FUNCTION atualizar_timestamp_grupos()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_grupos
BEFORE UPDATE ON grupos
FOR EACH ROW
EXECUTE FUNCTION atualizar_timestamp_grupos();

-- ============================================
-- COMENTÁRIOS nas tabelas e colunas
-- ============================================
COMMENT ON TABLE unidades IS 'Armazena as unidades hospitalares, clínicas e departamentos';
COMMENT ON COLUMN unidades.cd_tipo IS '1=Hospital, 2=Clínica, 3=Departamento, 4=Setor';
COMMENT ON TABLE grupos IS 'Armazena os grupos de usuários (equipes, setores, comissões)';
COMMENT ON TABLE usuarios_grupos IS 'Relacionamento entre usuários, grupos e unidades';
COMMENT ON COLUMN usuarios_grupos.is_lider IS 'Define se o usuário é líder/coordenador do grupo';

-- ============================================
-- DADOS INICIAIS (SEED)
-- ============================================

-- Inserir unidade padrão (Hospital São Lucas)
INSERT INTO unidades (nome, cd_tipo, descricao, endereco, telefone, email, ativo)
VALUES 
  ('Hospital São Lucas', 1, 'Unidade principal do hospital', 'Rua Principal, 123', '(11) 3333-4444', 'contato@saolucas.com.br', true),
  ('Clínica Ortopédica', 2, 'Clínica especializada em ortopedia', 'Av. Saúde, 456', '(11) 3333-5555', 'ortopedia@saolucas.com.br', true),
  ('Departamento Administrativo', 3, 'Setor administrativo e financeiro', 'Rua Principal, 123 - 2º andar', '(11) 3333-4445', 'admin@saolucas.com.br', true)
ON CONFLICT DO NOTHING;

-- Inserir grupos padrão
INSERT INTO grupos (nome, descricao, unidade_id, ativo)
VALUES 
  ('Administração', 'Grupo de administradores do sistema', 1, true),
  ('Farmácia', 'Equipe da farmácia hospitalar', 1, true),
  ('Manutenção', 'Equipe de manutenção e infraestrutura', 1, true),
  ('Compras', 'Setor de compras e suprimentos', 3, true),
  ('Ortopedia', 'Equipe médica de ortopedia', 2, true)
ON CONFLICT DO NOTHING;

-- Vincular usuário admin aos grupos (assumindo que existe um usuário com id=1)
INSERT INTO usuarios_grupos (usuario_id, grupo_id, unidade_id, is_lider)
SELECT 1, g.id, g.unidade_id, true
FROM grupos g
WHERE g.nome = 'Administração'
ON CONFLICT DO NOTHING;

-- ============================================
-- VIEWS úteis para consultas
-- ============================================

-- Remover views antigas se existirem
DROP VIEW IF EXISTS vw_usuarios_grupos_unidades CASCADE;
DROP VIEW IF EXISTS vw_grupos_estatisticas CASCADE;

-- View: Usuários com seus grupos e unidades
CREATE VIEW vw_usuarios_grupos_unidades AS
SELECT 
  u.id as usuario_id,
  u.nome as usuario_nome,
  u.email as usuario_email,
  u.perfil as usuario_perfil,
  g.id as grupo_id,
  g.nome as grupo_nome,
  g.descricao as grupo_descricao,
  un.id as unidade_id,
  un.nome as unidade_nome,
  un.cd_tipo as unidade_tipo,
  ug.is_lider,
  ug.criado_em as vinculo_criado_em
FROM usuarios u
INNER JOIN usuarios_grupos ug ON u.id = ug.usuario_id
INNER JOIN grupos g ON ug.grupo_id = g.id
INNER JOIN unidades un ON ug.unidade_id = un.id
WHERE u.ativo = true AND g.ativo = true AND un.ativo = true;

-- View: Grupos com contagem de membros
CREATE VIEW vw_grupos_estatisticas AS
SELECT 
  g.id as grupo_id,
  g.nome as grupo_nome,
  g.descricao as grupo_descricao,
  un.id as unidade_id,
  un.nome as unidade_nome,
  COUNT(ug.usuario_id) as total_membros,
  COUNT(CASE WHEN ug.is_lider = true THEN 1 END) as total_lideres,
  g.ativo,
  g.criado_em
FROM grupos g
INNER JOIN unidades un ON g.unidade_id = un.id
LEFT JOIN usuarios_grupos ug ON g.id = ug.grupo_id
GROUP BY g.id, g.nome, g.descricao, un.id, un.nome, g.ativo, g.criado_em;

COMMENT ON VIEW vw_usuarios_grupos_unidades IS 'Visão completa de usuários com seus grupos e unidades';
COMMENT ON VIEW vw_grupos_estatisticas IS 'Estatísticas de grupos com contagem de membros e líderes';
