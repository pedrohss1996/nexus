-- ============================================================================
-- Migration 024: todo unidade ativa tem um grupo "Geral"
-- ============================================================================
-- O acesso de um usuário a uma unidade é um vínculo em usuarios_grupos, que
-- exige um grupo daquela unidade. Uma unidade criada pela tela nascia sem
-- nenhum grupo — e então ninguém podia ser vinculado a ela, nem pela tela de
-- vínculos do usuário nem pela da unidade. O grupo "Geral" é o destino padrão
-- de quem só precisa acessar a unidade; grupos específicos (Compras, Farmácia)
-- continuam existindo para rotear etapas de fluxo.
-- ============================================================================

INSERT INTO grupos (nome, descricao, unidade_id)
SELECT 'Geral', 'Acesso padrão à unidade', u.id
  FROM unidades u
 WHERE u.ativo = true
   AND NOT EXISTS (
         SELECT 1 FROM grupos g
          WHERE g.unidade_id = u.id AND g.ativo = true
       );
