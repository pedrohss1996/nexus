-- ============================================================================
-- Migration 023: corrige gerar_numero_protocolo()
-- ============================================================================
-- A versão da migration 006 declarava uma variável chamada numero_protocolo,
-- mesmo nome da coluna. No SELECT, o PL/pgSQL não sabe qual das duas usar e
-- falha com "column reference numero_protocolo is ambiguous" — nenhum
-- protocolo podia ser criado.
--
-- Aproveita para:
-- - serializar a geração com um advisory lock de transação: com MAX()+1 puro,
--   dois protocolos criados ao mesmo tempo recebiam o mesmo número e o segundo
--   falhava na UNIQUE. O lock vale até o COMMIT da transação do chamador, que
--   é quando o INSERT fica visível para o próximo.
-- - usar o ano no fuso de Brasília: CURRENT_DATE do banco é UTC e virava o
--   ano às 21h de 31/12.
-- ============================================================================

CREATE OR REPLACE FUNCTION gerar_numero_protocolo()
RETURNS VARCHAR AS $$
DECLARE
  v_ano        INTEGER := EXTRACT(YEAR FROM (NOW() AT TIME ZONE 'America/Sao_Paulo'));
  v_sequencial INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('gerar_numero_protocolo'));

  SELECT COALESCE(MAX(CAST(SPLIT_PART(p.numero_protocolo, '/', 1) AS INTEGER)), 0) + 1
    INTO v_sequencial
    FROM protocolos p
   WHERE p.ano = v_ano;

  RETURN LPAD(v_sequencial::TEXT, 6, '0') || '/' || v_ano;
END;
$$ LANGUAGE plpgsql;
