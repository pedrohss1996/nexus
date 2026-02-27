const express = require('express');
const router = express.Router();
const FluxoController = require('../controllers/FluxoController');
const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');
const loadUnidades = require('../middlewares/loadUnidades');

router.use(authenticateToken);
router.use(loadUnidades);

router.get('/', FluxoController.index);
router.get('/novo', requireRole(['admin', 'gestor']), FluxoController.create);
router.post('/', requireRole(['admin', 'gestor']), FluxoController.store);
router.get('/:id/editar', requireRole(['admin', 'gestor']), FluxoController.edit);
router.post('/:id', requireRole(['admin', 'gestor']), FluxoController.update);
router.get('/:id/configurar', FluxoController.configurar);
router.post('/:id/grupos', requireRole(['admin', 'gestor']), FluxoController.updateGrupos);
router.get('/:id', (req, res) => res.redirect('/fluxos/' + req.params.id + '/configurar'));

router.post('/:id/etapas', requireRole(['admin', 'gestor']), FluxoController.storeEtapa);
router.patch('/:id/etapas/reorder', requireRole(['admin', 'gestor']), FluxoController.reorderEtapas);
router.post('/:id/etapas/:etapaId', requireRole(['admin', 'gestor']), FluxoController.updateEtapa);
router.patch('/:id/etapas/:etapaId/area', requireRole(['admin', 'gestor']), FluxoController.updateEtapaArea);
router.patch('/:id/etapas/:etapaId/posicao', requireRole(['admin', 'gestor']), FluxoController.updateEtapaPosicao);
router.delete('/:id/etapas/:etapaId', requireRole(['admin', 'gestor']), FluxoController.destroyEtapa);
router.post('/:id/etapas/:etapaId/anexos', requireRole(['admin', 'gestor']), FluxoController.uploadAnexoMulter.single('arquivo'), FluxoController.uploadAnexo);
router.delete('/:id/etapas/:etapaId/anexos/:anexoId', requireRole(['admin', 'gestor']), FluxoController.deleteAnexo);
router.get('/:id/etapas/:etapaId/anexos/:anexoId/download', FluxoController.downloadAnexo);

router.post('/:id/edges', requireRole(['admin', 'gestor']), FluxoController.storeEdge);
router.delete('/:id/edges/:edgeId', requireRole(['admin', 'gestor']), FluxoController.destroyEdge);

module.exports = router;
