
const { Op } = require('sequelize');
const TiposAutorizacion = require("../models//TiposAutorizacion.model");


class TiposAutorizacionService {
    async getAllTiposAutorizacion(filters = {}) {
        try {
            const where = {};

            if (filters.nombre) {
                where.nombre = { [Op.like]: `%${filters.nombre}%` };
            }

            if (filters.abreviatura) {
                where.abreviatura = filters.abreviatura;
            }

            const tipos = await TiposAutorizacion.findAll({
                where,
                order: [['nombre', 'ASC']]
            });

            return {
                success: true,
                data: tipos,
                count: tipos.length
            };
        } catch (error) {
            throw new Error(`Error al obtener tipos de autorización: ${error.message}`);
        }
    }

    async getTipoAutorizacionById(id) {
        try {
            const tipo = await TiposAutorizacion.findByPk(id);

            if (!tipo) {
                return {
                    success: false,
                    error: `Tipo de autorización con id ${id} no encontrado`,
                    statusCode: 404
                };
            }

            return {
                success: true,
                data: tipo
            };
        } catch (error) {
            console.error('Error al obtener tipo de autorización:', error);
            throw new Error(`Error al obtener tipo de autorización: ${error.message}`);
        }
    }

    async createTipoAutorizacion(tipoData) {
        try {
            // Validar campos requeridos
            if (!tipoData.id) {
                return {
                    success: false,
                    error: 'El campo id es requerido',
                    statusCode: 400
                };
            }

            if (!tipoData.nombre || !tipoData.abreviatura) {
                return {
                    success: false,
                    error: 'Los campos nombre y abreviatura son requeridos',
                    statusCode: 400
                };
            }

            // Verificar si ya existe un tipo con el mismo id
            const existingById = await TiposAutorizacion.findByPk(tipoData.id);
            if (existingById) {
                return {
                    success: false,
                    error: `Ya existe un tipo de autorización con id ${tipoData.id}`,
                    statusCode: 400
                };
            }

            const existingByAbreviatura = await TiposAutorizacion.findOne({
                where: { abreviatura: tipoData.abreviatura }
            });

            if (existingByAbreviatura) {
                return {
                    success: false,
                    error: `Ya existe un tipo de autorización con la abreviatura ${tipoData.abreviatura}`,
                    statusCode: 400
                };
            }

            const nuevoTipo = await TiposAutorizacion.create(tipoData);

            return {
                success: true,
                data: nuevoTipo,
                statusCode: 201,
                message: 'Tipo de autorización creado exitosamente'
            };
        } catch (error) {
            console.error('Error al crear tipo de autorización:', error);
            
            if (error.name === 'SequelizeValidationError') {
                return {
                    success: false,
                    error: 'Error de validación en los datos',
                    details: error.errors.map(err => err.message),
                    statusCode: 400
                };
            }

            throw new Error(`Error al crear tipo de autorización: ${error.message}`);
        }
    }

    async updateTipoAutorizacion(id, tipoData) {
        try {
            const tipo = await TiposAutorizacion.findByPk(id);

            if (!tipo) {
                return {
                    success: false,
                    error: `Tipo de autorización con id ${id} no encontrado`,
                    statusCode: 404
                };
            }

            if (tipoData.abreviatura && tipoData.abreviatura !== tipo.abreviatura) {
                const existingByAbreviatura = await TiposAutorizacion.findOne({
                    where: { 
                        abreviatura: tipoData.abreviatura,
                        id: { [Op.ne]: id }
                    }
                });

                if (existingByAbreviatura) {
                    return {
                        success: false,
                        error: `Ya existe otro tipo de autorización con la abreviatura ${tipoData.abreviatura}`,
                        statusCode: 400
                    };
                }
            }

            await tipo.update(tipoData);

            return {
                success: true,
                data: tipo,
                message: 'Tipo de autorización actualizado exitosamente'
            };
        } catch (error) {
            console.error('Error al actualizar tipo de autorización:', error);
            
            if (error.name === 'SequelizeValidationError') {
                return {
                    success: false,
                    error: 'Error de validación en los datos',
                    details: error.errors.map(err => err.message),
                    statusCode: 400
                };
            }

            throw new Error(`Error al actualizar tipo de autorización: ${error.message}`);
        }
    }

    async deleteTipoAutorizacion(id) {
        try {
            const tipo = await TiposAutorizacion.findByPk(id);

            if (!tipo) {
                return {
                    success: false,
                    error: `Tipo de autorización con id ${id} no encontrado`,
                    statusCode: 404
                };
            }

            await tipo.destroy();

            return {
                success: true,
                message: 'Tipo de autorización eliminado exitosamente'
            };
        } catch (error) {
            console.error('Error al eliminar tipo de autorización:', error);
            
            // Manejar error de restricción de clave foránea
            if (error.name === 'SequelizeForeignKeyConstraintError') {
                return {
                    success: false,
                    error: 'No se puede eliminar el tipo de autorización porque está siendo utilizado en otras tablas',
                    statusCode: 400
                };
            }

            throw new Error(`Error al eliminar tipo de autorización: ${error.message}`);
        }
    }

    async searchTiposAutorizacion(searchTerm) {
        try {
            const tipos = await TiposAutorizacion.findAll({
                where: {
                    [Op.or]: [
                        { nombre: { [Op.like]: `%${searchTerm}%` } },
                        { abreviatura: { [Op.like]: `%${searchTerm}%` } }
                    ]
                },
                order: [['nombre', 'ASC']]
            });

            return {
                success: true,
                data: tipos,
                count: tipos.length
            };
        } catch (error) {
            console.error('Error al buscar tipos de autorización:', error);
            throw new Error(`Error al buscar tipos de autorización: ${error.message}`);
        }
    }
}

module.exports = new TiposAutorizacionService();