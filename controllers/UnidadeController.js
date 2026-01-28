// Controller: Unidade
// Descrição: Gerencia operações de unidades

const Unidade = require('../models/Unidade');
const { auditLog } = require('../utils/logger');

class UnidadeController {
  // Listar todas as unidades
  static async listar(req, res) {
    try {
      const { cd_tipo, busca } = req.query;
      const filtros = {};
      
      if (cd_tipo) filtros.cd_tipo = cd_tipo;
      if (busca) filtros.busca = busca;

      const unidades = await Unidade.buscarTodas(filtros);

      res.render('unidades/listar', {
        title: 'Unidades - DataFlow',
        user: req.user,
        unidades,
        filtros
      });
    } catch (error) {
      console.error('Erro ao listar unidades:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar unidades'
      });
    }
  }

  // Exibir detalhes da unidade
  static async detalhes(req, res) {
    try {
      const { id } = req.params;
      const unidade = await Unidade.buscarPorId(id);
      
      if (!unidade) {
        return res.status(404).render('error', {
          title: 'Erro - DataFlow',
          message: 'Unidade não encontrada'
        });
      }

      const grupos = await Unidade.buscarGrupos(id);
      const usuarios = await Unidade.buscarUsuarios(id);
      const estatisticas = await Unidade.obterEstatisticas(id);

      res.render('unidades/detalhes', {
        title: `${unidade.nome} - DataFlow`,
        user: req.user,
        unidade,
        grupos,
        usuarios,
        estatisticas
      });
    } catch (error) {
      console.error('Erro ao buscar unidade:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar unidade'
      });
    }
  }

  // Exibir formulário de criação
  static async formCriar(req, res) {
    try {
      res.render('unidades/form', {
        title: 'Nova Unidade - DataFlow',
        user: req.user,
        unidade: null
      });
    } catch (error) {
      console.error('Erro ao carregar formulário:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar formulário'
      });
    }
  }

  // Criar nova unidade
  static async criar(req, res) {
    try {
      const { nome, cd_tipo } = req.body;

      const unidade = await Unidade.criar({
        nome,
        cd_tipo,
        criado_por: req.user.id
      });

      await auditLog('UNIDADE_CRIADA', req.user.id, { unidade_id: unidade.id, nome, cd_tipo });

      res.redirect(`/unidades/${unidade.id}`);
    } catch (error) {
      console.error('Erro ao criar unidade:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao criar unidade'
      });
    }
  }

  // Exibir formulário de edição
  static async formEditar(req, res) {
    try {
      const { id } = req.params;
      const unidade = await Unidade.buscarPorId(id);
      
      if (!unidade) {
        return res.status(404).render('error', {
          title: 'Erro - DataFlow',
          message: 'Unidade não encontrada'
        });
      }

      res.render('unidades/form', {
        title: `Editar ${unidade.nome} - DataFlow`,
        user: req.user,
        unidade
      });
    } catch (error) {
      console.error('Erro ao carregar formulário:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar formulário'
      });
    }
  }

  // Atualizar unidade
  static async atualizar(req, res) {
    try {
      const { id } = req.params;
      const { nome, cd_tipo } = req.body;

      const unidade = await Unidade.atualizar(id, { nome, cd_tipo });

      if (!unidade) {
        return res.status(404).render('error', {
          title: 'Erro - DataFlow',
          message: 'Unidade não encontrada'
        });
      }

      await auditLog('UNIDADE_ATUALIZADA', req.user.id, { unidade_id: id, nome, cd_tipo });

      res.redirect(`/unidades/${id}`);
    } catch (error) {
      console.error('Erro ao atualizar unidade:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao atualizar unidade'
      });
    }
  }

  // Desativar unidade
  static async desativar(req, res) {
    try {
      const { id } = req.params;
      
      const unidade = await Unidade.desativar(id);

      if (!unidade) {
        return res.status(404).json({ success: false, message: 'Unidade não encontrada' });
      }

      await auditLog('UNIDADE_DESATIVADA', req.user.id, { unidade_id: id });

      res.json({ success: true, message: 'Unidade desativada com sucesso' });
    } catch (error) {
      console.error('Erro ao desativar unidade:', error);
      res.status(500).json({ success: false, message: 'Erro ao desativar unidade' });
    }
  }
}

module.exports = UnidadeController;
