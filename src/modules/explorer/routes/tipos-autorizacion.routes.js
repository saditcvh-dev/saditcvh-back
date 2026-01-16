const express = require('express');
const router = express.Router();
const tiposAutorizacionController = require('../controllers/tipos-autorizacion.controller');
const { protect } = require("../../auth/middlewares/auth.middleware");

router.use(protect);
const validateTipoAutorizacion = (req, res, next) => {
    const { nombre, abreviatura, id } = req.body;

    if (req.method === 'POST' || req.method === 'PUT') {
        if (req.method === 'POST' && (!id || isNaN(parseInt(id)))) {
            return res.status(400).json({
                success: false,
                error: 'El campo id es requerido y debe ser un número'
            });
        }

        if (!nombre || nombre.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'El campo nombre es requerido'
            });
        }

        if (!abreviatura || abreviatura.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'El campo abreviatura es requerido'
            });
        }

        if (abreviatura.length !== 1) {
            return res.status(400).json({
                success: false,
                error: 'La abreviatura debe ser un solo carácter'
            });
        }
    }

    next();
};

// Rutas CRUD
router.get('/', tiposAutorizacionController.getAll);
router.get('/search', tiposAutorizacionController.search);
router.get('/:id', tiposAutorizacionController.getById);
router.post('/', validateTipoAutorizacion, tiposAutorizacionController.create);
router.put('/:id', validateTipoAutorizacion, tiposAutorizacionController.update);
router.delete('/:id', tiposAutorizacionController.delete);

module.exports = router;