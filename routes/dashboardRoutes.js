const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/DashboardController');

// Rota principal do dashboard
router.get('/', DashboardController.index);

module.exports = router;
