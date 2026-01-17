const express = require('express');
const AutorizacionController = require('../controllers/autorizacion.controller');
const router = express.Router();
const { protect } = require("../../auth/middlewares/auth.middleware");

router.use(protect);
// Instanciar controlador
const autorizacionController = new AutorizacionController();

// // Middleware para validar ID
const validarId = (req, res, next) => {
    const { id } = req.params;
    if (!id || isNaN(id)) {
        return res.status(400).json({
            success: false,
            message: 'ID inválido'
        });
    }
    next();
};

// Middleware para validar número de autorización
const validarNumeroAutorizacion = (req, res, next) => {
    const { numero } = req.params;
    if (!numero || numero.trim() === '') {
        return res.status(400).json({
            success: false,
            message: 'Número de autorización requerido'
        });
    }
    next();
};

// Rutas CRUD básicas
router.post('/', autorizacionController.crearAutorizacion);
router.get('/', autorizacionController.obtenerAutorizaciones);
router.get('/reporte', autorizacionController.generarReporteAutorizaciones);
router.post('/buscar', autorizacionController.buscarAutorizaciones);

// Rutas con ID
router.get('/:id', validarId, autorizacionController.obtenerAutorizacionPorId);
router.put('/:id', validarId, autorizacionController.actualizarAutorizacion);
router.delete('/:id', validarId, autorizacionController.eliminarAutorizacion);
router.patch('/:id/estado', validarId, autorizacionController.cambiarEstadoAutorizacion);

// Rutas con número de autorización
router.get('/numero/:numero', validarNumeroAutorizacion, autorizacionController.obtenerAutorizacionPorNumero);

// Exportar router
module.exports = router;