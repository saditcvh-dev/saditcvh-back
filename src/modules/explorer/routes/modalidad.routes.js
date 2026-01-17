const express = require("express");
const router = express.Router();
const modalidadController = require("../controllers/modalidad.controller");

// Middleware de validación (opcional, pero recomendado)
const validateModalidad = (req, res, next) => {
  const { num, nombre } = req.body;
  
  if (!num || !nombre) {
    return res.status(400).json({
      success: false,
      message: "Los campos 'num' y 'nombre' son requeridos",
    });
  }

  if (typeof num !== "number") {
    return res.status(400).json({
      success: false,
      message: "El campo 'num' debe ser un número",
    });
  }

  if (nombre.length > 150) {
    return res.status(400).json({
      success: false,
      message: "El nombre no puede exceder los 150 caracteres",
    });
  }

  next();
};

// Rutas CRUD
router.post("/", validateModalidad, modalidadController.create);
router.get("/", modalidadController.getAll);
router.get("/search", modalidadController.search);
router.get("/num/:num", modalidadController.getByNum);
router.get("/:id", modalidadController.getById);
router.put("/:id", validateModalidad, modalidadController.update);
router.delete("/:id", modalidadController.delete);

module.exports = router;