// Routes: API
// Descrição: Rotas de API para operações diversas

const express = require('express');
const router = express.Router();
const Unidade = require('../models/Unidade');

// Rota para selecionar unidade
router.post('/selecionar-unidade', async (req, res) => {
  try {
    const { unidade_id } = req.body;

    if (!unidade_id) {
      return res.redirect('/inicio');
    }

    const unidadeId = parseInt(unidade_id, 10);
    if (!unidadeId || Number.isNaN(unidadeId)) {
      return res.redirect('/inicio');
    }

    // Só troca se o usuário realmente tiver vínculo com a unidade — sem isto
    // qualquer usuário autenticado assume o contexto de qualquer unidade.
    const temAcesso = await Unidade.usuarioTemAcesso(
      req.user.id,
      req.user.perfil,
      unidadeId
    );

    if (!temAcesso) {
      console.warn(
        `⚠️  Troca de unidade negada: usuário ${req.user.email} tentou acessar unidade ${unidadeId}`
      );
      req.flash && req.flash('error', 'Você não tem acesso a esta unidade.');
      return res.redirect('/inicio');
    }

    // Salvar unidade selecionada na sessão
    req.session.unidadeSelecionada = unidadeId;

    // Salvar sessão explicitamente antes de redirecionar
    req.session.save((err) => {
      if (err) {
        console.error('❌ Erro ao salvar sessão:', err);
      }

      // Redirecionar de volta — valida que é rota interna para evitar open redirect
      const referer = req.get('Referer') || '';
      let destino = '/inicio';
      try {
        const url = new URL(referer);
        if (url.origin === `${req.protocol}://${req.get('host')}`) {
          destino = url.pathname + url.search;
        }
      } catch (_) { /* referer inválido ou ausente — usa /inicio */ }
      res.redirect(destino);
    });
  } catch (error) {
    console.error('❌ Erro ao selecionar unidade:', error);
    res.redirect('/inicio');
  }
});

module.exports = router;
