const documentoService = require('../services/documento.service');
const auditService = require("../../audit/services/audit.service"); // Importar auditoría
const path = require('path');
const fs = require('fs');

class DocumentoController {

    async crear(req, res) {
        try {
            const documentoData = req.body;
            const userId = req.user.id;
            if (documentoData.autorizacionId) {
                documentoData.autorizacionId = parseInt(documentoData.autorizacionId);
            }
            // Validar que el archivo existe
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Se requiere un archivo adjunto'
                });
            }
            const documento = await documentoService.crearDocumento(documentoData, req.file, userId);
            await auditService.createLog(req, {
                action: 'CREATE_DOCUMENT',
                module: 'Explorador',
                entityId: documento.id, // ahora sí: documento creado
                details: {
                    message: 'Documento creado correctamente',
                    titulo: documento.titulo,
                    documentId: documento.id,
                    fileName: req.file.originalname,
                    createdBy: userId,
                    status: 'SUCCESS'
                }
            });
            res.status(201).json({
                success: true,
                message: 'Documento creado correctamente',
                data: documento
            });
        }
        catch (error) {
            await auditService.createLog(req, {
                action: 'CREATE_DOCUMENT',
                module: 'Explorador',
                entityId: null,
                details: {
                    message: 'Error al crear documento',
                    error: error.message,
                    createdBy: req.user?.id || null,
                    status: 'ERROR'
                }
            });
            console.error('Error detallado:', error);
            res.status(400).json({
                success: false,
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }
    // Obtener documento por ID
    async getById(req, res) {
        try {
            const {
                id
            } = req.params;
            const documento = await documentoService.obtenerDocumentoPorId(id);
            res.status(200).json({
                success: true,
                message: 'Documento obtenido correctamente',
                data: documento
            });
        }
        catch (error) {
            res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }
    // Obtener documentos por autorización
    async getByAutorizacion(req, res) {
        try {
            const { autorizacionId } = req.params;
            const userId = req.user.id; // Obtener el ID del usuario autenticado

            const documentos = await documentoService.obtenerDocumentosPorAutorizacion(autorizacionId, userId);
            
            res.status(200).json({
                success: true,
                message: 'Documentos obtenidos correctamente',
                data: documentos
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Crear nueva versión de documento
    // Crear nueva versión de documento
    async crearVersion(req, res) {
        try {
            const {
                id
            } = req.params;
            const documentoData = req.body;
            const archivo = req.file;
            const userId = req.user.id;
            // Validar archivo
            if (!archivo) {
                return res.status(400).json({
                    success: false,
                    message: 'Archivo es requerido para nueva versión'
                });
            }
            // Crear nueva versión
            const nuevaVersion = await documentoService.crearNuevaVersion(id, documentoData, archivo, userId);

            await auditService.createLog(req, {
                action: 'CREATE_DOCUMENT_VERSION',
                module: 'Explorador',
                entityId: id, // documento versionado
                details: {
                    message: 'Se creó una nueva versión del documento',
                    titulo: documentoData.titulo,
                    documentId: id,
                    versionId: nuevaVersion.id,
                    fileName: archivo.originalname,
                    createdBy: userId,
                    status: 'SUCCESS'
                }
            });
            res.status(201).json({
                success: true,
                message: 'Nueva versión creada correctamente',
                data: nuevaVersion
            });
        }
        catch (error) {

            await auditService.createLog(req, {
                action: 'CREATE_DOCUMENT_VERSION',
                module: 'Explorador',
                entityId: req.params.id,
                details: {
                    message: 'Error al crear nueva versión del documento',
                    error: error.message,
                    createdBy: req.user?.id || null,
                    status: 'ERROR'
                }
            });
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    // Actualizar documento
    async update(req, res) {
        try {
            const {
                id
            } = req.params;
            const documento = await documentoService.actualizarDocumento(id, req.body);
            res.status(200).json({
                success: true,
                message: 'Documento actualizado correctamente',
                data: documento
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    // Eliminar documento
    async delete(req, res) {
        try {
            const {
                id
            } = req.params;
            await documentoService.eliminarDocumento(id);
            res.status(200).json({
                success: true,
                message: 'Documento eliminado correctamente'
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    // Buscar documentos
    async search(req, res) {
        try {
            const criterios = req.query;
            const documentos = await documentoService.buscarDocumentos(criterios);
            res.status(200).json({
                success: true,
                message: 'Documentos encontrados',
                data: documentos
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }



    async descargarArchivo(req, res) {
        try {
            const { archivoId } = req.params;
            const userId = req.user.id;

            const archivo = await documentoService.obtenerArchivoDigital(archivoId);

            // ⬅️ Subimos hasta la raíz real del proyecto
            const ROOT_PATH = path.resolve(__dirname, '../../../..');

            const filePath = path.join(
                ROOT_PATH,
                'storage',
                archivo.ruta_almacenamiento
            );

            if (!fs.existsSync(filePath)) {
                throw new Error('Archivo no encontrado en el servidor');
            }

            await auditService.createLog(req, {
                action: 'DOWNLOAD_DOCUMENT',
                module: 'Explorador',
                entityId: archivoId,
                details: {
                    message: 'Archivo descargado correctamente',
                    archivoId,
                    documentId: archivo.documento_id,
                    fileName: archivo.nombre_archivo,
                    downloadedBy: userId,
                    status: 'SUCCESS'
                }
            });

            res.download(filePath, archivo.nombre_archivo);

        } catch (error) {

            await auditService.createLog(req, {
                action: 'DOWNLOAD_DOCUMENT',
                module: 'Explorador',
                entityId: req.params.archivoId,
                details: {
                    message: 'Error al descargar archivo',
                    error: error.message,
                    downloadedBy: req.user?.id || null,
                    status: 'ERROR'
                }
            });

            res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }

    // Descargar archivo
    // Descargar archivo
    // async descargarArchivo(req, res) {
    //     try {
    //         const {
    //             archivoId
    //         } = req.params;
    //         const userId = req.user.id;
    //         const archivo = await documentoService.obtenerArchivoDigital(archivoId);
    //         const fs = require('fs');
    //         if (!fs.existsSync(archivo.rutaAlmacenamiento)) {
    //             throw new Error('Archivo no encontrado en el servidor');
    //         }

    //         await auditService.createLog(req, {
    //             action: 'DOWNLOAD_DOCUMENT',
    //             module: 'Explorador',
    //             entityId: archivoId,
    //             details: {
    //                 message: 'Archivo descargado correctamente',
    //                 archivoId: archivoId,
    //                 documentId: archivo.documentoId || null,
    //                 fileName: archivo.nombreOriginal || archivo.nombreArchivo,
    //                 downloadedBy: userId,
    //                 status: 'SUCCESS'
    //             }
    //         });
    //         res.download(archivo.rutaAlmacenamiento, archivo.nombreOriginal || archivo.nombreArchivo);
    //     }
    //     catch (error) {

    //         await auditService.createLog(req, {
    //             action: 'DOWNLOAD_DOCUMENT',
    //             module: 'Explorador',
    //             entityId: req.params.archivoId,
    //             details: {
    //                 message: 'Error al descargar archivo',
    //                 error: error.message,
    //                 downloadedBy: req.user?.id || null,
    //                 status: 'ERROR'
    //             }
    //         });
    //         res.status(404).json({
    //             success: false,
    //             message: error.message
    //         });
    //     }
    // }
    // Obtener estadísticas
    async getEstadisticas(req, res) {
        try {
            const Documento = require('../models/documento.model');
            const ArchivoDigital = require('../models/archivo-digital.model');
            const totalDocumentos = await Documento.count();
            const totalArchivos = await ArchivoDigital.count();
            const documentosPorEstado = await Documento.findAll({
                attributes: ['estado_digitalizacion', [Documento.sequelize.fn('COUNT', Documento.sequelize.col('id')), 'count']],
                group: ['estado_digitalizacion']
            });
            res.status(200).json({
                success: true,
                message: 'Estadísticas obtenidas correctamente',
                data: {
                    totalDocumentos,
                    totalArchivos,
                    documentosPorEstado
                }
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
}
module.exports = new DocumentoController();