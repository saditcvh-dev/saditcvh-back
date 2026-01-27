// controllers/carga-masiva.controller.js
const path = require('path')
const CargaMasivaService = require('../services/carga-masiva.service');

class CargaMasivaController {
    // Procesar archivo comprimido (ZIP)
    async procesarArchivoComprimido(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No se proporcionó archivo'
                });
            }

            const userId = req.user.id;
            const extension = path.extname(req.file.originalname).toLowerCase();
            
            if (!['.zip', '.rar'].includes(extension)) {
                return res.status(400).json({
                    success: false,
                    message: 'Formato de archivo no soportado. Use ZIP o RAR'
                });
            }

            // Extraer archivos del comprimido
            const archivos = await CargaMasivaService.extraerArchivosComprimidos(
                req.file.buffer,
                extension
            );

            if (archivos.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No se encontraron archivos PDF en el comprimido'
                });
            }
            const useOcr = req.body.useOcr === 'true';


            // Procesar carga masiva
            const resultados = await CargaMasivaService.procesarCargaMasiva(
                archivos,
                userId,
                { useOcr }
            );
            console.log("resultados")
            console.log(resultados)
            res.json({
                success: true,
                message: 'Carga masiva completada',
                resultados
            });

        } catch (error) {
            console.error('Error en procesarArchivoComprimido:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Procesar múltiples archivos PDF directamente
    async procesarArchivosMultiples(req, res) {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No se proporcionaron archivos'
                });
            }

            const userId = req.user.id;
            
            // Filtrar solo archivos PDF
            const archivosPDF = req.files.filter(file => 
                file.mimetype === 'application/pdf'
            );

            if (archivosPDF.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No se encontraron archivos PDF'
                });
            }
const useOcr = req.body.useOcr === 'true';

            // Procesar carga masiva
            const resultados = await CargaMasivaService.procesarArchivosDirectos(
                archivosPDF,
                userId,{ useOcr }
            );

            res.json({
                success: true,
                message: 'Carga masiva de archivos completada',
                resultados
            });

        } catch (error) {
            console.error('Error en procesarArchivosMultiples:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Obtener estado de procesamiento (para procesos asíncronos)
    async obtenerEstadoProcesamiento(req, res) {
        try {
            // Implementar lógica para seguimiento de procesos largos
            // Podrías usar Redis o base de datos para almacenar estado
            res.json({
                success: true,
                estado: 'Implementar según necesidad'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new CargaMasivaController();