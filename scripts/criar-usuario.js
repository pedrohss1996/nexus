#!/usr/bin/env node
/**
 * Cria um usuário já vinculado a uma unidade.
 *
 * O vínculo em usuarios_grupos é obrigatório na prática: desde o isolamento
 * multi-unidade, um usuário sem vínculo não enxerga unidade nenhuma e todas as
 * listagens vêm vazias. Criar o usuário com INSERT solto na tabela usuarios
 * produz uma conta que loga mas não funciona.
 *
 * Uso:
 *   node scripts/criar-usuario.js --nome "Fulano" --email f@x.com [--login fulano] [opções]
 *
 * Opções:
 *   --perfil   admin | gestor | usuario     (padrão: usuario)
 *   --senha    senha em texto               (padrão: gera uma aleatória forte)
 *   --unidade  id da unidade                (padrão: primeira ativa)
 *   --grupo    id do grupo                  (padrão: primeiro grupo da unidade)
 */

require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query, pool } = require('../config/database');

const PERFIS = ['admin', 'gestor', 'usuario'];

function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const chave = argv[i].slice(2);
      const valor = argv[i + 1];
      if (valor === undefined || valor.startsWith('--')) {
        console.error(`❌ Faltou o valor de --${chave}`);
        process.exit(1);
      }
      args[chave] = valor;
      i++;
    }
  }
  return args;
}

// Senha aleatória legível: evita caracteres ambíguos (0/O, 1/l/I)
function gerarSenha(tamanho = 16) {
  const alfabeto = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
  const bytes = crypto.randomBytes(tamanho);
  let out = '';
  for (let i = 0; i < tamanho; i++) out += alfabeto[bytes[i] % alfabeto.length];
  return out;
}

(async () => {
  const args = parseArgs();

  if (!args.nome || !args.email) {
    console.error('❌ --nome e --email são obrigatórios.');
    console.error('   Ex.: node scripts/criar-usuario.js --nome "Fulano" --email f@x.com --perfil admin');
    process.exit(1);
  }

  const perfil = args.perfil || 'usuario';
  if (!PERFIS.includes(perfil)) {
    console.error(`❌ Perfil inválido: ${perfil}. Use: ${PERFIS.join(', ')}`);
    process.exit(1);
  }

  const senha = args.senha || gerarSenha();
  const senhaGerada = !args.senha;

  try {
    // Alvo do banco, explícito — evita criar conta no banco errado sem perceber
    const alvo = await query('SELECT current_database() AS db');
    console.log(`\n🗄️  Banco: ${alvo.rows[0].db} (${process.env.DB_HOST}:${process.env.DB_PORT})\n`);

    const existente = await query('SELECT id FROM usuarios WHERE email = $1', [args.email]);
    if (existente.rows.length > 0) {
      console.error(`❌ Já existe usuário com o e-mail ${args.email} (id ${existente.rows[0].id}).`);
      process.exit(1);
    }

    // Resolver unidade
    const unidade = args.unidade
      ? await query('SELECT id, nome FROM unidades WHERE id = $1 AND ativo = true', [args.unidade])
      : await query('SELECT id, nome FROM unidades WHERE ativo = true ORDER BY id LIMIT 1');

    if (unidade.rows.length === 0) {
      console.error('❌ Nenhuma unidade ativa encontrada. Rode "npm run migrate" antes.');
      process.exit(1);
    }
    const unidadeId = unidade.rows[0].id;

    // Resolver grupo dentro da unidade
    const grupo = args.grupo
      ? await query('SELECT id, nome FROM grupos WHERE id = $1 AND unidade_id = $2 AND ativo = true', [args.grupo, unidadeId])
      : await query('SELECT id, nome FROM grupos WHERE unidade_id = $1 AND ativo = true ORDER BY id LIMIT 1', [unidadeId]);

    if (grupo.rows.length === 0) {
      console.error(`❌ Nenhum grupo ativo na unidade ${unidadeId}. Crie um grupo antes.`);
      process.exit(1);
    }
    const grupoId = grupo.rows[0].id;

    // Nome de usuário (é com ele que se entra): --login, ou a parte do e-mail antes do "@"
    const login = String(args.login || args.email.split('@')[0]).trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,60}$/.test(login)) {
      console.error(`❌ Nome de usuário inválido: "${login}". Use --login com 3 a 60 caracteres (letras, números, . _ -).`);
      process.exit(1);
    }
    const loginEmUso = await query('SELECT 1 FROM usuarios WHERE lower(login) = $1', [login]);
    if (loginEmUso.rows.length) {
      console.error(`❌ O nome de usuário "${login}" já está em uso. Escolha outro com --login.`);
      process.exit(1);
    }

    const hash = await bcrypt.hash(senha, 10);
    const novo = await query(
      `INSERT INTO usuarios (nome, email, login, senha, perfil, ativo, criado_em)
       VALUES ($1, $2, $3, $4, $5, true, NOW())
       RETURNING id`,
      [args.nome, args.email, login, hash, perfil]
    );
    const usuarioId = novo.rows[0].id;

    await query(
      `INSERT INTO usuarios_grupos (usuario_id, grupo_id, unidade_id, is_lider)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [usuarioId, grupoId, unidadeId, perfil !== 'usuario']
    );

    console.log('✅ Usuário criado\n');
    console.log(`   id      : ${usuarioId}`);
    console.log(`   nome    : ${args.nome}`);
    console.log(`   login   : ${login}`);
    console.log(`   e-mail  : ${args.email}`);
    console.log(`   perfil  : ${perfil}`);
    console.log(`   unidade : ${unidadeId} — ${unidade.rows[0].nome}`);
    console.log(`   grupo   : ${grupoId} — ${grupo.rows[0].nome}`);

    if (senhaGerada) {
      console.log(`\n   🔑 senha : ${senha}`);
      console.log('   (gerada agora e não fica salva em lugar nenhum — anote)\n');
    } else {
      console.log('\n   🔑 senha : a que você informou em --senha\n');
    }

    if (perfil === 'admin') {
      console.log('   ℹ️  Perfil admin enxerga todas as unidades, não só a vinculada.\n');
    }
  } catch (err) {
    console.error('\n❌ Erro:', err.message, '\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
