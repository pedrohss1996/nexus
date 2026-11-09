// Model: Usuario
// Descrição: Gerencia os usuários do sistema

const { query } = require('../config/database');
const bcrypt = require('bcrypt');

class Usuario {
  // Criar novo usuário
  static async criar(dados) {
    const senhaHash = await bcrypt.hash(dados.senha, 10);
    
    const sql = `
      INSERT INTO usuarios
        (nome, email, login, senha, perfil, ativo,
         cpf, telefone, cargo, matricula,
         cep, logradouro, numero, complemento, bairro, cidade, estado)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING id, nome, email, login, perfil, ativo, criado_em,
                cpf, telefone, cargo, matricula,
                cep, logradouro, numero, complemento, bairro, cidade, estado
    `;
    const valores = [
      dados.nome, dados.email, Usuario.normalizarLogin(dados.login), senhaHash,
      dados.perfil || 'usuario',
      dados.ativo !== undefined ? dados.ativo : true,
      dados.cpf       || null,
      dados.telefone  || null,
      dados.cargo     || null,
      dados.matricula || null,
      dados.cep       || null,
      dados.logradouro|| null,
      dados.numero    || null,
      dados.complemento||null,
      dados.bairro    || null,
      dados.cidade    || null,
      dados.estado    || null,
    ];
    const resultado = await query(sql, valores);
    return resultado.rows[0];
  }

  // Buscar todos os usuários
  static async buscarTodos(filtros = {}) {
    let sql = `
      SELECT id, nome, email, login, perfil, ativo, criado_em, atualizado_em,
             cpf, telefone, cargo, matricula,
             cep, logradouro, numero, complemento, bairro, cidade, estado
      FROM usuarios
      WHERE 1=1
    `;
    const valores = [];
    let contador = 1;

    if (filtros.perfil) {
      sql += ` AND perfil = $${contador}`;
      valores.push(filtros.perfil);
      contador++;
    }

    if (filtros.ativo !== undefined) {
      sql += ` AND ativo = $${contador}`;
      valores.push(filtros.ativo);
      contador++;
    }

    if (filtros.busca) {
      sql += ` AND (nome ILIKE $${contador} OR email ILIKE $${contador})`;
      valores.push(`%${filtros.busca}%`);
      contador++;
    }

    sql += ' ORDER BY nome ASC';

    const resultado = await query(sql, valores);
    return resultado.rows;
  }

  // Buscar usuário por ID
  static async buscarPorId(id) {
    const sql = `
      SELECT id, nome, email, login, perfil, ativo, criado_em, atualizado_em,
             cpf, telefone, cargo, matricula,
             cep, logradouro, numero, complemento, bairro, cidade, estado
      FROM usuarios
      WHERE id = $1
    `;
    const resultado = await query(sql, [id]);
    return resultado.rows[0];
  }

  // Buscar usuário por email
  static async buscarPorEmail(email) {
    const sql = `
      SELECT id, nome, email, senha, perfil, ativo, criado_em, atualizado_em
      FROM usuarios
      WHERE email = $1
    `;
    const resultado = await query(sql, [email]);
    return resultado.rows[0];
  }

  // Atualizar usuário
  static async atualizar(id, dados) {
    const campos = [];
    const valores = [];
    let n = 1;

    if (dados.login !== undefined) dados.login = Usuario.normalizarLogin(dados.login);
    const simples = ['nome','email','login','perfil','cpf','telefone','cargo','matricula',
                     'cep','logradouro','numero','complemento','bairro','cidade','estado'];
    for (const campo of simples) {
      if (dados[campo] !== undefined) {
        campos.push(`${campo} = $${n++}`);
        valores.push(dados[campo] || null);
      }
    }
    if (dados.ativo !== undefined) {
      campos.push(`ativo = $${n++}`);
      valores.push(dados.ativo);
    }

    if (campos.length === 0) throw new Error('Nenhum campo para atualizar');

    valores.push(id);
    const sql = `
      UPDATE usuarios 
      SET ${campos.join(', ')}, atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $${n}
      RETURNING id, nome, email, perfil, ativo, criado_em, atualizado_em,
                cpf, telefone, cargo, matricula,
                cep, logradouro, numero, complemento, bairro, cidade, estado
    `;
    const resultado = await query(sql, valores);
    return resultado.rows[0];
  }

  // Atualizar senha
  static async atualizarSenha(id, novaSenha) {
    const senhaHash = await bcrypt.hash(novaSenha, 10);
    
    const sql = `
      UPDATE usuarios 
      SET senha = $1, atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, nome, email
    `;
    const resultado = await query(sql, [senhaHash, id]);
    return resultado.rows[0];
  }

  // Desativar usuário (soft delete)
  static async desativar(id) {
    const sql = `
      UPDATE usuarios 
      SET ativo = false, atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, nome, email, ativo
    `;
    const resultado = await query(sql, [id]);
    return resultado.rows[0];
  }

  // Reativar usuário
  static async reativar(id) {
    const sql = `
      UPDATE usuarios 
      SET ativo = true, atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, nome, email, ativo
    `;
    const resultado = await query(sql, [id]);
    return resultado.rows[0];
  }

  // Buscar grupos do usuário
  static async buscarGrupos(usuarioId) {
    const sql = `
      SELECT g.id, g.nome, g.descricao, 
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

  // Verificar se email já existe
  // Nome de usuário: minúsculas, letras, números, ponto, hífen e sublinhado
  static normalizarLogin(login) {
    return String(login || '').trim().toLowerCase();
  }

  static loginValido(login) {
    return /^[a-z0-9._-]{3,60}$/.test(Usuario.normalizarLogin(login));
  }

  static async loginExiste(login, excluirId = null) {
    let sql = 'SELECT 1 FROM usuarios WHERE lower(login) = $1';
    const valores = [Usuario.normalizarLogin(login)];
    if (excluirId) { sql += ' AND id != $2'; valores.push(excluirId); }
    const r = await query(sql + ' LIMIT 1', valores);
    return r.rows.length > 0;
  }

  static async emailExiste(email, excluirId = null) {
    let sql = 'SELECT COUNT(*) as count FROM usuarios WHERE email = $1';
    const valores = [email];
    
    if (excluirId) {
      sql += ' AND id != $2';
      valores.push(excluirId);
    }
    
    const resultado = await query(sql, valores);
    return parseInt(resultado.rows[0].count) > 0;
  }

  // Estatísticas de usuários
  static async obterEstatisticas() {
    const sql = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN ativo = true THEN 1 END) as ativos,
        COUNT(CASE WHEN ativo = false THEN 1 END) as inativos,
        COUNT(CASE WHEN perfil = 'admin' THEN 1 END) as admins,
        COUNT(CASE WHEN perfil = 'gestor' THEN 1 END) as gestores,
        COUNT(CASE WHEN perfil = 'usuario' THEN 1 END) as usuarios
      FROM usuarios
    `;
    const resultado = await query(sql);
    return resultado.rows[0];
  }

  // Validar senha
  static async validarSenha(senhaPlana, senhaHash) {
    return await bcrypt.compare(senhaPlana, senhaHash);
  }
}

module.exports = Usuario;
