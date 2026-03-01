// controllers/carga-masiva.controller.js
const path = require('path')
const CargaMasivaService = require('../services/carga-masiva.service');

class CargaMasivaController {
    // Procesar archivo comprimido (ZIP)
    async procesarArchivoComprimido(req, res) {
        try {
            console.log('--- RECIBIENDO ARCHIVO COMPRIMIDO (BACKEND) ---');
            console.log('¿Hay archivo en el request?:', !!req.file);
            console.log('Datos del archivo recibido:', req.file ? {
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size
            } : 'Ninguno');
            console.log('Cuerpo de la petición (req.body):', req.body);
            console.log('-----------------------------------------------');

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

            const useOcr = req.body.useOcr === 'true';

            // 1. Extraer archivos y validar la nomenclatura ANTES de procesar
            const archivos = await CargaMasivaService.extraerArchivosComprimidos(
                req.file.buffer,
                extension
            );

            if (archivos.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No se encontraron archivos PDF dentro del archivo proporcionado'
                });
            }

            const validos = archivos.filter(a => !a.errorNomenclatura);
            if (validos.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Fallo al subir archivo: Ningún documento del ZIP cumple con la nomenclatura obligatoria.'
                });
            }

            if (useOcr) {
                // Modo asíncrono: iniciar proceso y responder inmediatamente
                const loteId = `lote_${Date.now()}_${userId}`;
                
                // Iniciar procesamiento en segundo plano (pasando el arreglo de archivos ya extraídos)
                CargaMasivaService.iniciarProcesamientoOCRAsincrono(
                    validos,  // Solo enviamos los válidos
                    userId,
                    loteId
                ).catch(error => {
                    console.error('Error en procesamiento asíncrono:', error);
                });

                res.json({
                    success: true,
                    message: 'Procesamiento OCR iniciado en segundo plano',
                    loteId: loteId,
                    modo: 'asincrono',
                    endpoints: {
                        estado: `/api/carga-masiva/estado-ocr/${loteId}`,
                        resultados: `/api/carga-masiva/resultados-ocr/${loteId}`
                    }
                });
            } else {
                const loteId = `lote_sync_${Date.now()}_${userId}`;

                const resultados = await CargaMasivaService.procesarCargaMasiva(
                    archivos, // Se mandan todos, los inválidos dirán `Omitido` internamente en la validación del servicio
                    userId,
                    { 
                        useOcr: false,
                        loteId,
                        origen: 'COMPRIMIDO'
                    }
                );


                res.json({
                    success: true,
                    message: 'Carga masiva completada',
                    resultados,
                    modo: 'sincrono'
                });
            }

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
            const useOcr = req.body.useOcr === 'true';

            if (useOcr) {
                // Modo asíncrono
                const loteId = `lote_directo_${Date.now()}_${userId}`;
                
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

                // Iniciar procesamiento en segundo plano
                CargaMasivaService.iniciarProcesamientoDirectoOCRAsincrono(
                    archivosPDF,
                    userId,
                    loteId
                ).catch(error => {
                    console.error('Error en procesamiento asíncrono:', error);
                });

                res.json({
                    success: true,
                    message: 'Procesamiento OCR iniciado en segundo plano',
                    loteId: loteId,
                    totalArchivos: archivosPDF.length,
                    modo: 'asincrono',
                    endpoints: {
                        estado: `/api/carga-masiva/estado-ocr/${loteId}`,
                        resultados: `/api/carga-masiva/resultados-ocr/${loteId}`
                    }
                });
            } else {
                // Modo sincrónico original
                const archivosPDF = req.files.filter(file => 
                    file.mimetype === 'application/pdf'
                );

                if (archivosPDF.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'No se encontraron archivos PDF'
                    });
                }

                const resultados = await CargaMasivaService.procesarArchivosDirectos(
                    archivosPDF,
                    userId,
                    { useOcr: false }
                );

                res.json({
                    success: true,
                    message: 'Carga masiva de archivos completada',
                    resultados,
                    modo: 'sincrono'
                });
            }

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
        // Obtener estado de un lote OCR
    async obtenerEstadoOCR(req, res) {
        try {
            const { loteId } = req.params;
            const userId = req.user.id;

            const estado = await CargaMasivaService.obtenerEstadoLoteOCR(loteId, userId);

            res.json({
                success: true,
                loteId,
                ...estado
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Obtener resultados de un lote OCR
    async obtenerResultadosOCR(req, res) {
        try {
            const { loteId } = req.params;
            const userId = req.user.id;

            const resultados = await CargaMasivaService.obtenerResultadosLoteOCR(loteId, userId);

            res.json({
                success: true,
                loteId,
                ...resultados
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Listar lotes del usuario
    async listarLotesUsuario(req, res) {
        try {
            const userId = req.user.id;
            const { limit = 20, offset = 0 } = req.query;

            const lotes = await CargaMasivaService.listarLotesPorUsuario(userId, parseInt(limit), parseInt(offset));

            res.json({
                success: true,
                lotes
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
