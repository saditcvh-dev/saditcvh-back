const express = require('express');
const router = express.Router();
const controller = require('../controllers/backups.controller');
const { protect } = require("../../auth/middlewares/auth.middleware");

// Separamos los endpoints por su frecuencia de uso
router.get('/storage-metrics', controller.getStorageMetrics);
router.get('/live-metrics', controller.getLiveMetrics);

module.exports = router;