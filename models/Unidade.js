// Model: Unidade
// Descrição: Gerencia as unidades hospitalares/departamentos

const { query } = require('../config/database');

class Unidade {
  // Criar nova unidade
  static async criar(dados) {
    const sql = `
      INSERT INTO unidades (nome, cd_tipo, descricao, endereco, telefone, email, criado_por)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const valores = [
      dados.nome,
      dados.cd_tipo || 1,
      dados.descricao || null,
      dados.endereco || null,
      dados.telefone || null,
      dados.email || null,
      dados.criado_por
    ];
    const resultado = await query(sql, valores);
    return resultado.rows[0];
  }

  // Buscar todas as unidades ativas
  static async buscarTodas(filtros = {}) {
    let sql = 'SELECT * FROM unidades WHERE ativo = true';
    const valores = [];
    let contador = 1;

    if (filtros.cd_tipo) {
      sql += ` AND cd_tipo = $${contador}`;
      valores.push(filtros.cd_tipo);
      contador++;
    }

    if (filtros.busca) {
      sql += ` AND (nome ILIKE $${contador} OR descricao ILIKE $${contador})`;
      valores.push(`%${filtros.busca}%`);
      contador++;
    }

    sql += ' ORDER BY nome ASC';

    const resultado = await query(sql, valores);
    return resultado.rows;
  }

  // Buscar unidade por ID
  static async buscarPorId(id) {
    const sql = 'SELECT * FROM unidades WHERE id = $1 AND ativo = true';
    const resultado = await query(sql, [id]);
    return resultado.rows[0];
  }

  // Atualizar unidade
  static async atualizar(id, dados) {
    const sql = `
      UPDATE unidades 
      SET nome = COALESCE($1, nome),
          cd_tipo = COALESCE($2, cd_tipo),
          descricao = COALESCE($3, descricao),
          endereco = COALESCE($4, endereco),
          telefone = COALESCE($5, telefone),
          email = COALESCE($6, email)
      WHERE id = $7 AND ativo = true
      RETURNING *
    `;
    const valores = [
      dados.nome,
      dados.cd_tipo,
      dados.descricao,
      dados.endereco,
      dados.telefone,
      dados.email,
      id
    ];
    const resultado = await query(sql, valores);
    return resultado.rows[0];
  }

  // Desativar unidade (soft delete)
  static async desativar(id) {
    const sql = 'UPDATE unidades SET ativo = false WHERE id = $1 RETURNING *';
    const resultado = await query(sql, [id]);
    return resultado.rows[0];
  }

  // Buscar grupos da unidade
  static async buscarGrupos(unidadeId) {
    const sql = `
      SELECT g.*, 
             COUNT(ug.usuario_id) as total_membros
      FROM grupos g
      LEFT JOIN usuarios_grupos ug ON g.id = ug.grupo_id
      WHERE g.unidade_id = $1 AND g.ativo = true
      GROUP BY g.id
      ORDER BY g.nome ASC
    `;
    const resultado = await query(sql, [unidadeId]);
    return resultado.rows;
  }

  // Buscar usuários da unidade
  static async buscarUsuarios(unidadeId) {
    const sql = `
      SELECT DISTINCT u.id, u.nome, u.email, u.perfil
      FROM usuarios u
      INNER JOIN usuarios_grupos ug ON u.id = ug.usuario_id
      WHERE ug.unidade_id = $1 AND u.ativo = true
      ORDER BY u.nome ASC
    `;
    const resultado = await query(sql, [unidadeId]);
    return resultado.rows;
  }

  // Estatísticas da unidade
  static async obterEstatisticas(unidadeId) {
    const sql = `
      SELECT 
        (SELECT COUNT(*) FROM grupos WHERE unidade_id = $1 AND ativo = true) as total_grupos,
        (SELECT COUNT(DISTINCT usuario_id) FROM usuarios_grupos WHERE unidade_id = $1) as total_usuarios,
        (SELECT COUNT(*) FROM processos p 
         INNER JOIN usuarios_grupos ug ON p.criado_por = ug.usuario_id 
         WHERE ug.unidade_id = $1) as total_processos
    `;
    const resultado = await query(sql, [unidadeId]);
    return resultado.rows[0];
  }
}

module.exports = Unidade;
