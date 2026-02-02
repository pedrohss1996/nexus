// Controller: Unidade
// Descrição: Gerencia operações de unidades

const Unidade = require('../models/Unidade');
const Grupo = require('../models/Grupo');
const Usuario = require('../models/Usuario');
const PlanoContas = require('../models/PlanoContas');
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
      let contasContabeis = [];
      let planoTree = [];
      try {
        contasContabeis = await Unidade.buscarContasContabeis(id);
        planoTree = await PlanoContas.buildTree(id);
      } catch (e) {
        // Tabela contas_contabeis pode não existir se migration 007/008 não foi executada
      }
      const estatisticas = await Unidade.obterEstatisticas(id);
      const todosUsuarios = await Usuario.buscarTodos({ ativo: true });

      res.render('unidades/detalhes', {
        title: `${unidade.nome} - DataFlow`,
        user: req.user,
        unidade,
        grupos,
        usuarios,
        contasContabeis: contasContabeis || [],
        planoTree,
        todosUsuarios: todosUsuarios || [],
        estatisticas,
        erro: req.query.erro || null
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

  // Página Plano de Contas (árvore hierárquica)
  static async planoContas(req, res) {
    try {
      const { id } = req.params;
      const unidade = await Unidade.buscarPorId(id);
      if (!unidade) {
        return res.status(404).render('error', {
          title: 'Erro - DataFlow',
          message: 'Unidade não encontrada'
        });
      }
      let tree = [];
      try {
        tree = await PlanoContas.buildTree(id);
      } catch (e) {
        // Tabela ou colunas podem não existir antes da migration 008
      }
      res.render('unidades/plano-contas', {
        title: `Plano de Contas - ${unidade.nome} - DataFlow`,
        user: req.user,
        unidade,
        tree
      });
    } catch (error) {
      console.error('Erro ao carregar plano de contas:', error);
      res.status(500).render('error', {
        title: 'Erro - DataFlow',
        message: 'Erro ao carregar plano de contas'
      });
    }
  }

  // API: criar subconta no plano de contas (JSON)
  static async criarSubcontaContabil(req, res) {
    try {
      const { id: unidadeId } = req.params;
      const { parent_id, nome, descricao, valor } = req.body;
      if (!nome || !String(nome).trim()) {
        return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
      }
      const node = await PlanoContas.criarSubconta(unidadeId, {
        parent_id: parent_id || null,
        nome: String(nome).trim(),
        descricao: descricao ? String(descricao).trim() : null,
        valor: valor != null ? (typeof valor === 'number' ? valor : parseFloat(valor)) : undefined,
        criado_por: req.user.id
      });
      await auditLog('CONTA_CONTABIL_CRIADA', req.user.id, { unidade_id: unidadeId, conta_id: node.id, codigo: node.codigo });
      return res.status(201).json({ success: true, conta: node });
    } catch (error) {
      if (error.code === 'TETO_EXCEDIDO') {
        return res.status(400).json({
          success: false,
          message: error.message || 'Valor excede o teto do centro de custo pai.',
          erro: 'teto',
          disponivel: error.disponivel
        });
      }
      console.error('Erro ao criar subconta:', error);
      return res.status(500).json({ success: false, message: error.message || 'Erro ao criar subconta' });
    }
  }

  // API: atualizar conta (nome/valor) com validação de teto (JSON)
  static async atualizarContaContabil(req, res) {
    try {
      const { id: unidadeId, contaId } = req.params;
      const { nome, valor } = req.body;
      const dados = {};
      if (nome !== undefined) dados.nome = String(nome).trim();
      if (valor !== undefined) {
        const v = typeof valor === 'number' ? valor : parseFloat(valor);
        if (Number.isNaN(v)) return res.status(400).json({ success: false, message: 'Valor inválido' });
        dados.valor = v;
      }
      if (Object.keys(dados).length === 0) {
        return res.status(400).json({ success: false, message: 'Envie nome ou valor' });
      }
      const node = await PlanoContas.atualizarConta(contaId, unidadeId, dados);
      if (!node) {
        return res.status(404).json({ success: false, message: 'Conta não encontrada' });
      }
      return res.json({ success: true, conta: node });
    } catch (error) {
      if (error.code === 'TETO_EXCEDIDO') {
        return res.status(400).json({
          success: false,
          erro: 'teto',
          disponivel: error.disponivel,
          mensagem: error.message
        });
      }
      console.error('Erro ao atualizar conta:', error);
      return res.status(500).json({ success: false, message: error.message || 'Erro ao atualizar conta' });
    }
  }

  // API: excluir conta (e filhas em cascade)
  static async excluirContaContabil(req, res) {
    try {
      const { id: unidadeId, contaId } = req.params;
      const ok = await PlanoContas.excluirConta(contaId, unidadeId);
      if (!ok) {
        return res.status(404).json({ success: false, message: 'Conta não encontrada' });
      }
      await auditLog('CONTA_CONTABIL_EXCLUIDA', req.user.id, { unidade_id: unidadeId, conta_id: contaId });
      return res.json({ success: true, message: 'Conta e subcontas excluídas' });
    } catch (error) {
      console.error('Erro ao excluir conta:', error);
      return res.status(500).json({ success: false, message: error.message || 'Erro ao excluir conta' });
    }
  }

  // Criar conta contábil na unidade (formulário flat - legado)
  static async criarContaContabil(req, res) {
    try {
      const { id } = req.params;
      const { codigo, nome, descricao } = req.body;

      if (!codigo || !nome) {
        req.flash && req.flash('error', 'Código e nome são obrigatórios.');
        return res.redirect(`/unidades/${id}`);
      }

      await Unidade.criarContaContabil(id, {
        codigo: codigo.trim(),
        nome: nome.trim(),
        descricao: descricao ? descricao.trim() : null,
        criado_por: req.user.id
      });

      await auditLog('CONTA_CONTABIL_CRIADA', req.user.id, { unidade_id: id, codigo, nome });
      res.redirect(`/unidades/${id}`);
    } catch (error) {
      if (error.code === '23505') {
        return res.redirect(`/unidades/${req.params.id}?erro=conta_duplicada`);
      }
      console.error('Erro ao criar conta contábil:', error);
      res.redirect(`/unidades/${req.params.id}`);
    }
  }

  // Criar grupo na unidade (formulário simples)
  static async criarGrupo(req, res) {
    try {
      const { id } = req.params;
      const { nome, descricao } = req.body;

      if (!nome || !nome.trim()) {
        return res.redirect(`/unidades/${id}?erro=grupo_nome_obrigatorio`);
      }

      const grupo = await Grupo.criar({
        nome: nome.trim(),
        descricao: descricao ? descricao.trim() : null,
        unidade_id: id,
        criado_por: req.user.id
      });

      await auditLog('GRUPO_CRIADO', req.user.id, { grupo_id: grupo.id, unidade_id: id, nome: grupo.nome });
      res.redirect(`/unidades/${id}`);
    } catch (error) {
      console.error('Erro ao criar grupo:', error);
      res.redirect(`/unidades/${req.params.id}`);
    }
  }

  // Vincular usuário ao grupo (na unidade)
  static async vincularUsuarioGrupo(req, res) {
    try {
      const { id: unidadeId } = req.params;
      const { grupo_id, usuario_id, is_lider } = req.body;

      if (!grupo_id || !usuario_id) {
        return res.redirect(`/unidades/${unidadeId}?erro=grupo_usuario_obrigatorio`);
      }

      await Grupo.adicionarUsuario(
        grupo_id,
        usuario_id,
        unidadeId,
        is_lider === 'true' || is_lider === 'on',
        req.user.id
      );

      await auditLog('USUARIO_VINCULADO_GRUPO', req.user.id, {
        unidade_id: unidadeId,
        grupo_id,
        usuario_id
      });
      res.redirect(`/unidades/${unidadeId}`);
    } catch (error) {
      if (error.code === '23505') {
        return res.redirect(`/unidades/${req.params.id}?erro=usuario_ja_no_grupo`);
      }
      console.error('Erro ao vincular usuário ao grupo:', error);
      res.redirect(`/unidades/${req.params.id}`);
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
