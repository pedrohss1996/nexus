// Controller: Grupo
// Descrição: Gerencia operações de grupos

const Grupo = require('../models/Grupo');
const Unidade = require('../models/Unidade');
const { auditLog } = require('../utils/logger');
const acesso = require('../services/acesso');

class GrupoController {
  // Listar todos os grupos (por padrão só da unidade selecionada)
  static async listar(req, res) {
    try {
      const { unidade_id, busca } = req.query;
      const filtros = {};
      // Primeira carga (sem unidade_id na URL): mostra só grupos da unidade selecionada; senão respeita o filtro (incluindo "Todas")
      // Se a unidade selecionada é a administradora (acesso_total), a primeira
      // carga mostra os grupos de todas as unidades.
      let padrao = res.locals.unidadeSelecionada;
      if (unidade_id === undefined && padrao) {
        const atual = await Unidade.buscarPorId(padrao);
        if (atual && atual.acesso_total) padrao = null;
      }
      const unidadeFiltro = unidade_id === undefined ? padrao : (unidade_id || null);
      if (unidadeFiltro) filtros.unidade_id = unidadeFiltro;
      if (busca) filtros.busca = busca;

      const grupos = await Grupo.buscarTodos(filtros);
      const unidades = await Unidade.buscarTodas();

      res.render('grupos/listar', {
        title: 'Grupos - DataFlow',
        user: req.user,
        grupos,
        unidades,
        filtros: { unidade_id: unidadeFiltro || '', busca: filtros.busca || '' }
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
        membros,
        ok: req.query.ok || null
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
        unidades,
        unidadeSelecionada: res.locals.unidadeSelecionada
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
      const nomeTrim = (nome || '').trim();
      if (!nomeTrim) {
        const unidades = await Unidade.buscarTodas();
        return res.status(400).render('grupos/form', {
          title: 'Novo Grupo - DataFlow',
          user: req.user,
          grupo: null,
          unidades,
          unidadeSelecionada: res.locals.unidadeSelecionada,
          erro: 'Nome do grupo é obrigatório.'
        });
      }
      // Garantir unidade válida: usa da sessão se vier vazio ou inválido
      const unidadeId = unidade_id ? parseInt(unidade_id, 10) : null;
      const unidadeSessao = res.locals.unidadeSelecionada != null ? parseInt(res.locals.unidadeSelecionada, 10) : null;
      const unidadeFinal = (unidadeId && !isNaN(unidadeId)) ? unidadeId : (unidadeSessao && !isNaN(unidadeSessao) ? unidadeSessao : null);
      if (!unidadeFinal || isNaN(unidadeFinal)) {
        const unidades = await Unidade.buscarTodas();
        return res.status(400).render('grupos/form', {
          title: 'Novo Grupo - DataFlow',
          user: req.user,
          grupo: null,
          unidades,
          unidadeSelecionada: res.locals.unidadeSelecionada,
          erro: 'Selecione uma unidade no formulário ou no seletor do topo da página.'
        });
      }

      const grupo = await Grupo.criar({
        nome: nomeTrim,
        descricao: (descricao || '').trim() || null,
        unidade_id: unidadeFinal,
        criado_por: req.user?.id ?? null
      });

      try {
        await auditLog('GRUPO_CRIADO', req.user?.id, { grupo_id: grupo.id, nome: nomeTrim, unidade_id: unidadeFinal });
      } catch (_) { /* não falha a criação por falha de log */ }

      res.redirect(`/grupos/${grupo.id}`);
    } catch (error) {
      console.error('Erro ao criar grupo:', error?.message, error?.code, error?.detail);
      const unidades = await Unidade.buscarTodas().catch(() => []);
      let msg = 'Erro ao criar grupo. Tente novamente.';
      if (error?.code === '23503') msg = 'Unidade ou usuário não encontrado. Selecione uma unidade válida.';
      else if (error?.code === '23502') msg = 'Dado obrigatório faltando. Preencha nome e unidade.';
      else if (error?.message) msg = `Erro ao criar grupo: ${error.message}`;
      return res.status(500).render('grupos/form', {
        title: 'Novo Grupo - DataFlow',
        user: req.user,
        grupo: null,
        unidades,
        unidadeSelecionada: res.locals.unidadeSelecionada,
        erro: msg
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
        unidades,
        unidadeSelecionada: res.locals.unidadeSelecionada
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

  // Formulário de adicionar membros: vários usuários de uma vez
  static async formAdicionarMembro(req, res) {
    try {
      const { id } = req.params;
      const grupo = await Grupo.buscarPorId(id);
      if (!grupo) {
        return res.status(404).render('error', { title: 'Erro - DataFlow', message: 'Grupo não encontrado' });
      }
      return GrupoController._renderAdicionar(req, res, grupo, { erro: null });
    } catch (error) {
      console.error('Erro ao carregar formulário:', error);
      res.status(500).render('error', { title: 'Erro - DataFlow', message: 'Erro ao carregar formulário' });
    }
  }

  static async _renderAdicionar(req, res, grupo, { erro, marcados = [] }) {
    const Usuario = require('../models/Usuario');
    const [usuarios, membros, unidade] = await Promise.all([
      Usuario.buscarTodos({ ativo: true }),
      Grupo.buscarMembros(grupo.id),
      Unidade.buscarPorId(grupo.unidade_id)
    ]);
    const idsMembros = new Set(membros.map(m => m.id));
    return res.render('grupos/adicionar-membro', {
      title: `Adicionar membros - ${grupo.nome} - Nexus`,
      user: req.user,
      grupo,
      unidade,
      usuarios: usuarios.map(u => ({ ...u, jaMembro: idsMembros.has(u.id) })),
      marcados: marcados.map(String),
      erro
    });
  }

  // Adicionar membros: aceita um ou vários usuario_id. A unidade é a do grupo.
  static async adicionarMembro(req, res) {
    const { id } = req.params;
    try {
      const grupo = await Grupo.buscarPorId(id);
      if (!grupo) {
        return res.status(404).render('error', { title: 'Erro - DataFlow', message: 'Grupo não encontrado' });
      }

      const ids = [].concat(req.body.usuario_id || req.body['usuario_id[]'] || [])
        .map(v => parseInt(v, 10)).filter(Boolean);
      const lider = req.body.is_lider === 'true' || req.body.is_lider === 'on';

      if (ids.length === 0) {
        return GrupoController._renderAdicionar(req, res, grupo, { erro: 'Marque pelo menos um usuário.' });
      }

      let adicionados = 0;
      const falhas = [];
      for (const usuarioId of [...new Set(ids)]) {
        try {
          await acesso.concederAcesso({ usuarioId, grupoId: id, isLider: lider, quem: req.user });
          adicionados++;
        } catch (e) {
          if (e instanceof acesso.ErroAcesso) { falhas.push(e.message); continue; }
          throw e;
        }
      }

      await auditLog('GRUPO_MEMBROS_ADICIONADOS', req.user.id, {
        grupo_id: id, unidade_id: grupo.unidade_id, usuarios: ids, is_lider: lider
      });

      if (adicionados === 0) {
        return GrupoController._renderAdicionar(req, res, grupo, { erro: falhas[0] || 'Nenhum usuário foi adicionado.', marcados: ids });
      }
      const msg = adicionados === 1 ? '1 usuário adicionado ao grupo.' : `${adicionados} usuários adicionados ao grupo.`;
      res.redirect(`/grupos/${id}?ok=${encodeURIComponent(msg)}`);
    } catch (error) {
      console.error('Erro ao adicionar membros:', error);
      res.status(500).render('error', { title: 'Erro - DataFlow', message: 'Erro ao adicionar membros' });
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
