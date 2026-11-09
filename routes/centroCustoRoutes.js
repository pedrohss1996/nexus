const express = require('express');
const router = express.Router();
const CentroCustoController = require('../controllers/CentroCustoController');
const { requireRole } = require('../middlewares/authMiddleware');

// Centros de custo controlam orçamento — escrita restrita a admin/gestor
const podeEscrever = requireRole(['admin', 'gestor']);

router.get('/',                    CentroCustoController.listar);
router.get('/novo',                podeEscrever, CentroCustoController.formCriar);
router.post('/',                   podeEscrever, CentroCustoController.criar);
router.get('/:id/editar',          podeEscrever, CentroCustoController.formEditar);
router.post('/:id',                podeEscrever, CentroCustoController.atualizar);
router.post('/:id/excluir',        podeEscrever, CentroCustoController.excluir);

module.exports = router;
