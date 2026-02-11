const express = require('express');
const router = express.Router();
const ReporteActividadController = require('../controllers/reporte-actividad.controller');

// ==============================================
// CONFIGURAR CORS
// ==============================================
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:4200');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// ==============================================
// RUTAS DE REPORTE DE ACTIVIDAD
// ==============================================

// 1. GENERAR REPORTE DE ACTIVIDAD EN PDF (ÚNICA RUTA)
router.get('/pdf', async (req, res) => {
  return await ReporteActividadController.generarReporteActividadPDF(req, res);
});

// 2. RUTA DE PRUEBA Y ESTADO DEL SERVICIO
router.get('/status', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'reportes-actividad',
    version: '1.0.0',
    endpoint: 'GET /api/reports/reporte-actividad/pdf?filtros',
    filters_available: {
      user_id: 'ID específico de usuario para filtrar',
      role_id: 'Filtrar por ID de rol',
      start_date: 'YYYY-MM-DD - Fecha de inicio del período',
      end_date: 'YYYY-MM-DD - Fecha de fin del período',
      limit_users: 'Número máximo de usuarios a analizar (default: 50)',
      include_inactive: 'true/false - Incluir usuarios inactivos'
    },
    description: 'Reporte detallado de actividad de usuarios: archivos subidos, comentarios y archivos vistos',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;