// Controller: Usuario
// Descrição: Gerencia operações de usuários

const Usuario = require('../models/Usuario');
const Grupo = require('../models/Grupo');
const { auditLog } = require('../utils/logger');

class UsuarioController {
  // Listar todos os usuários
  static async listar(req, res) {
    try {
      const { perfil, ativo, busca } = req.query;
      const filtros = {};
      
      if (perfil) filtros.perfil = perfil;
      if (ativo !== undefined) filtros.ativo = ativo === 'true';
      if (busca) filtros.busca = busca;

      const usuarios = await Usuario.buscarTodos(filtros);
      const estatisticas = await Usuario.obterEstatisticas();

      res.render('usuarios/listar', {
        title: 'Usuários - DataFlow',
        user: req.user,
        usuarios,
        estatisticas,
        filtros
      });
    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar usuários'
      });
    }
  }

  // Exibir detalhes do usuário
  static async detalhes(req, res) {
    try {
      const { id } = req.params;
      const usuario = await Usuario.buscarPorId(id);
      
      if (!usuario) {
        return res.status(404).render('error', {
          title: 'Erro - DataFlow',
          message: 'Usuário não encontrado'
        });
      }

      const grupos = await Usuario.buscarGrupos(id);

      res.render('usuarios/detalhes', {
        title: `${usuario.nome} - DataFlow`,
        user: req.user,
        usuario,
        grupos
      });
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar usuário'
      });
    }
  }

  // Exibir formulário de criação
  static async formCriar(req, res) {
    try {
      res.render('usuarios/form', {
        title: 'Novo Usuário - DataFlow',
        user: req.user,
        usuario: null,
        erro: null
      });
    } catch (error) {
      console.error('Erro ao carregar formulário:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar formulário'
      });
    }
  }

  // Criar novo usuário
  static async criar(req, res) {
    try {
      const { nome, email, senha, confirmar_senha, perfil,
              cpf, telefone, cargo, matricula,
              cep, logradouro, numero, complemento, bairro, cidade, estado } = req.body;

      if (!nome || !email || !senha || !confirmar_senha) {
        return res.render('usuarios/form', {
          title: 'Novo Usuário - DataFlow', user: req.user,
          usuario: req.body, erro: 'Nome, e-mail e senha são obrigatórios'
        });
      }
      if (senha !== confirmar_senha) {
        return res.render('usuarios/form', {
          title: 'Novo Usuário - DataFlow', user: req.user,
          usuario: req.body, erro: 'As senhas não coincidem'
        });
      }
      if (senha.length < 6) {
        return res.render('usuarios/form', {
          title: 'Novo Usuário - DataFlow', user: req.user,
          usuario: req.body, erro: 'A senha deve ter no mínimo 6 caracteres'
        });
      }

      const emailExiste = await Usuario.emailExiste(email);
      if (emailExiste) {
        return res.render('usuarios/form', {
          title: 'Novo Usuário - DataFlow', user: req.user,
          usuario: req.body, erro: 'Este email já está cadastrado'
        });
      }

      const usuario = await Usuario.criar({
        nome, email, senha, perfil: perfil || 'usuario',
        cpf, telefone, cargo, matricula,
        cep, logradouro, numero, complemento, bairro, cidade, estado
      });

      await auditLog('USUARIO_CRIADO', req.user.id, { usuario_id: usuario.id, nome, email, perfil });
      res.redirect(`/cadastros/usuarios/${usuario.id}`);
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      res.render('usuarios/form', {
        title: 'Novo Usuário - DataFlow', user: req.user,
        usuario: req.body, erro: 'Erro ao criar usuário. Tente novamente.'
      });
    }
  }

  // Exibir formulário de edição
  static async formEditar(req, res) {
    try {
      const { id } = req.params;
      const usuario = await Usuario.buscarPorId(id);
      
      if (!usuario) {
        return res.status(404).render('error', {
          title: 'Erro - DataFlow',
          message: 'Usuário não encontrado'
        });
      }

      res.render('usuarios/form', {
        title: `Editar ${usuario.nome} - DataFlow`,
        user: req.user,
        usuario,
        erro: null
      });
    } catch (error) {
      console.error('Erro ao carregar formulário:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar formulário'
      });
    }
  }

  // Atualizar usuário
  static async atualizar(req, res) {
    try {
      const { id } = req.params;
      const { nome, email, perfil,
              cpf, telefone, cargo, matricula,
              cep, logradouro, numero, complemento, bairro, cidade, estado } = req.body;

      if (!nome || !email) {
        const usuario = await Usuario.buscarPorId(id);
        return res.render('usuarios/form', {
          title: `Editar ${usuario.nome} - DataFlow`, user: req.user,
          usuario: { ...usuario, ...req.body }, erro: 'Nome e email são obrigatórios'
        });
      }

      const emailExiste = await Usuario.emailExiste(email, id);
      if (emailExiste) {
        const usuario = await Usuario.buscarPorId(id);
        return res.render('usuarios/form', {
          title: `Editar ${usuario.nome} - DataFlow`, user: req.user,
          usuario: { ...usuario, ...req.body }, erro: 'Este email já está cadastrado'
        });
      }

      const isSelf  = parseInt(id, 10) === req.user.id;
      const isAdmin = req.user.perfil === 'admin';
      const dados   = {
        nome, email,
        cpf, telefone, cargo, matricula,
        cep, logradouro, numero, complemento, bairro, cidade, estado
      };
      if (isAdmin && !isSelf) dados.perfil = perfil;

      const usuario = await Usuario.atualizar(id, dados);
      if (!usuario) {
        return res.status(404).render('error', { title: 'Erro', message: 'Usuário não encontrado' });
      }

      await auditLog('USUARIO_ATUALIZADO', req.user.id, { usuario_id: id, nome, email, perfil });
      res.redirect(`/cadastros/usuarios/${id}`);
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      const usuario = await Usuario.buscarPorId(req.params.id).catch(() => ({}));
      res.render('usuarios/form', {
        title: `Editar Usuário - DataFlow`, user: req.user,
        usuario: { ...usuario, ...req.body }, erro: 'Erro ao atualizar usuário. Tente novamente.'
      });
    }
  }

  // Desativar usuário
  static async desativar(req, res) {
    try {
      const { id } = req.params;
      
      // Não permitir desativar a si mesmo
      if (parseInt(id) === req.user.id) {
        return res.status(400).json({ 
          success: false, 
          message: 'Você não pode desativar sua própria conta' 
        });
      }

      const usuario = await Usuario.desativar(id);

      if (!usuario) {
        return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
      }

      await auditLog('USUARIO_DESATIVADO', req.user.id, { usuario_id: id });

      res.json({ success: true, message: 'Usuário desativado com sucesso' });
    } catch (error) {
      console.error('Erro ao desativar usuário:', error);
      res.status(500).json({ success: false, message: 'Erro ao desativar usuário' });
    }
  }

  // Reativar usuário
  static async reativar(req, res) {
    try {
      const { id } = req.params;
      
      const usuario = await Usuario.reativar(id);

      if (!usuario) {
        return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
      }

      await auditLog('USUARIO_REATIVADO', req.user.id, { usuario_id: id });

      res.json({ success: true, message: 'Usuário reativado com sucesso' });
    } catch (error) {
      console.error('Erro ao reativar usuário:', error);
      res.status(500).json({ success: false, message: 'Erro ao reativar usuário' });
    }
  }

  // Exibir formulário de alteração de senha
  static async formAlterarSenha(req, res) {
    try {
      const { id } = req.params;
      const usuario = await Usuario.buscarPorId(id);
      
      if (!usuario) {
        return res.status(404).render('error', {
          title: 'Erro - DataFlow',
          message: 'Usuário não encontrado'
        });
      }

      res.render('usuarios/alterar-senha', {
        title: `Alterar Senha - ${usuario.nome} - DataFlow`,
        user: req.user,
        usuario,
        erro: null
      });
    } catch (error) {
      console.error('Erro ao carregar formulário:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar formulário'
      });
    }
  }

  // Alterar senha
  static async alterarSenha(req, res) {
    try {
      const { id } = req.params;
      const { nova_senha, confirmar_senha } = req.body;
      const usuario = await Usuario.buscarPorId(id);

      if (!nova_senha || !confirmar_senha) {
        return res.render('usuarios/alterar-senha', {
          title: `Alterar Senha - ${usuario.nome} - DataFlow`,
          user: req.user,
          usuario,
          erro: 'Todos os campos são obrigatórios'
        });
      }

      if (nova_senha !== confirmar_senha) {
        return res.render('usuarios/alterar-senha', {
          title: `Alterar Senha - ${usuario.nome} - DataFlow`,
          user: req.user,
          usuario,
          erro: 'As senhas não coincidem'
        });
      }

      if (nova_senha.length < 6) {
        return res.render('usuarios/alterar-senha', {
          title: `Alterar Senha - ${usuario.nome} - DataFlow`,
          user: req.user,
          usuario,
          erro: 'A senha deve ter no mínimo 6 caracteres'
        });
      }

      await Usuario.atualizarSenha(id, nova_senha);
      await auditLog('USUARIO_SENHA_ALTERADA', req.user.id, { usuario_id: id });

      res.redirect(`/cadastros/usuarios/${id}?senha_alterada=true`);
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      const usuario = await Usuario.buscarPorId(req.params.id);
      res.render('usuarios/alterar-senha', {
        title: `Alterar Senha - ${usuario.nome} - DataFlow`,
        user: req.user,
        usuario,
        erro: 'Erro ao alterar senha. Tente novamente.'
      });
    }
  }

  // Gerenciar vínculos (grupos e unidades)
  static async gerenciarVinculos(req, res) {
    try {
      const { id } = req.params;
      const usuario = await Usuario.buscarPorId(id);
      
      if (!usuario) {
        return res.status(404).render('error', {
          title: 'Erro - DataFlow',
          message: 'Usuário não encontrado'
        });
      }

      const Grupo = require('../models/Grupo');
      const Unidade = require('../models/Unidade');
      const { query } = require('../config/database');

      // Buscar todos os grupos e unidades
      const grupos = await Grupo.buscarTodos();
      const unidades = await Unidade.buscarTodas();

      // Buscar vínculos atuais com detalhes
      const vinculos = await query(`
        SELECT 
          ug.usuario_id,
          ug.grupo_id,
          ug.unidade_id,
          ug.is_lider,
          ug.criado_em as vinculo_criado_em,
          g.nome as grupo_nome,
          g.descricao as grupo_descricao,
          u.nome as unidade_nome
        FROM usuarios_grupos ug
        INNER JOIN grupos g ON ug.grupo_id = g.id
        INNER JOIN unidades u ON ug.unidade_id = u.id
        WHERE ug.usuario_id = $1
        ORDER BY u.nome, g.nome
      `, [id]);

      res.render('usuarios/gerenciar-vinculos', {
        title: `Gerenciar Vínculos - ${usuario.nome} - DataFlow`,
        user: req.user,
        usuario,
        grupos,
        unidades,
        vinculos: vinculos.rows
      });
    } catch (error) {
      console.error('Erro ao carregar vínculos:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar vínculos'
      });
    }
  }

  // Adicionar vínculo
  static async adicionarVinculo(req, res) {
    try {
      const { id } = req.params;
      const { grupo_id, unidade_id, is_lider } = req.body;

      const Grupo = require('../models/Grupo');
      await Grupo.adicionarUsuario(grupo_id, id, unidade_id, is_lider === 'true', req.user.id);

      await auditLog('USUARIO_VINCULO_ADICIONADO', req.user.id, { 
        usuario_id: id,
        grupo_id, 
        unidade_id, 
        is_lider 
      });

      res.redirect(`/cadastros/usuarios/${id}/vinculos`);
    } catch (error) {
      console.error('Erro ao adicionar vínculo:', error);
      res.redirect(`/cadastros/usuarios/${req.params.id}/vinculos`);
    }
  }
}

module.exports = UsuarioController;
