// Middleware: Load Unidades
// Descrição: Carrega as unidades que o usuário autenticado pode acessar e
// ancora a unidade selecionada dentro desse conjunto.
//
// Este middleware é a fronteira do isolamento multi-unidade: tudo que os
// controllers consomem via req.unidadeSelecionada / req.unidadesPermitidas
// já passou por validação de vínculo aqui.

const Unidade = require('../models/Unidade');

const loadUnidades = async (req, res, next) => {
  try {
    if (!req.user) {
      res.locals.unidades = [];
      res.locals.unidadeSelecionada = null;
      req.unidadesPermitidas = [];
      req.unidadeSelecionada = null;
      return next();
    }

    // Somente as unidades com vínculo — admin recebe todas
    const unidades = await Unidade.buscarPorUsuario(req.user.id, req.user.perfil);
    res.locals.unidades = unidades || [];

    const idsPermitidos = res.locals.unidades.map(u => u.id);
    const atual = req.session.unidadeSelecionada != null
      ? parseInt(req.session.unidadeSelecionada, 10)
      : null;

    // Se a sessão aponta para uma unidade sem vínculo (ou não aponta para
    // nenhuma), reancorar na primeira permitida. Sem unidades, fica nulo e as
    // queries filtradas por unidade não retornam nada — fail-closed.
    if (atual == null || Number.isNaN(atual) || !idsPermitidos.includes(atual)) {
      req.session.unidadeSelecionada = idsPermitidos.length > 0 ? idsPermitidos[0] : null;
    }

    res.locals.unidadeSelecionada = req.session.unidadeSelecionada;
    req.unidadeSelecionada = req.session.unidadeSelecionada;
    req.unidadesPermitidas = idsPermitidos;

    next();
  } catch (error) {
    console.error('❌ Erro ao carregar unidades:', error);
    // Fail-closed: sem lista de unidades válida, nenhum dado por unidade é servido
    res.locals.unidades = [];
    res.locals.unidadeSelecionada = null;
    req.unidadesPermitidas = [];
    req.unidadeSelecionada = null;
    next();
  }
};

module.exports = loadUnidades;
