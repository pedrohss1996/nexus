#!/usr/bin/env node
/**
 * Runner único de migrations com controle de versão.
 *
 * Substitui os 15 scripts run-migration-0XX.js. Registra o que já rodou na
 * tabela schema_migrations, então é seguro executar quantas vezes quiser.
 *
 * Uso:
 *   npm run migrate              aplica as migrations pendentes
 *   npm run migrate:status       mostra aplicadas x pendentes
 *   npm run migrate:baseline 018 marca tudo até 018 como aplicado SEM executar
 *                                (para adotar o controle num banco que já existe)
 *
 * Formatos aceitos em migrations/:
 *   - arquivo .sql                      → executado inteiro numa transação
 *   - arquivo .js exportando up(client) → chamado com o client da transação
 *   - arquivo .js legado auto-executável→ rodado como processo separado
 *
 * Migrations novas devem ser .sql ou .js exportando `up(client)`.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { Pool } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

// ── Conexão ────────────────────────────────────────────────────────────────
function criarPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig()
    });
  }
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'dataflow',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: sslConfig()
  });
}

function sslConfig() {
  if (process.env.DB_SSL === 'false') return false;
  // Rede privada do Railway já é criptografada e o Postgres usa certificado
  // autoassinado: sem TLS aqui.
  if ((process.env.DATABASE_URL || '').includes('.railway.internal')) return false;
  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
  const ca = process.env.DB_SSL_CA;
  return ca ? { ca, rejectUnauthorized } : { rejectUnauthorized };
}

// ── Descoberta e ordenação ─────────────────────────────────────────────────
// Ordena pelo prefixo numérico e, em caso de empate (o projeto tem 007..012
// duplicados entre .sql e .js), desempata pelo nome — determinístico.
function listarMigrations() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql') || f.endsWith('.js'))
    .map(nome => {
      const m = nome.match(/^(\d+)/);
      return { nome, ordem: m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER };
    })
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
    .map(x => x.nome);
}

function checksum(nome) {
  const conteudo = fs.readFileSync(path.join(MIGRATIONS_DIR, nome));
  return crypto.createHash('sha256').update(conteudo).digest('hex').slice(0, 16);
}

// ── Tabela de controle ─────────────────────────────────────────────────────
async function garantirTabela(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      nome        VARCHAR(255) PRIMARY KEY,
      checksum    VARCHAR(64),
      aplicado_em TIMESTAMP NOT NULL DEFAULT NOW(),
      duracao_ms  INTEGER
    )
  `);
}

async function jaAplicadas(client) {
  const r = await client.query('SELECT nome, checksum FROM schema_migrations');
  return new Map(r.rows.map(row => [row.nome, row.checksum]));
}

// ── Execução ───────────────────────────────────────────────────────────────
async function aplicar(pool, nome) {
  const caminho = path.join(MIGRATIONS_DIR, nome);
  const inicio = Date.now();

  if (nome.endsWith('.js')) {
    // Detecta o formato SEM require(): as migrations legadas disparam sozinhas
    // ao serem carregadas, e como rodam async o require() retornaria antes do
    // fim — o runner marcaria como aplicada uma migration ainda em andamento.
    const src = fs.readFileSync(caminho, 'utf8');
    const exportaUp = /module\.exports\s*=\s*\{[^}]*\bup\b/.test(src);

    if (exportaUp) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await require(caminho).up(client);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
      return Date.now() - inicio;
    }

    // Legado auto-executável: roda como processo separado para poder esperar
    // o término de verdade e capturar o código de saída.
    const r = spawnSync(process.execPath, [caminho], {
      stdio: 'inherit',
      env: process.env
    });
    if (r.error) throw r.error;
    if (r.status !== 0) {
      throw new Error(`migration legada terminou com código ${r.status}`);
    }
    return Date.now() - inicio;
  }

  // .sql — arquivo inteiro numa única transação
  const sql = fs.readFileSync(caminho, 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  return Date.now() - inicio;
}

// ── Comandos ───────────────────────────────────────────────────────────────
async function comandoUp(pool) {
  const client = await pool.connect();
  await garantirTabela(client);
  const aplicadas = await jaAplicadas(client);
  client.release();

  const todas = listarMigrations();
  const pendentes = todas.filter(n => !aplicadas.has(n));

  if (pendentes.length === 0) {
    console.log('✅ Banco já está atualizado — nenhuma migration pendente.');
    return;
  }

  console.log(`🔄 ${pendentes.length} migration(s) pendente(s):\n`);

  for (const nome of pendentes) {
    process.stdout.write(`   ▶ ${nome} ... `);
    try {
      const duracao = await aplicar(pool, nome);
      const c = await pool.connect();
      await c.query(
        'INSERT INTO schema_migrations (nome, checksum, duracao_ms) VALUES ($1, $2, $3)',
        [nome, checksum(nome), duracao]
      );
      c.release();
      console.log(`ok (${duracao}ms)`);
    } catch (err) {
      console.log('FALHOU');
      console.error(`\n❌ Erro em ${nome}: ${err.message}`);
      if (err.detail) console.error(`   Detalhe: ${err.detail}`);
      console.error('\nA migration foi revertida. Corrija e rode novamente.');
      process.exit(1);
    }
  }

  console.log(`\n✅ ${pendentes.length} migration(s) aplicada(s).`);
}

async function comandoStatus(pool) {
  const client = await pool.connect();
  await garantirTabela(client);
  const aplicadas = await jaAplicadas(client);
  client.release();

  const todas = listarMigrations();
  console.log('\n📋 Estado das migrations:\n');

  for (const nome of todas) {
    if (!aplicadas.has(nome)) {
      console.log(`   ⏳ PENDENTE   ${nome}`);
      continue;
    }
    const registrado = aplicadas.get(nome);
    const atual = checksum(nome);
    if (registrado && registrado !== atual) {
      console.log(`   ⚠️  ALTERADA   ${nome}  (arquivo mudou depois de aplicado)`);
    } else {
      console.log(`   ✅ aplicada   ${nome}`);
    }
  }

  const pendentes = todas.filter(n => !aplicadas.has(n)).length;
  console.log(`\n   ${todas.length - pendentes} aplicada(s), ${pendentes} pendente(s).\n`);
}

async function comandoBaseline(pool, ate) {
  if (!ate) {
    console.error('❌ Informe até qual prefixo marcar. Ex.: npm run migrate:baseline 018');
    process.exit(1);
  }

  const limite = parseInt(ate, 10);
  if (Number.isNaN(limite)) {
    console.error(`❌ Prefixo inválido: ${ate}`);
    process.exit(1);
  }

  const client = await pool.connect();
  await garantirTabela(client);
  const aplicadas = await jaAplicadas(client);

  const alvo = listarMigrations().filter(nome => {
    const m = nome.match(/^(\d+)/);
    return m && parseInt(m[1], 10) <= limite && !aplicadas.has(nome);
  });

  if (alvo.length === 0) {
    console.log('Nada a marcar — todas já estão registradas.');
    client.release();
    return;
  }

  console.log(`\n📌 Marcando ${alvo.length} migration(s) como aplicada(s) SEM executar:\n`);
  for (const nome of alvo) {
    await client.query(
      'INSERT INTO schema_migrations (nome, checksum, duracao_ms) VALUES ($1, $2, 0) ON CONFLICT (nome) DO NOTHING',
      [nome, checksum(nome)]
    );
    console.log(`   📌 ${nome}`);
  }
  client.release();
  console.log(`\n✅ Baseline registrado. "npm run migrate" agora aplica só de ${limite + 1} em diante.\n`);
}

// ── Entrada ────────────────────────────────────────────────────────────────
(async () => {
  const [, , comando = 'up', arg] = process.argv;
  const pool = criarPool();

  try {
    if (comando === 'up') await comandoUp(pool);
    else if (comando === 'status') await comandoStatus(pool);
    else if (comando === 'baseline') await comandoBaseline(pool, arg);
    else {
      console.error(`Comando desconhecido: ${comando}`);
      console.error('Use: up | status | baseline <prefixo>');
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ Erro fatal:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
