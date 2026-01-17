const tiposAutorizacionService = require('../services/tipos-autorizacion.service');

class TiposAutorizacionController {
    async getAll(req, res) {
        try {
            const filters = req.query;
            const result = await tiposAutorizacionService.getAllTiposAutorizacion(filters);
            
            res.status(200).json(result);
        } catch (error) {
            console.error('Error en controller getAll:', error);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor al obtener tipos de autorización'
            });
        }
    }

    async getById(req, res) {
        try {
            const { id } = req.params;
            const result = await tiposAutorizacionService.getTipoAutorizacionById(id);
            
            if (!result.success) {
                return res.status(result.statusCode || 404).json(result);
            }
            
            res.status(200).json(result);
        } catch (error) {
            console.error('Error en controller getById:', error);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor al obtener el tipo de autorización'
            });
        }
    }

    async create(req, res) {
        try {
            const tipoData = req.body;
            const result = await tiposAutorizacionService.createTipoAutorizacion(tipoData);
            
            if (!result.success) {
                return res.status(result.statusCode || 400).json(result);
            }
            
            res.status(result.statusCode || 201).json(result);
        } catch (error) {
            console.error('Error en controller create:', error);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor al crear el tipo de autorización'
            });
        }
    }

    async update(req, res) {
        try {
            const { id } = req.params;
            const tipoData = req.body;
            const result = await tiposAutorizacionService.updateTipoAutorizacion(id, tipoData);
            
            if (!result.success) {
                return res.status(result.statusCode || 400).json(result);
            }
            
            res.status(200).json(result);
        } catch (error) {
            console.error('Error en controller update:', error);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor al actualizar el tipo de autorización'
            });
        }
    }

    async delete(req, res) {
        try {
            const { id } = req.params;
            const result = await tiposAutorizacionService.deleteTipoAutorizacion(id);
            
            if (!result.success) {
                return res.status(result.statusCode || 400).json(result);
            }
            
            res.status(200).json(result);
        } catch (error) {
            console.error('Error en controller delete:', error);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor al eliminar el tipo de autorización'
            });
        }
    }

    async search(req, res) {
        try {
            const { term } = req.query;
            
            if (!term || term.trim() === '') {
                return res.status(400).json({
                    success: false,
                    error: 'El término de búsqueda es requerido'
                });
            }
            
            const result = await tiposAutorizacionService.searchTiposAutorizacion(term);
            
            res.status(200).json(result);
        } catch (error) {
            console.error('Error en controller search:', error);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor al buscar tipos de autorización'
            });
        }
    }
}

module.exports = new TiposAutorizacionController();