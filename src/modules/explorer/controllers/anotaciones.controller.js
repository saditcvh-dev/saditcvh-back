const anotacionService = require('../services/anotacion.service.js');
const auditService = require('../../audit/services/audit.service.js');

class AnotacionesController {
    async guardar(req, res) {
        try {
            const { documento_id, comentarios } = req.body;
            const userId = req.user.id;

            console.log("body recibido:", req.body);
            if (!documento_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Se requiere el ID del documento'
                });
            }

            const datos = {
                comentarios: comentarios || [],
                metadata: {
                    fecha_guardado: new Date().toISOString(),
                    total_comentarios: (comentarios || []).length
                }
            };

            const anotacion = await anotacionService.crearAnotacion(
                parseInt(documento_id),
                userId,
                datos
            );

            await auditService.createLog(req, {
                action: 'GUARDAR_ANOTACIONES',
                module: 'PDF Viewer',
                entityId: anotacion.id,
                details: {
                    message: 'Anotaciones guardadas correctamente',
                    documento_id: documento_id,
                    total_comentarios: datos.metadata.total_comentarios,
                    usuario_id: userId,
                    anotacion_id: anotacion.id,
                    status: 'SUCCESS'
                }
            });

            res.status(200).json({
                success: true,
                message: 'Anotaciones guardadas correctamente',
                data: anotacion
            });
        } catch (error) {
            await auditService.createLog(req, {
                action: 'GUARDAR_ANOTACIONES',
                module: 'PDF Viewer',
                entityId: null,
                details: {
                    message: 'Error al guardar anotaciones',
                    error: error.message,
                    usuario_id: req.user?.id || null,
                    status: 'ERROR'
                }
            });

            console.error('Error al guardar anotaciones:', error);
            res.status(400).json({
                success: false,
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    async guardarPorArchivo(req, res) {
        try {
            const { archivo_nombre, pdf_url, comentarios } = req.body;
            const userId = req.user.id;
            console.log("body recibido:", req.body);


            if (!archivo_nombre) {
                return res.status(400).json({
                    success: false,
                    message: 'Se requiere el nombre del archivo'
                });
            }

            const datos = {
                comentarios: comentarios || [],
                metadata: {
                    fecha_guardado: new Date().toISOString(),
                    total_comentarios: (comentarios || []).length,
                    archivo_nombre: archivo_nombre,
                    documento_url: pdf_url,
                    origen: 'guardarPorArchivo'
                }
            };

            const anotacion = await anotacionService.crearAnotacionPorArchivo(
                archivo_nombre,
                pdf_url,
                userId,
                datos
            );

            await auditService.createLog(req, {
                action: 'GUARDAR_ANOTACIONES_POR_ARCHIVO',
                module: 'PDF Viewer',
                entityId: anotacion.id,
                details: {
                    message: 'Anotaciones guardadas correctamente por archivo',
                    archivo_nombre: archivo_nombre,
                    documento_url: pdf_url,
                    total_comentarios: datos.metadata.total_comentarios,
                    usuario_id: userId,
                    anotacion_id: anotacion.id,
                    status: 'SUCCESS'
                }
            });

            res.status(200).json({
                success: true,
                message: 'Anotaciones guardadas correctamente',
                data: {
                    ...anotacion,
                    archivo_nombre: archivo_nombre
                }
            });
        } catch (error) {
            await auditService.createLog(req, {
                action: 'GUARDAR_ANOTACIONES_POR_ARCHIVO',
                module: 'PDF Viewer',
                entityId: null,
                details: {
                    message: 'Error al guardar anotaciones por archivo',
                    error: error.message,
                    archivo_nombre: req.body?.archivo_nombre || null,
                    usuario_id: req.user?.id || null,
                    status: 'ERROR'
                }
            });

            console.error('Error al guardar anotaciones por archivo:', error);
            res.status(400).json({
                success: false,
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    async obtenerPorDocumento(req, res) {
        try {
            const { documentoId } = req.params;
            // Ya no necesitamos userId porque obtenemos por archivo_nombre

            // En este caso, documentoId es realmente el nombre del archivo (archivo_nombre)
            const archivoNombre = documentoId;

            const anotaciones = await anotacionService.obtenerAnotacionesPorArchivoSinUsuario(
                archivoNombre
            );

            await auditService.createLog(req, {
                action: 'OBTENER_ANOTACIONES',
                module: 'PDF Viewer',
                entityId: null,
                details: {
                    message: 'Anotaciones obtenidas correctamente',
                    archivo_nombre: archivoNombre,
                    total_anotaciones: anotaciones.length,
                    status: 'SUCCESS'
                }
            });

            res.status(200).json({
                success: true,
                message: 'Anotaciones obtenidas correctamente',
                data: anotaciones
            });
        } catch (error) {
            console.error('Error al obtener anotaciones:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async obtenerPorArchivo(req, res) {
        try {
            const { nombreArchivo } = req.params;
            const userId = req.user.id;

            const anotaciones = await anotacionService.obtenerAnotacionesPorArchivo(
                nombreArchivo,
                userId
            );

            await auditService.createLog(req, {
                action: 'OBTENER_ANOTACIONES_POR_ARCHIVO',
                module: 'PDF Viewer',
                entityId: null,
                details: {
                    message: 'Anotaciones obtenidas correctamente por archivo',
                    archivo_nombre: nombreArchivo,
                    usuario_id: userId,
                    total_anotaciones: anotaciones.length,
                    status: 'SUCCESS'
                }
            });

            res.status(200).json({
                success: true,
                message: 'Anotaciones obtenidas correctamente',
                data: anotaciones
            });
        } catch (error) {
            console.error('Error al obtener anotaciones por archivo:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async eliminar(req, res) {
        try {
            const { anotacion_id } = req.body;
            const userId = req.user.id;

            if (!anotacion_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Se requiere el ID de la anotación'
                });
            }

            const anotacion = await anotacionService.eliminarAnotacion(
                parseInt(anotacion_id),
                userId
            );

            await auditService.createLog(req, {
                action: 'ELIMINAR_ANOTACION',
                module: 'PDF Viewer',
                entityId: parseInt(anotacion_id),
                details: {
                    message: 'Anotación eliminada correctamente',
                    anotacion_id: anotacion_id,
                    usuario_id: userId,
                    status: 'SUCCESS'
                }
            });

            res.status(200).json({
                success: true,
                message: 'Anotación eliminada correctamente',
                data: anotacion
            });
        } catch (error) {
            await auditService.createLog(req, {
                action: 'ELIMINAR_ANOTACION',
                module: 'PDF Viewer',
                entityId: null,
                details: {
                    message: 'Error al eliminar anotación',
                    error: error.message,
                    usuario_id: req.user?.id || null,
                    status: 'ERROR'
                }
            });

            console.error('Error al eliminar anotación:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async eliminarPorArchivo(req, res) {
        try {
            const { nombreArchivo } = req.params;
            const userId = req.user.id;

            if (!nombreArchivo) {
                return res.status(400).json({
                    success: false,
                    message: 'Se requiere el nombre del archivo'
                });
            }

            const resultados = await anotacionService.eliminarAnotacionesPorArchivo(
                nombreArchivo,
                userId
            );

            await auditService.createLog(req, {
                action: 'ELIMINAR_ANOTACIONES_POR_ARCHIVO',
                module: 'PDF Viewer',
                entityId: null,
                details: {
                    message: 'Anotaciones del archivo eliminadas correctamente',
                    archivo_nombre: nombreArchivo,
                    usuario_id: userId,
                    total_eliminadas: resultados.length,
                    status: 'SUCCESS'
                }
            });

            res.status(200).json({
                success: true,
                message: 'Anotaciones del archivo eliminadas correctamente',
                data: resultados
            });
        } catch (error) {
            await auditService.createLog(req, {
                action: 'ELIMINAR_ANOTACIONES_POR_ARCHIVO',
                module: 'PDF Viewer',
                entityId: null,
                details: {
                    message: 'Error al eliminar anotaciones del archivo',
                    error: error.message,
                    archivo_nombre: req.params?.nombreArchivo || null,
                    usuario_id: req.user?.id || null,
                    status: 'ERROR'
                }
            });

            console.error('Error al eliminar anotaciones del archivo:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async eliminarPorDocumento(req, res) {
        try {
            const { documento_id } = req.body;
            const userId = req.user.id;

            if (!documento_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Se requiere el ID del documento'
                });
            }

            const resultados = await anotacionService.eliminarAnotacionesPorDocumento(
                parseInt(documento_id),
                userId
            );

            await auditService.createLog(req, {
                action: 'ELIMINAR_ANOTACIONES_DOCUMENTO',
                module: 'PDF Viewer',
                entityId: parseInt(documento_id),
                details: {
                    message: 'Anotaciones del documento eliminadas correctamente',
                    documento_id: documento_id,
                    usuario_id: userId,
                    total_eliminadas: resultados.length,
                    status: 'SUCCESS'
                }
            });

            res.status(200).json({
                success: true,
                message: 'Anotaciones del documento eliminadas correctamente',
                data: resultados
            });
        } catch (error) {
            await auditService.createLog(req, {
                action: 'ELIMINAR_ANOTACIONES_DOCUMENTO',
                module: 'PDF Viewer',
                entityId: null,
                details: {
                    message: 'Error al eliminar anotaciones del documento',
                    error: error.message,
                    usuario_id: req.user?.id || null,
                    status: 'ERROR'
                }
            });

            console.error('Error al eliminar anotaciones del documento:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async vaciar(req, res) {
        try {
            const { anotacion_id } = req.body;
            const userId = req.user.id;

            if (!anotacion_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Se requiere el ID de la anotación'
                });
            }

            const anotacion = await anotacionService.vaciarAnotacion(
                parseInt(anotacion_id),
                userId
            );

            await auditService.createLog(req, {
                action: 'VACIAR_ANOTACION',
                module: 'PDF Viewer',
                entityId: parseInt(anotacion_id),
                details: {
                    message: 'Anotación vaciada correctamente',
                    anotacion_id: anotacion_id,
                    usuario_id: userId,
                    status: 'SUCCESS'
                }
            });

            res.status(200).json({
                success: true,
                message: 'Anotación vaciada correctamente',
                data: anotacion
            });
        } catch (error) {
            await auditService.createLog(req, {
                action: 'VACIAR_ANOTACION',
                module: 'PDF Viewer',
                entityId: null,
                details: {
                    message: 'Error al vaciar anotación',
                    error: error.message,
                    usuario_id: req.user?.id || null,
                    status: 'ERROR'
                }
            });

            console.error('Error al vaciar anotación:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async vaciarPorArchivo(req, res) {
        try {
            const { archivo_nombre } = req.body;
            const userId = req.user.id;

            if (!archivo_nombre) {
                return res.status(400).json({
                    success: false,
                    message: 'Se requiere el nombre del archivo'
                });
            }

            const anotacion = await anotacionService.vaciarAnotacionesPorArchivo(
                archivo_nombre,
                userId
            );

            await auditService.createLog(req, {
                action: 'VACIAR_ANOTACIONES_POR_ARCHIVO',
                module: 'PDF Viewer',
                entityId: null,
                details: {
                    message: 'Anotaciones del archivo vaciadas correctamente',
                    archivo_nombre: archivo_nombre,
                    usuario_id: userId,
                    status: 'SUCCESS'
                }
            });

            res.status(200).json({
                success: true,
                message: 'Anotaciones del archivo vaciadas correctamente',
                data: anotacion
            });
        } catch (error) {
            await auditService.createLog(req, {
                action: 'VACIAR_ANOTACIONES_POR_ARCHIVO',
                module: 'PDF Viewer',
                entityId: null,
                details: {
                    message: 'Error al vaciar anotaciones del archivo',
                    error: error.message,
                    archivo_nombre: req.body?.archivo_nombre || null,
                    usuario_id: req.user?.id || null,
                    status: 'ERROR'
                }
            });

            console.error('Error al vaciar anotaciones del archivo:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async vaciarPorDocumento(req, res) {
        try {
            const { documento_id } = req.body;
            const userId = req.user.id;

            if (!documento_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Se requiere el ID del documento'
                });
            }

            const anotacion = await anotacionService.vaciarAnotacionesPorDocumento(
                parseInt(documento_id),
                userId
            );

            await auditService.createLog(req, {
                action: 'VACIAR_ANOTACIONES_DOCUMENTO',
                module: 'PDF Viewer',
                entityId: parseInt(documento_id),
                details: {
                    message: 'Anotaciones del documento vaciadas correctamente',
                    documento_id: documento_id,
                    usuario_id: userId,
                    status: 'SUCCESS'
                }
            });

            res.status(200).json({
                success: true,
                message: 'Anotaciones del documento vaciadas correctamente',
                data: anotacion
            });
        } catch (error) {
            await auditService.createLog(req, {
                action: 'VACIAR_ANOTACIONES_DOCUMENTO',
                module: 'PDF Viewer',
                entityId: null,
                details: {
                    message: 'Error al vaciar anotaciones del documento',
                    error: error.message,
                    usuario_id: req.user?.id || null,
                    status: 'ERROR'
                }
            });

            console.error('Error al vaciar anotaciones del documento:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async exportar(req, res) {
        try {
            const { documentoId } = req.params;
            const userId = req.user.id;

            const datosExportacion = await anotacionService.exportarAnotaciones(
                parseInt(documentoId)
            );

            await auditService.createLog(req, {
                action: 'EXPORTAR_ANOTACIONES',
                module: 'PDF Viewer',
                entityId: parseInt(documentoId),
                details: {
                    message: 'Anotaciones exportadas correctamente',
                    documento_id: documentoId,
                    usuario_id: userId,
                    total_anotaciones: datosExportacion.metadata.total_anotaciones,
                    status: 'SUCCESS'
                }
            });

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition',
                `attachment; filename="anotaciones_documento_${documentoId}.json"`
            );
            res.send(JSON.stringify(datosExportacion, null, 2));
        } catch (error) {
            console.error('Error al exportar anotaciones:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async exportarPorArchivo(req, res) {
        try {
            const { nombreArchivo } = req.params;
            const userId = req.user.id;

            const datosExportacion = await anotacionService.exportarAnotacionesPorArchivo(
                nombreArchivo,
                userId
            );

            await auditService.createLog(req, {
                action: 'EXPORTAR_ANOTACIONES_POR_ARCHIVO',
                module: 'PDF Viewer',
                entityId: null,
                details: {
                    message: 'Anotaciones exportadas correctamente por archivo',
                    archivo_nombre: nombreArchivo,
                    usuario_id: userId,
                    total_anotaciones: datosExportacion.metadata.total_anotaciones,
                    status: 'SUCCESS'
                }
            });

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition',
                `attachment; filename="anotaciones_${nombreArchivo.replace(/[^a-z0-9]/gi, '_')}.json"`
            );
            res.send(JSON.stringify(datosExportacion, null, 2));
        } catch (error) {
            console.error('Error al exportar anotaciones por archivo:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new AnotacionesController();