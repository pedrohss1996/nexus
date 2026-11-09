-- ============================================================================
-- Migration 026: login por nome de usuário
-- ============================================================================
-- O acesso passa a ser feito pelo nome de usuário (ex.: "pedrosantos"), não
-- pelo e-mail. Contas existentes recebem como login a parte do e-mail antes
-- do "@", normalizada (minúsculas, só letras, números, ponto, hífen e
-- sublinhado). Em caso de repetição, o id é acrescentado ao final.
-- ============================================================================

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS login VARCHAR(60);

WITH base AS (
  SELECT id,
         COALESCE(NULLIF(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._-]', '', 'g'), ''), 'usuario') AS sugestao
    FROM usuarios
   WHERE login IS NULL
),
numerado AS (
  SELECT b.id, b.sugestao,
         ROW_NUMBER() OVER (PARTITION BY b.sugestao ORDER BY b.id) AS ordem,
         EXISTS (SELECT 1 FROM usuarios u WHERE u.login IS NOT NULL AND lower(u.login) = b.sugestao) AS ja_existe
    FROM base b
)
UPDATE usuarios u
   SET login = CASE WHEN n.ordem = 1 AND NOT n.ja_existe THEN n.sugestao ELSE n.sugestao || u.id END
  FROM numerado n
 WHERE n.id = u.id;

ALTER TABLE usuarios ALTER COLUMN login SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_login_unico ON usuarios (lower(login));
