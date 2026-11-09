// Serviço: acesso de usuários às unidades
//
// Regra única do sistema: o acesso de um usuário a uma unidade é a participação
// dele em um GRUPO daquela unidade (tabela usuarios_grupos). A unidade é sempre
// a do grupo — nunca escolhida à parte. Antes, as telas pediam unidade e grupo
// em campos separados e aceitavam combinações impossíveis (grupo da unidade A
// gravado com unidade B), além de não haver grupo algum em unidades novas.
//
// Toda unidade tem um grupo "Geral" (migration 024 + garantirGrupoGeral na
// criação), destino padrão de quem só precisa acessar a unidade.

const { query } = require('../config/database');
const Grupo = require('../models/Grupo');

const NOME_GRUPO_PADRAO = 'Geral';

class ErroAcesso extends Error {}

// Grupos que `quem` pode usar para dar acesso, já com a unidade de cada um.
// Admin vê todos; gestor só os das unidades a que ele próprio tem acesso.
async function gruposDisponiveis(quem) {
  const filtro = quem.perfil === 'admin'
    ? ''
    : `AND u.id IN (SELECT unidade_id FROM usuarios_grupos WHERE usuario_id = $1)`;
  const r = await query(
    `SELECT g.id, g.nome, g.unidade_id, u.nome AS unidade_nome
       FROM grupos g
       JOIN unidades u ON u.id = g.unidade_id
      WHERE g.ativo = true AND u.ativo = true ${filtro}
      ORDER BY u.nome, (g.nome <> '${NOME_GRUPO_PADRAO}'), g.nome`,
    quem.perfil === 'admin' ? [] : [quem.id]
  );
  return r.rows;
}

// Agrupa a lista acima por unidade, para <optgroup>
function porUnidade(grupos) {
  const mapa = new Map();
  for (const g of grupos) {
    if (!mapa.has(g.unidade_id)) mapa.set(g.unidade_id, { id: g.unidade_id, nome: g.unidade_nome, grupos: [] });
    mapa.get(g.unidade_id).grupos.push(g);
  }
  return [...mapa.values()];
}

// Grupo "Geral" da unidade; cria se não existir. Devolve o id.
async function garantirGrupoGeral(unidadeId) {
  const existente = await query(
    `SELECT id FROM grupos WHERE unidade_id = $1 AND ativo = true
      ORDER BY (nome <> $2), id LIMIT 1`,
    [unidadeId, NOME_GRUPO_PADRAO]
  );
  if (existente.rows.length) return existente.rows[0].id;
  const novo = await Grupo.criar({ nome: NOME_GRUPO_PADRAO, descricao: 'Acesso padrão à unidade', unidade_id: unidadeId });
  return novo.id;
}

// Dá a `usuarioId` acesso à unidade do grupo `grupoId`.
// `quem` é o usuário logado: gestor só concede acesso a unidades dele.
async function concederAcesso({ usuarioId, grupoId, isLider = false, quem }) {
  const gid = parseInt(grupoId, 10);
  const uid = parseInt(usuarioId, 10);
  if (!gid) throw new ErroAcesso('Escolha a unidade e o grupo.');
  if (!uid) throw new ErroAcesso('Usuário inválido.');

  const r = await query(
    `SELECT g.id, g.nome, g.unidade_id, u.nome AS unidade_nome
       FROM grupos g JOIN unidades u ON u.id = g.unidade_id
      WHERE g.id = $1 AND g.ativo = true AND u.ativo = true`,
    [gid]
  );
  const grupo = r.rows[0];
  if (!grupo) throw new ErroAcesso('Grupo não encontrado ou unidade inativa.');

  if (quem && quem.perfil !== 'admin') {
    const pode = await query(
      'SELECT 1 FROM usuarios_grupos WHERE usuario_id = $1 AND unidade_id = $2 LIMIT 1',
      [quem.id, grupo.unidade_id]
    );
    if (!pode.rows.length) throw new ErroAcesso('Você só pode dar acesso às unidades em que trabalha.');
  }

  await Grupo.adicionarUsuario(gid, uid, grupo.unidade_id, !!isLider, quem ? quem.id : null);
  return grupo;
}

// Acessos atuais de um usuário, por unidade
async function acessosDoUsuario(usuarioId) {
  const r = await query(
    `SELECT ug.grupo_id, ug.unidade_id, ug.is_lider,
            g.nome AS grupo_nome, u.nome AS unidade_nome, u.ativo AS unidade_ativa
       FROM usuarios_grupos ug
       JOIN grupos g ON g.id = ug.grupo_id
       JOIN unidades u ON u.id = ug.unidade_id
      WHERE ug.usuario_id = $1
      ORDER BY u.ativo DESC, u.nome, g.nome`,
    [usuarioId]
  );
  return r.rows;
}

module.exports = {
  NOME_GRUPO_PADRAO,
  ErroAcesso,
  gruposDisponiveis,
  porUnidade,
  garantirGrupoGeral,
  concederAcesso,
  acessosDoUsuario,
};
