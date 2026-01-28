// Middleware: Load Unidades
// Descrição: Carrega as unidades para o seletor do header

const Unidade = require('../models/Unidade');

const loadUnidades = async (req, res, next) => {
  try {
    // Se o usuário está autenticado, carregar unidades
    if (req.user) {
      const unidades = await Unidade.buscarTodas();
      res.locals.unidades = unidades || [];
      
      // Definir unidade selecionada (da sessão ou primeira da lista)
      if (!req.session.unidadeSelecionada && res.locals.unidades.length > 0) {
        req.session.unidadeSelecionada = res.locals.unidades[0].id;
      }
      res.locals.unidadeSelecionada = req.session.unidadeSelecionada;
    } else {
      res.locals.unidades = [];
      res.locals.unidadeSelecionada = null;
    }
    
    next();
  } catch (error) {
    console.error('❌ Erro ao carregar unidades:', error);
    res.locals.unidades = [];
    res.locals.unidadeSelecionada = null;
    next();
  }
};

module.exports = loadUnidades;
