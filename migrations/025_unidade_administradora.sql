-- ============================================================================
-- Migration 025: unidade administradora ("vê tudo de todos")
-- ============================================================================
-- Quem tem acesso a uma unidade marcada com acesso_total passa a ter acesso a
-- TODAS as unidades ativas (pode selecioná-las no topo e operar em cada uma),
-- sem precisar do perfil "admin" do sistema — que além de ver tudo também
-- administra usuários, unidades e fluxos.
--
-- Cria a unidade "Administrador" com o grupo "Geral", se ainda não existir.
-- ============================================================================

ALTER TABLE unidades
  ADD COLUMN IF NOT EXISTS acesso_total BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN unidades.acesso_total IS
  'Membros desta unidade acessam todas as unidades ativas.';

INSERT INTO unidades (nome, descricao, acesso_total, ativo)
SELECT 'Administrador', 'Unidade administradora: seus membros acessam todas as unidades', true, true
 WHERE NOT EXISTS (SELECT 1 FROM unidades WHERE acesso_total = true);

INSERT INTO grupos (nome, descricao, unidade_id)
SELECT 'Geral', 'Acesso padrão à unidade', u.id
  FROM unidades u
 WHERE u.acesso_total = true
   AND NOT EXISTS (SELECT 1 FROM grupos g WHERE g.unidade_id = u.id AND g.ativo = true);
