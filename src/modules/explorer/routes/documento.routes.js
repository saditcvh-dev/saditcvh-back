

const express = require("express");
const router = express.Router();

const documentoController = require("../controllers/documento.controller");
const { upload } = require("../../../middlewares/upload.middleware");


const { protect } = require("../../auth/middlewares/auth.middleware");

router.use(protect);

// =====================
// Consultas
// =====================
router.get('/', documentoController.search);
router.get('/estadisticas', documentoController.getEstadisticas);
router.get('/autorizacion/:autorizacionId', documentoController.getByAutorizacion);
router.get('/:id', documentoController.getById);

// =====================
// Creación
// =====================
router.post('/', upload.single('archivo'), documentoController.crear);
router.post('/:id/version', upload.single('archivo'), documentoController.crearVersion);

// =====================
// Actualización / Eliminación
// =====================
router.put('/:id', documentoController.update);
router.delete('/:id', documentoController.delete);

// =====================
// Archivos
// =====================
router.get('/archivo/:archivoId/descargar', documentoController.descargarArchivo);

module.exports = router;
