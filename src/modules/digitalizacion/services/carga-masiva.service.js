// services/carga-masiva.service.js
const AdmZip = require('adm-zip');
const fs = require('fs').promises;
const path = require('path');
const Autorizacion = require('../../explorer/models/autorizacion.model');
const Municipio = require('../../municipios/models/municipio.model');
const Modalidad = require('../../explorer/models/Modalidad.model');
const TiposAutorizacion = require('../../explorer/models/TiposAutorizacion.model');
const Documento = require('../../explorer/models/documento.model');
const ArchivoDigital = require('../../explorer/models/archivo-digital.model');
const User = require('../../users/models/user.model');
const crypto = require('crypto');
const { Op } = require('sequelize');
const OCRProcessorService = require('./ocr-processor.service');
class CargaMasivaService {
    constructor() {
        this.autorizacionModel = Autorizacion;
        this.municipioModel = Municipio;
        this.modalidadModel = Modalidad;
        this.tiposAutorizacionModel = TiposAutorizacion;
        this.documentoModel = Documento;
        this.archivoDigitalModel = ArchivoDigital;
    }

    // Extraer archivos de ZIP/RAR
    async extraerArchivosComprimidos(archivoBuffer, extension) {
        try {
            const archivos = [];
            const tempDir = path.join(process.cwd(), 'temp', Date.now().toString());

            await fs.mkdir(tempDir, { recursive: true });

            if (extension === '.zip') {
                const zip = new AdmZip(archivoBuffer);
                zip.extractAllTo(tempDir, true);
            } else if (extension === '.rar') {
                // Para RAR necesitarías una librería como unrar
                throw new Error('Formato RAR no soportado actualmente');
            }

            // Recorrer estructura de carpetas
            const leerCarpetasRecursivamente = async (dir, basePath = '') => {
                const items = await fs.readdir(dir, { withFileTypes: true });

                for (const item of items) {
                    const fullPath = path.join(dir, item.name);
                    const relativePath = path.join(basePath, item.name);

                    if (item.isDirectory()) {
                        await leerCarpetasRecursivamente(fullPath, relativePath);
                    } else if (item.isFile() && item.name.toLowerCase().endsWith('.pdf')) {
                        const buffer = await fs.readFile(fullPath);
                        archivos.push({
                            nombre: item.name,
                            buffer: buffer,
                            rutaRelativa: relativePath,
                            tamano: buffer.length,
                            extension: path.extname(item.name)
                        });
                    }
                }
            };

            await leerCarpetasRecursivamente(tempDir);

            // Limpiar directorio temporal
            await fs.rm(tempDir, { recursive: true, force: true });

            return archivos;
        } catch (error) {
            throw new Error(`Error al extraer archivos: ${error.message}`);
        }
    }


    parsearNombreArchivo(nombreArchivo) {
        try {
            const nombreSinExtension = nombreArchivo.replace(/\.pdf$/i, '');
            const nombreSinPaginas = nombreSinExtension.replace(/\s*\(\d+\s*(pag\.?)?\)$/i, '');
            const partes = nombreSinPaginas.split(/\s+/);

            if (partes.length < 2) {
                throw new Error(`Formato de nombre inválido: ${nombreArchivo}`);
            }

            const numeroAutorizacion = partes[0];
            const bloqueNumerico = partes[1];
            const tipoAbrev = partes.length >= 3 ? partes[2].toUpperCase() : null;

            const componentes = bloqueNumerico.split('-');
            if (componentes.length !== 4) {
                throw new Error(`Bloque numérico inválido: ${bloqueNumerico}`);
            }

            return {
                numeroAutorizacion,
                bloqueNumerico,
                municipioNum: parseInt(componentes[0]),
                modalidadNum: parseInt(componentes[1]),
                consecutivo1: componentes[2], // string
                consecutivo2: componentes[3], // string

                tipoAbrev,
                nombreOriginal: nombreArchivo
            };
        } catch (error) {
            throw new Error(`Error parseando archivo ${nombreArchivo}: ${error.message}`);
        }
    }

    // services/carga-masiva.service.js
    // services/carga-masiva.service.js
    // En el método buscarOCrearAutorizacion:
    async buscarOCrearAutorizacion(datosArchivo, userId) {
        console.log(datosArchivo);
        console.log("datosArchivo");

        const transaction = await this.autorizacionModel.sequelize.transaction();

        try {
            // Buscar municipio por número
            const municipio = await this.municipioModel.findOne({
                where: { num: datosArchivo.municipioNum }
            });

            if (!municipio) {
                throw new Error(`Municipio con número ${datosArchivo.municipioNum} no encontrado`);
            }

            // Buscar modalidad por número
            const modalidad = await this.modalidadModel.findOne({
                where: { num: datosArchivo.modalidadNum }
            });

            if (!modalidad) {
                throw new Error(`Modalidad con número ${datosArchivo.modalidadNum} no encontrada`);
            }

            // Buscar tipo de autorización por abreviatura
            const tipoAutorizacion = await this.tiposAutorizacionModel.findOne({
                where: { abreviatura: datosArchivo.tipoAbrev }
            });

            if (!tipoAutorizacion) {
                throw new Error(`Tipo de autorización con abreviatura ${datosArchivo.tipoAbrev} no encontrado`);
            }

            // **MODIFICACIÓN: Buscar autorización por la combinación de datos**
            let autorizacion = await this.autorizacionModel.findOne({
                where: {
                    municipioId: municipio.id,
                    modalidadId: modalidad.id,
                    tipoId: tipoAutorizacion.id,
                    consecutivo1: datosArchivo.consecutivo1,
                    consecutivo2: datosArchivo.consecutivo2
                },
                transaction
            });

            if (!autorizacion) {
                try {
                    // Crear nueva autorización - el trigger generará el numero_autorizacion automáticamente
                    autorizacion = await this.autorizacionModel.create({
                        // No pasar numeroAutorizacion - dejar que el trigger lo genere
                        numeroAutorizacion: datosArchivo.numeroAutorizacion,
                        municipioId: municipio.id,
                        modalidadId: modalidad.id,
                        tipoId: tipoAutorizacion.id,
                        consecutivo1: datosArchivo.consecutivo1,
                        consecutivo2: datosArchivo.consecutivo2,
                        activo: true,
                        fechaCreacion: new Date(),
                        fechaSolicitud: new Date()

                    }, {
                        transaction,
                        returning: true // Asegurar que devuelva el registro creado
                    });
                } catch (createError) {
                    // Si falla por trigger, intentar buscar de nuevo
                    if (createError.name === 'SequelizeUniqueConstraintError') {
                        autorizacion = await this.autorizacionModel.findOne({
                            where: {
                                municipioId: municipio.id,
                                modalidadId: modalidad.id,
                                tipoId: tipoAutorizacion.id,
                                consecutivo1: datosArchivo.consecutivo1,
                                consecutivo2: datosArchivo.consecutivo2
                            },
                            transaction
                        });

                        if (!autorizacion) {
                            throw createError;
                        }
                    } else {
                        throw createError;
                    }
                }
            }

            await transaction.commit();
            return { autorizacion, municipio, modalidad, tipoAutorizacion };
        } catch (error) {
            await transaction.rollback();
            console.error("Error en buscarOCrearAutorizacion:", error);
            throw error;
        }
    }
    // Generar nombre de carpeta según función PostgreSQL
    generarNombreCarpeta(numeroAutorizacion, municipioNum, modalidadNum, consecutivo1, consecutivo2, tipoAbrev) {
        return [
            numeroAutorizacion,
            municipioNum.toString().padStart(2, '0'),
            modalidadNum.toString().padStart(2, '0'),
            consecutivo1.toString().padStart(4, '0'),
            consecutivo2.toString().padStart(4, '0'),
            tipoAbrev
        ].join('_');
    }

    // Procesar archivo individual
    async procesarArchivoMasivo(archivoData, autorizacionInfo, userId, opciones = {}) {
        const { useOcr = false } = opciones;
        const transaction = await this.documentoModel.sequelize.transaction();

        try {
            const { autorizacion, municipio, tipoAutorizacion } = autorizacionInfo;

            // Determinar si procesamos con OCR
            let bufferFinal = archivoData.buffer;
            let textoOCR = null;
            let estadoOCR = 'pendiente';

            if (useOcr) {
                estadoOCR = 'procesando';
                // Procesar con OCR
                const resultadoOCR = await OCRProcessorService.procesarPDFConOCR(
                    archivoData.buffer,
                    archivoData.nombre
                );

                if (resultadoOCR.success) {
                    bufferFinal = resultadoOCR.pdfBuffer;
                    textoOCR = resultadoOCR.text;
                    estadoOCR = 'completado';
                } else {
                    estadoOCR = 'fallido';
                    // Puedes decidir si continuar sin OCR o fallar
                    console.warn(`OCR falló para ${archivoData.nombre}: ${resultadoOCR.error}`);
                }
            }

            // Buscar si ya existe documento para esta autorización
            const documentoExistente = await this.documentoModel.findOne({
                where: {
                    autorizacionId: autorizacion.id,
                    version_actual: true
                },
                transaction
            });

            // Crear estructura de carpetas
            const estructura = this.construirEstructuraCarpetasNumericos({
                municipio: { id: municipio.num },
                tipoAutorizacion: { id: tipoAutorizacion.id, abreviatura: tipoAutorizacion.abreviatura },
                numero: autorizacion.numeroAutorizacion,
                consecutivo: autorizacion.consecutivo1,
                nombreCarpeta: autorizacion.nombreCarpeta
            });

            // Crear carpetas
            await this.crearEstructuraCarpetas(estructura.rutaCompleta);

            // Generar nombre de archivo
            const version = documentoExistente ? documentoExistente.version + 1 : 1;
            const nombreArchivo = this.generarNombreArchivoMasivo(
                autorizacion,
                archivoData.nombre,
                version
            );

            const rutaArchivo = path.join(estructura.rutaCompleta, nombreArchivo);

            // Guardar archivo físicamente (con OCR aplicado si corresponde)
            await fs.writeFile(rutaArchivo, bufferFinal);

            // Calcular checksums del archivo final
            const checksumMd5 = crypto.createHash('md5').update(bufferFinal).digest('hex');
            const checksumSha256 = crypto.createHash('sha256').update(bufferFinal).digest('hex');

            // Si existe documento anterior, marcarlo como no actual
            if (documentoExistente) {
                await documentoExistente.update({ version_actual: false }, { transaction });
            }

            // Crear nuevo documento
            const nuevoDocumento = await this.documentoModel.create({
                autorizacionId: autorizacion.id,
                titulo: `Documento de autorización ${autorizacion.numeroAutorizacion}`,
                descripcion: `Documento cargado masivamente: ${archivoData.nombreOriginal}`,
                version: version,
                version_actual: true,
                documentoPadreId: documentoExistente ? documentoExistente.id : null,
                estadoDigitalizacion: 'digitalizado',
                paginas: this.estimarPaginas(bufferFinal),
                creadoPor: userId
            }, { transaction });

            // Crear registro de archivo digital
            const archivoDigital = await this.archivoDigitalModel.create({
                documento_id: nuevoDocumento.id,
                nombre_archivo: nombreArchivo,
                ruta_almacenamiento: path.join(estructura.rutaRelativa, nombreArchivo),
                mime_type: 'application/pdf',
                tamano_bytes: bufferFinal.length,
                checksum_md5: checksumMd5,
                checksum_sha256: checksumSha256,
                estado_ocr: estadoOCR,
                texto_ocr: textoOCR, // NUEVO: guardar texto extraído
                fecha_digitalizacion: new Date(),
                digitalizado_por: userId,
                version_archivo: version,
                total_paginas: this.estimarPaginas(bufferFinal)
            }, { transaction });

            // // Si hay texto OCR, puedes también guardarlo en una tabla separada
            // if (textoOCR) {
            //     await this.guardarTextoOCR(nuevoDocumento.id, textoOCR, transaction);
            // }

            await transaction.commit();

            return {
                autorizacionId: autorizacion.id,
                numeroAutorizacion: autorizacion.numeroAutorizacion,
                documentoId: nuevoDocumento.id,
                version: version,
                archivo: nombreArchivo,
                ocrAplicado: useOcr,
                estadoOCR: estadoOCR,
                exito: true
            };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
        /**
     * Guardar texto OCR en tabla separada (opcional)
     */
    async guardarTextoOCR(documentoId, texto, transaction) {
        // Puedes crear una tabla TextoOCR o usar la existente
        // Ejemplo: await TextoOCR.create({ documentoId, texto }, { transaction });
    }
    // Construir estructura de carpetas (igual que en DocumentoService)
    construirEstructuraCarpetasNumericos(autorizacion) {
        const municipioId = String(autorizacion.municipio.id).padStart(2, '0');
        const tipoAutorizacionId = String(autorizacion.tipoAutorizacion.id).padStart(2, '0');
        const carpetaAutorizacion = autorizacion.nombreCarpeta;

        const rutaRelativa = path.join(
            municipioId,
            tipoAutorizacionId,
            carpetaAutorizacion
        );

        const basePath = process.env.FILE_STORAGE_PATH || './storage';
        const rutaCompleta = path.join(basePath, rutaRelativa);

        return { rutaRelativa, rutaCompleta, carpetaAutorizacion };
    }

    async crearEstructuraCarpetas(ruta) {
        try {
            await fs.mkdir(ruta, { recursive: true });
        } catch (error) {
            throw new Error(`Error al crear carpetas: ${error.message}`);
        }
    }

    generarNombreArchivoMasivo(autorizacion, nombreOriginal, version) {
        const extension = path.extname(nombreOriginal);
        const nombreBase = autorizacion.nombreCarpeta;
        const timestamp = Date.now();

        return `${nombreBase}_v${version}_${timestamp}${extension}`;
    }

    estimarPaginas(buffer) {
  const texto = buffer.toString('latin1');
    const matches = texto.match(/\/Type\s*\/Page\b/g);
    return matches ? matches.length : 1;
    }

    // Método principal para procesar carga masiva
     async procesarCargaMasiva(archivos, userId, opciones = {}) {
        const { useOcr = false, loteSize = 5 } = opciones; // Reducir loteSize para OCR

        try {
            const resultados = {
                total: archivos.length,
                exitosos: 0,
                fallidos: 0,
                conOCR: useOcr,
                detalles: []
            };

            // Para OCR, procesar secuencialmente o en lotes pequeños
            if (useOcr) {
                // Procesar uno por uno para no saturar Python
                for (const archivo of archivos) {
                    try {
                        const datosArchivo = this.parsearNombreArchivo(archivo.nombre);
                        const autorizacionInfo = await this.buscarOCrearAutorizacion(datosArchivo, userId);
                        
                        const resultado = await this.procesarArchivoMasivo(
                            { ...archivo, nombreOriginal: datosArchivo.nombreOriginal },
                            autorizacionInfo,
                            userId,
                            { useOcr: true } // Pasar opción de OCR
                        );

                        resultados.exitosos++;
                        resultados.detalles.push({
                            archivo: archivo.nombre,
                            exito: true,
                            ...resultado
                        });
                    } catch (error) {
                        resultados.fallidos++;
                        resultados.detalles.push({
                            archivo: archivo.nombre,
                            exito: false,
                            error: error.message
                        });
                    }
                }
            } else {
                // Procesamiento normal en lotes paralelos
                for (let i = 0; i < archivos.length; i += loteSize) {
                    const lote = archivos.slice(i, i + loteSize);
                    const promesas = lote.map(async (archivo) => {
                        // ... código existente sin OCR ...
                    });
                    await Promise.all(promesas);
                }
            }

            return resultados;
        } catch (error) {
            throw new Error(`Error en carga masiva: ${error.message}`);
        }
    }

    // Método para recibir archivos directamente (no comprimidos)
    async procesarArchivosDirectos(archivos, userId,opciones = {}) {
        const archivosProcesados = archivos.map(archivo => ({
            nombre: archivo.originalname,
            buffer: archivo.buffer,
            tamano: archivo.size
        }));

        return await this.procesarCargaMasiva(archivosProcesados, userId,opciones);
    }
}

module.exports = new CargaMasivaService();