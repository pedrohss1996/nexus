// Middleware: Contrato Scope
// Descrição: garante que o :id de contrato da rota pertence à unidade ativa.
//
// Aplicado a TODAS as rotas /contratos/:id/*, cobre de uma vez os sub-recursos
// (obrigações, pagamentos, SLAs, aditivos, anexos), que recebem o contrato pela
// URL e antes eram acessíveis com qualquer id.

const Contrato = require('../models/Contrato');
const { unidadeDaRequisicao } = require('../utils/unidadeScope');
const { esperaJson } = require('../utils/requestType');

const contratoDaUnidade = async (req, res, next) => {
  try {
    const unidadeId = unidadeDaRequisicao(req);
    const contratoId = parseInt(req.params.id, 10);

    if (!unidadeId || !contratoId || Number.isNaN(contratoId)) {
      return responder(req, res);
    }

    const ok = await Contrato.pertenceAUnidade(contratoId, unidadeId);
    if (!ok) {
      console.warn(
        `⚠️  Acesso negado ao contrato ${contratoId} por ${req.user?.email} (unidade ${unidadeId})`
      );
      return responder(req, res);
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Responde como "não encontrado": não revela a existência de contratos de
// outras unidades.
function responder(req, res) {
  if (esperaJson(req)) {
    return res.status(404).json({ success: false, message: 'Contrato não encontrado' });
  }
  return res.status(404).render('error', {
    title: 'Não Encontrado - DataFlow',
    message: 'Contrato não encontrado',
    user: req.user
  });
}

module.exports = contratoDaUnidade;
