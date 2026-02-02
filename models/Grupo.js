// Model: Grupo
// Descrição: Gerencia os grupos de usuários

const { query } = require('../config/database');

class Grupo {
  // Criar novo grupo (criado_por só é usado se a coluna existir na tabela)
  static async criar(dados) {
    const sql = `
      INSERT INTO grupos (nome, descricao, unidade_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const unidadeId = dados.unidade_id != null ? parseInt(dados.unidade_id, 10) : null;
    const valores = [
      dados.nome,
      dados.descricao || null,
      unidadeId
    ];
    const resultado = await query(sql, valores);
    return resultado.rows[0];
  }

  // Buscar todos os grupos ativos
  static async buscarTodos(filtros = {}) {
    let sql = `
      SELECT g.*, 
             u.nome as unidade_nome,
             COUNT(ug.usuario_id) as total_membros
      FROM grupos g
      INNER JOIN unidades u ON g.unidade_id = u.id
      LEFT JOIN usuarios_grupos ug ON g.id = ug.grupo_id
      WHERE g.ativo = true
    `;
    const valores = [];
    let contador = 1;

    if (filtros.unidade_id) {
      sql += ` AND g.unidade_id = $${contador}`;
      valores.push(filtros.unidade_id);
      contador++;
    }

    if (filtros.busca) {
      sql += ` AND (g.nome ILIKE $${contador} OR g.descricao ILIKE $${contador})`;
      valores.push(`%${filtros.busca}%`);
      contador++;
    }

    sql += ' GROUP BY g.id, u.nome ORDER BY g.nome ASC';

    const resultado = await query(sql, valores);
    return resultado.rows;
  }

  // Buscar grupo por ID
  static async buscarPorId(id) {
    const sql = `
      SELECT g.*, 
             u.nome as unidade_nome,
             u.cd_tipo as unidade_tipo,
             COUNT(ug.usuario_id) as total_membros
      FROM grupos g
      INNER JOIN unidades u ON g.unidade_id = u.id
      LEFT JOIN usuarios_grupos ug ON g.id = ug.grupo_id
      WHERE g.id = $1 AND g.ativo = true
      GROUP BY g.id, u.nome, u.cd_tipo
    `;
    const resultado = await query(sql, [id]);
    return resultado.rows[0];
  }

  // Atualizar grupo
  static async atualizar(id, dados) {
    const sql = `
      UPDATE grupos 
      SET nome = COALESCE($1, nome),
          descricao = COALESCE($2, descricao),
          unidade_id = COALESCE($3, unidade_id)
      WHERE id = $4 AND ativo = true
      RETURNING *
    `;
    const valores = [dados.nome, dados.descricao, dados.unidade_id, id];
    const resultado = await query(sql, valores);
    return resultado.rows[0];
  }

  // Desativar grupo (soft delete)
  static async desativar(id) {
    const sql = 'UPDATE grupos SET ativo = false WHERE id = $1 RETURNING *';
    const resultado = await query(sql, [id]);
    return resultado.rows[0];
  }

  // Adicionar usuário ao grupo
  static async adicionarUsuario(grupoId, usuarioId, unidadeId, isLider = false, criadoPor) {
    const sql = `
      INSERT INTO usuarios_grupos (usuario_id, grupo_id, unidade_id, is_lider, criado_por)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (usuario_id, grupo_id, unidade_id) 
      DO UPDATE SET is_lider = $4
      RETURNING *
    `;
    const valores = [usuarioId, grupoId, unidadeId, isLider, criadoPor];
    const resultado = await query(sql, valores);
    return resultado.rows[0];
  }

  // Remover usuário do grupo
  static async removerUsuario(grupoId, usuarioId) {
    const sql = 'DELETE FROM usuarios_grupos WHERE grupo_id = $1 AND usuario_id = $2 RETURNING *';
    const resultado = await query(sql, [grupoId, usuarioId]);
    return resultado.rows[0];
  }

  // Buscar membros do grupo
  static async buscarMembros(grupoId) {
    const sql = `
      SELECT u.id, u.nome, u.email, u.perfil, 
             ug.is_lider, ug.criado_em as vinculado_em,
             un.nome as unidade_nome
      FROM usuarios u
      INNER JOIN usuarios_grupos ug ON u.id = ug.usuario_id
      INNER JOIN unidades un ON ug.unidade_id = un.id
      WHERE ug.grupo_id = $1 AND u.ativo = true
      ORDER BY ug.is_lider DESC, u.nome ASC
    `;
    const resultado = await query(sql, [grupoId]);
    return resultado.rows;
  }

  // Definir/remover líder do grupo
  static async definirLider(grupoId, usuarioId, isLider) {
    const sql = `
      UPDATE usuarios_grupos 
      SET is_lider = $1 
      WHERE grupo_id = $2 AND usuario_id = $3
      RETURNING *
    `;
    const resultado = await query(sql, [isLider, grupoId, usuarioId]);
    return resultado.rows[0];
  }

  // Verificar se usuário pertence ao grupo
  static async usuarioPertence(grupoId, usuarioId) {
    const sql = `
      SELECT COUNT(*) as existe 
      FROM usuarios_grupos 
      WHERE grupo_id = $1 AND usuario_id = $2
    `;
    const resultado = await query(sql, [grupoId, usuarioId]);
    return parseInt(resultado.rows[0].existe) > 0;
  }

  // Buscar grupos do usuário
  static async buscarPorUsuario(usuarioId) {
    const sql = `
      SELECT g.*, 
             u.nome as unidade_nome,
             ug.is_lider,
             ug.criado_em as vinculado_em
      FROM grupos g
      INNER JOIN usuarios_grupos ug ON g.id = ug.grupo_id
      INNER JOIN unidades u ON g.unidade_id = u.id
      WHERE ug.usuario_id = $1 AND g.ativo = true
      ORDER BY g.nome ASC
    `;
    const resultado = await query(sql, [usuarioId]);
    return resultado.rows;
  }
}

module.exports = Grupo;
