const express = require('express');
const router = express.Router();
const anotacionesController = require('../controllers/anotaciones.controller');
const { protect } = require("../../auth/middlewares/auth.middleware");

router.use(protect);

// Rutas originales (por documento_id)
router.post('/guardar', anotacionesController.guardar);
// Endpoint original (con usuario)
router.get('/documento/:documentoId', protect, anotacionesController.obtenerPorDocumento);
// Nuevo endpoint (sin usuario, solo por archivo)
// router.get('/archivo-todos/:nombreArchivo', anotacionesController.obtenerPorArchivoTodos);
router.post('/eliminar', anotacionesController.eliminar);
router.post('/eliminar-por-documento', anotacionesController.eliminarPorDocumento);
router.post('/vaciar', anotacionesController.vaciar);
router.post('/vaciar-por-documento', anotacionesController.vaciarPorDocumento);
router.get('/exportar/:documentoId', anotacionesController.exportar);

// Nuevas rutas (por nombre de archivo)
router.post('/guardar-por-archivo', anotacionesController.guardarPorArchivo);
router.get('/archivo/:nombreArchivo', anotacionesController.obtenerPorArchivo);
router.post('/vaciar-por-archivo', anotacionesController.vaciarPorArchivo);
router.delete('/archivo/:nombreArchivo', anotacionesController.eliminarPorArchivo);
router.get('/exportar-archivo/:nombreArchivo', anotacionesController.exportarPorArchivo);

module.exports = router;