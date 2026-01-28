// Controller: Grupo
// Descrição: Gerencia operações de grupos

const Grupo = require('../models/Grupo');
const Unidade = require('../models/Unidade');
const { auditLog } = require('../utils/logger');

class GrupoController {
  // Listar todos os grupos
  static async listar(req, res) {
    try {
      const { unidade_id, busca } = req.query;
      const filtros = {};
      
      if (unidade_id) filtros.unidade_id = unidade_id;
      if (busca) filtros.busca = busca;

      const grupos = await Grupo.buscarTodos(filtros);
      const unidades = await Unidade.buscarTodas();

      res.render('grupos/listar', {
        title: 'Grupos - DataFlow',
        user: req.user,
        grupos,
        unidades,
        filtros
      });
    } catch (error) {
      console.error('Erro ao listar grupos:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar grupos'
      });
    }
  }

  // Exibir detalhes do grupo
  static async detalhes(req, res) {
    try {
      const { id } = req.params;
      const grupo = await Grupo.buscarPorId(id);
      
      if (!grupo) {
        return res.status(404).render('error', {
          title: 'Erro - DataFlow',
          message: 'Grupo não encontrado'
        });
      }

      const membros = await Grupo.buscarMembros(id);

      res.render('grupos/detalhes', {
        title: `${grupo.nome} - DataFlow`,
        user: req.user,
        grupo,
        membros
      });
    } catch (error) {
      console.error('Erro ao buscar grupo:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar grupo'
      });
    }
  }

  // Exibir formulário de criação
  static async formCriar(req, res) {
    try {
      const unidades = await Unidade.buscarTodas();
      
      res.render('grupos/form', {
        title: 'Novo Grupo - DataFlow',
        user: req.user,
        grupo: null,
        unidades
      });
    } catch (error) {
      console.error('Erro ao carregar formulário:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar formulário'
      });
    }
  }

  // Criar novo grupo
  static async criar(req, res) {
    try {
      const { nome, descricao, unidade_id } = req.body;

      const grupo = await Grupo.criar({
        nome,
        descricao,
        unidade_id,
        criado_por: req.user.id
      });

      await auditLog('GRUPO_CRIADO', req.user.id, { grupo_id: grupo.id, nome, unidade_id });

      res.redirect(`/grupos/${grupo.id}`);
    } catch (error) {
      console.error('Erro ao criar grupo:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao criar grupo'
      });
    }
  }

  // Exibir formulário de edição
  static async formEditar(req, res) {
    try {
      const { id } = req.params;
      const grupo = await Grupo.buscarPorId(id);
      
      if (!grupo) {
        return res.status(404).render('error', {
          title: 'Erro - DataFlow',
          message: 'Grupo não encontrado'
        });
      }

      const unidades = await Unidade.buscarTodas();

      res.render('grupos/form', {
        title: `Editar ${grupo.nome} - DataFlow`,
        user: req.user,
        grupo,
        unidades
      });
    } catch (error) {
      console.error('Erro ao carregar formulário:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar formulário'
      });
    }
  }

  // Atualizar grupo
  static async atualizar(req, res) {
    try {
      const { id } = req.params;
      const { nome, descricao, unidade_id } = req.body;

      const grupo = await Grupo.atualizar(id, { nome, descricao, unidade_id });

      if (!grupo) {
        return res.status(404).render('error', {
          title: 'Erro - DataFlow',
          message: 'Grupo não encontrado'
        });
      }

      await auditLog('GRUPO_ATUALIZADO', req.user.id, { grupo_id: id, nome, descricao, unidade_id });

      res.redirect(`/grupos/${id}`);
    } catch (error) {
      console.error('Erro ao atualizar grupo:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao atualizar grupo'
      });
    }
  }

  // Desativar grupo
  static async desativar(req, res) {
    try {
      const { id } = req.params;
      
      const grupo = await Grupo.desativar(id);

      if (!grupo) {
        return res.status(404).json({ success: false, message: 'Grupo não encontrado' });
      }

      await auditLog('GRUPO_DESATIVADO', req.user.id, { grupo_id: id });

      res.json({ success: true, message: 'Grupo desativado com sucesso' });
    } catch (error) {
      console.error('Erro ao desativar grupo:', error);
      res.status(500).json({ success: false, message: 'Erro ao desativar grupo' });
    }
  }

  // Exibir formulário de adicionar membro
  static async formAdicionarMembro(req, res) {
    try {
      const { id } = req.params;
      const grupo = await Grupo.buscarPorId(id);
      
      if (!grupo) {
        return res.status(404).render('error', {
          title: 'Erro - DataFlow',
          message: 'Grupo não encontrado'
        });
      }

      // Buscar todos os usuários ativos
      const Usuario = require('../models/Usuario');
      const usuarios = await Usuario.buscarTodos({ ativo: true });

      // Buscar todas as unidades ativas
      const Unidade = require('../models/Unidade');
      const unidades = await Unidade.buscarTodas();

      res.render('grupos/adicionar-membro', {
        title: `Adicionar Membro - ${grupo.nome} - DataFlow`,
        user: req.user,
        grupo,
        usuarios,
        unidades,
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

  // Adicionar membro ao grupo
  static async adicionarMembro(req, res) {
    try {
      const { id } = req.params;
      const { usuario_id, unidade_id, is_lider } = req.body;

      // Validações
      if (!usuario_id || !unidade_id) {
        const grupo = await Grupo.buscarPorId(id);
        const Usuario = require('../models/Usuario');
        const usuarios = await Usuario.buscarTodos({ ativo: true });
        const Unidade = require('../models/Unidade');
        const unidades = await Unidade.buscarTodas();

        return res.render('grupos/adicionar-membro', {
          title: `Adicionar Membro - ${grupo.nome} - DataFlow`,
          user: req.user,
          grupo,
          usuarios,
          unidades,
          erro: 'Usuário e unidade são obrigatórios'
        });
      }

      await Grupo.adicionarUsuario(id, usuario_id, unidade_id, is_lider === 'true', req.user.id);

      await auditLog('GRUPO_MEMBRO_ADICIONADO', req.user.id, { 
        grupo_id: id, 
        usuario_id, 
        unidade_id, 
        is_lider 
      });

      res.redirect(`/grupos/${id}`);
    } catch (error) {
      console.error('Erro ao adicionar membro:', error);
      
      // Se for erro de duplicata
      if (error.code === '23505') {
        const grupo = await Grupo.buscarPorId(req.params.id);
        const Usuario = require('../models/Usuario');
        const usuarios = await Usuario.buscarTodos({ ativo: true });
        const Unidade = require('../models/Unidade');
        const unidades = await Unidade.buscarTodas();

        return res.render('grupos/adicionar-membro', {
          title: `Adicionar Membro - ${grupo.nome} - DataFlow`,
          user: req.user,
          grupo,
          usuarios,
          unidades,
          erro: 'Este usuário já está neste grupo nesta unidade'
        });
      }

      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao adicionar membro'
      });
    }
  }

  // Remover membro do grupo
  static async removerMembro(req, res) {
    try {
      const { id, usuario_id } = req.params;

      await Grupo.removerUsuario(id, usuario_id);

      await auditLog('GRUPO_MEMBRO_REMOVIDO', req.user.id, { 
        grupo_id: id, 
        usuario_id 
      });

      res.json({ success: true, message: 'Membro removido com sucesso' });
    } catch (error) {
      console.error('Erro ao remover membro:', error);
      res.status(500).json({ success: false, message: 'Erro ao remover membro' });
    }
  }

  // Definir/remover líder
  static async definirLider(req, res) {
    try {
      const { id, usuario_id } = req.params;
      const { is_lider } = req.body;

      await Grupo.definirLider(id, usuario_id, is_lider === 'true');

      await auditLog('GRUPO_LIDER_ATUALIZADO', req.user.id, { 
        grupo_id: id, 
        usuario_id, 
        is_lider 
      });

      res.json({ success: true, message: 'Líder atualizado com sucesso' });
    } catch (error) {
      console.error('Erro ao definir líder:', error);
      res.status(500).json({ success: false, message: 'Erro ao definir líder' });
    }
  }
}

module.exports = GrupoController;
