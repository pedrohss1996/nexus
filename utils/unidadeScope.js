// Utilitário: escopo de unidade
// Descrição: ponto único de leitura da unidade ativa da requisição.
//
// O valor já foi validado pelo middleware loadUnidades — só chega aqui uma
// unidade com a qual o usuário tem vínculo. Controllers devem usar SEMPRE este
// helper em vez de ler req.session.unidadeSelecionada direto, para que a
// validação não possa ser contornada por engano.

const { esperaJson } = require('./requestType');

function unidadeDaRequisicao(req) {
  const bruto = req.unidadeSelecionada != null
    ? req.unidadeSelecionada
    : req.session?.unidadeSelecionada;

  if (bruto == null) return null;
  const id = parseInt(bruto, 10);
  return Number.isNaN(id) ? null : id;
}

// Interrompe a requisição quando não há unidade ativa.
// Retorna true se já respondeu (o controller deve dar return).
function semUnidade(req, res, { json = false } = {}) {
  if (unidadeDaRequisicao(req) != null) return false;

  if (json || esperaJson(req)) {
    res.status(403).json({
      success: false,
      message: 'Nenhuma unidade ativa. Selecione uma unidade para continuar.'
    });
  } else {
    res.status(403).render('error', {
      title: 'Sem Unidade - DataFlow',
      message: 'Você não está vinculado a nenhuma unidade. Procure o administrador.',
      user: req.user
    });
  }
  return true;
}

module.exports = { unidadeDaRequisicao, semUnidade };
