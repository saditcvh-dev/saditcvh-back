const Modalidad = require("../models/Modalidad.model");

class ModalidadService {
  // Crear una nueva modalidad
  async createModalidad(data) {
    try {
      return await Modalidad.create(data);
    } catch (error) {
      throw new Error(`Error al crear modalidad: ${error.message}`);
    }
  }

  async getAllModalidades() {
    try {
      return await Modalidad.findAll({
        order: [["num", "ASC"]],
      });
    } catch (error) {
      throw new Error(`Error al obtener modalidades: ${error.message}`);
    }
  }


  async getModalidadById(id) {
    try {
      const modalidad = await Modalidad.findByPk(id);
      if (!modalidad) {
        throw new Error("Modalidad no encontrada");
      }
      return modalidad;
    } catch (error) {
      throw new Error(`Error al obtener modalidad: ${error.message}`);
    }
  }

  // Obtener modalidad por número
  async getModalidadByNum(num) {
    try {
      return await Modalidad.findOne({ where: { num } });
    } catch (error) {
      throw new Error(`Error al buscar modalidad por número: ${error.message}`);
    }
  }

  // Actualizar modalidad
  async updateModalidad(id, data) {
    try {
      const modalidad = await Modalidad.findByPk(id);
      if (!modalidad) {
        throw new Error("Modalidad no encontrada");
      }

      if (data.num && data.num !== modalidad.num) {
        const existingModalidad = await Modalidad.findOne({
          where: { num: data.num },
        });
        if (existingModalidad) {
          throw new Error("El número de modalidad ya existe");
        }
      }

      return await modalidad.update(data);
    } catch (error) {
      throw new Error(`Error al actualizar modalidad: ${error.message}`);
    }
  }

  // Eliminar modalidad
  async deleteModalidad(id) {
    try {
      const modalidad = await Modalidad.findByPk(id);
      if (!modalidad) {
        throw new Error("Modalidad no encontrada");
      }

      await modalidad.destroy();
      return { message: "Modalidad eliminada correctamente" };
    } catch (error) {
      throw new Error(`Error al eliminar modalidad: ${error.message}`);
    }
  }

  // Buscar modalidades por nombre
  async searchModalidades(searchTerm) {
    try {
      return await Modalidad.findAll({
        where: {
          nombre: {
            [Op.like]: `%${searchTerm}%`,
          },
        },
        order: [["num", "ASC"]],
      });
    } catch (error) {
      throw new Error(`Error al buscar modalidades: ${error.message}`);
    }
  }
}

module.exports = new ModalidadService();