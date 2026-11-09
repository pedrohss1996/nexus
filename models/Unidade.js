// Model: Unidade
// Descrição: Gerencia as unidades hospitalares/departamentos

const { query } = require('../config/database');

class Unidade {
  // Criar nova unidade
  static async criar(dados) {
    const sql = `
      INSERT INTO unidades (
        nome, cd_tipo, descricao, endereco, telefone, email, criado_por,
        cnpj, razao_social, inscricao_estadual, inscricao_municipal,
        responsavel_legal, codigo_unidade, site,
        cep, numero, complemento, bairro, cidade, estado
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *
    `;
    const valores = [
      dados.nome,
      dados.cd_tipo || 1,
      dados.descricao       || null,
      dados.endereco        || null,
      dados.telefone        || null,
      dados.email           || null,
      dados.criado_por,
      dados.cnpj            || null,
      dados.razao_social    || null,
      dados.inscricao_estadual  || null,
      dados.inscricao_municipal || null,
      dados.responsavel_legal   || null,
      dados.codigo_unidade  || null,
      dados.site            || null,
      dados.cep             || null,
      dados.numero          || null,
      dados.complemento     || null,
      dados.bairro          || null,
      dados.cidade          || null,
      dados.estado          || null,
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

  // Buscar as unidades às quais um usuário tem acesso.
  // Admin enxerga todas; demais perfis apenas as unidades onde possuem vínculo
  // de grupo (usuarios_grupos.unidade_id). É a base do isolamento multi-unidade.
  static async buscarPorUsuario(usuarioId, perfil) {
    if (perfil === 'admin') {
      return this.buscarTodas();
    }

    const sql = `
      SELECT DISTINCT u.*
      FROM unidades u
      INNER JOIN usuarios_grupos ug ON ug.unidade_id = u.id
      WHERE ug.usuario_id = $1 AND u.ativo = true
      ORDER BY u.nome ASC
    `;
    const resultado = await query(sql, [usuarioId]);
    return resultado.rows;
  }

  // Verifica se um usuário pode operar sobre determinada unidade
  static async usuarioTemAcesso(usuarioId, perfil, unidadeId) {
    const id = parseInt(unidadeId, 10);
    if (!id || Number.isNaN(id)) return false;

    if (perfil === 'admin') {
      const r = await query('SELECT 1 FROM unidades WHERE id = $1 AND ativo = true', [id]);
      return r.rows.length > 0;
    }

    const sql = `
      SELECT 1
      FROM usuarios_grupos ug
      INNER JOIN unidades u ON u.id = ug.unidade_id
      WHERE ug.usuario_id = $1 AND ug.unidade_id = $2 AND u.ativo = true
      LIMIT 1
    `;
    const resultado = await query(sql, [usuarioId, id]);
    return resultado.rows.length > 0;
  }

  // Buscar unidade por ID
  static async buscarPorId(id) {
    const sql = 'SELECT * FROM unidades WHERE id = $1 AND ativo = true';
    const resultado = await query(sql, [id]);
    return resultado.rows[0];
  }

  // Atualizar unidade
  static async atualizar(id, dados) {
    const sets = [];
    const valores = [];
    let n = 1;

    const campos = ['nome','descricao','endereco','telefone','email',
                    'cnpj','razao_social','inscricao_estadual','inscricao_municipal',
                    'responsavel_legal','codigo_unidade','site',
                    'cep','numero','complemento','bairro','cidade','estado'];

    for (const c of campos) {
      if (dados[c] !== undefined) {
        sets.push(`${c} = $${n++}`);
        valores.push(dados[c] || null);
      }
    }
    if (dados.cd_tipo !== undefined) {
      sets.push(`cd_tipo = $${n++}`);
      valores.push(parseInt(dados.cd_tipo, 10) || 1);
    }

    if (sets.length === 0) return this.buscarPorId(id);

    valores.push(id);
    const sql = `UPDATE unidades SET ${sets.join(', ')} WHERE id = $${n} AND ativo = true RETURNING *`;
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

  // Buscar contas contábeis da unidade
  static async buscarContasContabeis(unidadeId) {
    const sql = `
      SELECT * FROM contas_contabeis
      WHERE unidade_id = $1 AND ativo = true
      ORDER BY codigo ASC
    `;
    const resultado = await query(sql, [unidadeId]);
    return resultado.rows;
  }

  // Criar conta contábil na unidade
  static async criarContaContabil(unidadeId, dados) {
    const sql = `
      INSERT INTO contas_contabeis (unidade_id, codigo, nome, descricao, criado_por)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const valores = [
      unidadeId,
      dados.codigo,
      dados.nome,
      dados.descricao || null,
      dados.criado_por
    ];
    const resultado = await query(sql, valores);
    return resultado.rows[0];
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
