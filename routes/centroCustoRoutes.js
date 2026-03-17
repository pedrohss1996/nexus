const express = require('express');
const router = express.Router();
const CentroCustoController = require('../controllers/CentroCustoController');

router.get('/',                    CentroCustoController.listar);
router.get('/novo',                CentroCustoController.formCriar);
router.post('/',                   CentroCustoController.criar);
router.get('/:id/editar',          CentroCustoController.formEditar);
router.post('/:id',                CentroCustoController.atualizar);
router.post('/:id/excluir',        CentroCustoController.excluir);

module.exports = router;
