const modalidadService = require("../services/modalidad.service");

class ModalidadController {
  // Crear nueva modalidad
  async create(req, res) {
    try {
      const modalidad = await modalidadService.createModalidad(req.body);
      res.status(201).json({
        success: true,
        message: "Modalidad creada correctamente",
        data: modalidad,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Obtener todas las modalidades
  async getAll(req, res) {
    try {
      const modalidades = await modalidadService.getAllModalidades();
      res.status(200).json({
        success: true,
        data: modalidades,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Obtener modalidad por ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const modalidad = await modalidadService.getModalidadById(id);
      res.status(200).json({
        success: true,
        data: modalidad,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Obtener modalidad por número
  async getByNum(req, res) {
    try {
      const { num } = req.params;
      const modalidad = await modalidadService.getModalidadByNum(num);
      
      if (!modalidad) {
        return res.status(404).json({
          success: false,
          message: "Modalidad no encontrada",
        });
      }

      res.status(200).json({
        success: true,
        data: modalidad,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Actualizar modalidad
  async update(req, res) {
    try {
      const { id } = req.params;
      const modalidad = await modalidadService.updateModalidad(id, req.body);
      res.status(200).json({
        success: true,
        message: "Modalidad actualizada correctamente",
        data: modalidad,
      });
    } catch (error) {
      const statusCode = error.message.includes("no encontrada") ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Eliminar modalidad
  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await modalidadService.deleteModalidad(id);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      const statusCode = error.message.includes("no encontrada") ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Buscar modalidades
  async search(req, res) {
    try {
      const { search } = req.query;
      const modalidades = await modalidadService.searchModalidades(search);
      res.status(200).json({
        success: true,
        data: modalidades,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = new ModalidadController();