// Routes: API
// Descrição: Rotas de API para operações diversas

const express = require('express');
const router = express.Router();

// Rota para selecionar unidade
router.post('/selecionar-unidade', (req, res) => {
  try {
    const { unidade_id } = req.body;
    
    console.log('📍 Selecionando unidade:', unidade_id, 'para usuário:', req.user?.email);
    
    if (!unidade_id) {
      console.log('⚠️ Nenhuma unidade fornecida, redirecionando...');
      return res.redirect('back');
    }
    
    // Salvar unidade selecionada na sessão
    req.session.unidadeSelecionada = parseInt(unidade_id);
    
    console.log('✅ Unidade salva na sessão:', req.session.unidadeSelecionada);
    
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
      console.log('🔄 Redirecionando para:', destino);
      res.redirect(destino);
    });
  } catch (error) {
    console.error('❌ Erro ao selecionar unidade:', error);
    res.redirect('/inicio');
  }
});

module.exports = router;
