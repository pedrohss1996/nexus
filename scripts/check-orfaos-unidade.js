#!/usr/bin/env node
/**
 * Lista (e opcionalmente atribui) registros sem unidade_id.
 *
 * A migration 019 deixa NULL o que não conseguiu inferir, de propósito: é
 * preferível o registro sumir da listagem a aparecer na unidade errada. Este
 * script mostra o que ficou pendente e permite atribuir em lote.
 *
 * Uso:
 *   npm run check:orfaos                      apenas lista
 *   node scripts/check-orfaos-unidade.js 3    atribui todos os órfãos à unidade 3
 */

require('dotenv').config();
const { Pool } = require('pg');

const TABELAS = ['processos', 'documentos', 'documentos_gerados'];

function sslConfig() {
  if (process.env.DB_SSL === 'false') return false;
  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
  const ca = process.env.DB_SSL_CA;
  return ca ? { ca, rejectUnauthorized } : { rejectUnauthorized };
}

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: sslConfig() })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'dataflow',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: sslConfig()
    });

(async () => {
  const destino = process.argv[2] ? parseInt(process.argv[2], 10) : null;

  try {
    console.log('\n📋 Registros sem unidade (invisíveis nas listagens filtradas):\n');

    let total = 0;
    for (const tabela of TABELAS) {
      const r = await pool.query(
        `SELECT COUNT(*)::int AS qtd FROM ${tabela} WHERE unidade_id IS NULL`
      );
      const qtd = r.rows[0].qtd;
      total += qtd;
      console.log(`   ${tabela.padEnd(20)} ${qtd}`);
    }

    if (total === 0) {
      console.log('\n✅ Nenhum órfão. Nada a fazer.\n');
      return;
    }

    if (destino == null) {
      const unidades = await pool.query(
        'SELECT id, nome FROM unidades WHERE ativo = true ORDER BY id'
      );
      console.log('\n🏥 Unidades ativas:\n');
      unidades.rows.forEach(u => console.log(`   ${String(u.id).padStart(3)}  ${u.nome}`));
      console.log(
        `\nPara atribuir os ${total} registro(s) a uma unidade:\n` +
        `   node scripts/check-orfaos-unidade.js <id_da_unidade>\n`
      );
      return;
    }

    const existe = await pool.query(
      'SELECT nome FROM unidades WHERE id = $1 AND ativo = true',
      [destino]
    );
    if (existe.rows.length === 0) {
      console.error(`\n❌ Unidade ${destino} não existe ou está inativa.\n`);
      process.exit(1);
    }

    console.log(`\n🔄 Atribuindo ${total} registro(s) à unidade ${destino} (${existe.rows[0].nome})...\n`);
    for (const tabela of TABELAS) {
      const r = await pool.query(
        `UPDATE ${tabela} SET unidade_id = $1 WHERE unidade_id IS NULL`,
        [destino]
      );
      console.log(`   ${tabela.padEnd(20)} ${r.rowCount} atualizado(s)`);
    }
    console.log('\n✅ Concluído.\n');
  } catch (err) {
    console.error('\n❌ Erro:', err.message, '\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
