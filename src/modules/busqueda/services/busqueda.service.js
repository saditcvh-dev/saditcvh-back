const Documento = require('../../explorer/models/documento.model');
const ArchivoDigital = require('../../explorer/models/archivo-digital.model');
const Autorizacion = require('../../explorer/models/autorizacion.model');
const Municipio = require('../../municipios/models/municipio.model');
const Modalidad = require('../../explorer/models/Modalidad.model');
const TiposAutorizacion = require('../../explorer/models/TiposAutorizacion.model');
const { Op } = require('sequelize');

class BusquedaService {
    /**
     * Búsqueda general en toda la base de datos
     * @param {string} termino - Término de búsqueda
     * @param {Object} filtros - Filtros adicionales
     * @returns {Promise<Array>} Resultados de búsqueda
     */
    async busquedaGeneral(termino, filtros = {}) {
        try {
            console.log('Iniciando búsqueda general con término:', termino);

            // Asegurar que los modelos están cargados
            await this.verificarModelos();

            const busquedas = await Promise.all([
                this.buscarEnAutorizaciones(termino, filtros),
                this.buscarEnDocumentos(termino, filtros),
                this.buscarEnArchivosDigitales(termino, filtros)
            ]);

            console.log('Búsquedas completadas, combinando resultados...');

            // Combinar y organizar resultados
            const resultados = this.combinarResultados(busquedas);

            // Agrupar por autorización/documento para evitar duplicados
            return this.agruparResultados(resultados);
        } catch (error) {
            console.error('Error detallado en busquedaGeneral:', error);
            throw new Error(`Error en búsqueda general: ${error.message}`);
        }
    }
    async verificarModelos() {
        try {
            // Forzar la carga de asociaciones
            const Autorizacion = require('../../explorer/models/autorizacion.model');
            const Documento = require('../../explorer/models/documento.model');

            // Verificar si las asociaciones existen
            console.log('Verificando asociaciones entre modelos...');

            // Esto debería cargar las asociaciones si no están cargadas
            const asociacionesDoc = Object.keys(Documento.associations || {});
            const asociacionesAuth = Object.keys(Autorizacion.associations || {});

            // console.log('Asociaciones en Documento:', asociacionesDoc);
            // console.log('Asociaciones en Autorizacion:', asociacionesAuth);

        } catch (error) {
            console.error('Error al verificar modelos:', error);
            throw error;
        }
    }
    // async busquedaGeneral(termino, filtros = {}) {
    //     try {
    //         const busquedas = await Promise.all([
    //             this.buscarEnAutorizaciones(termino, filtros),
    //             this.buscarEnDocumentos(termino, filtros),
    //             this.buscarEnArchivosDigitales(termino, filtros)
    //         ]);

    //         // Combinar y organizar resultados
    //         const resultados = this.combinarResultados(busquedas);

    //         // Agrupar por autorización/documento para evitar duplicados
    //         return this.agruparResultados(resultados);
    //     } catch (error) {
    //         throw new Error(`Error en búsqueda general: ${error.message}`);
    //     }
    // }

    /**
     * Buscar en Autorizaciones
     */
    async buscarEnAutorizaciones(termino, filtros) {
        const whereClause = this.construirWhereClauseAutorizacion(termino, filtros);

        // 1️ Buscar autorizaciones (SIN documentos)
        const autorizaciones = await Autorizacion.findAll({
            where: whereClause,
            include: [
                {
                    model: Municipio,
                    as: 'municipio',
                    attributes: ['id', 'num', 'nombre']
                },
                {
                    model: Modalidad,
                    as: 'modalidad',
                    attributes: ['id', 'num', 'nombre']
                },
                {
                    model: TiposAutorizacion,
                    as: 'tipoAutorizacion',
                    attributes: ['id', 'nombre']
                }
            ],
            limit: 50
        });

        if (!autorizaciones.length) return [];

        // 2️Buscar documentos relacionados
        const autorizacionIds = autorizaciones.map(a => a.id);

        const documentos = await Documento.findAll({
            where: {
                autorizacion_id: { [Op.in]: autorizacionIds },
                deleted_at: null
            },
            include: [
                {
                    model: ArchivoDigital,
                    as: 'archivosDigitales',
                    attributes: ['id', 'nombre_archivo', 'estado_ocr'],
                    separate: true,
                    limit: 5
                }
            ]
        });

        // 3️ Agrupar documentos por autorización
        const documentosPorAutorizacion = documentos.reduce((acc, doc) => {
            acc[doc.autorizacionId] ||= [];
            acc[doc.autorizacionId].push(doc);
            return acc;
        }, {});

        //  Adjuntar documentos manualmente
        return autorizaciones.map(auth => {
            auth.setDataValue(
                'documentos',
                documentosPorAutorizacion[auth.id] || []
            );
            return auth;
        });
    }
    // async buscarEnAutorizaciones(termino, filtros) {
    //     const whereClause = this.construirWhereClauseAutorizacion(termino, filtros);

    //     return await Autorizacion.findAll({
    //         where: whereClause,
    //         include: [
    //             {
    //                 model: Municipio,
    //                 as: 'municipio',
    //                 attributes: ['id', 'num', 'nombre']
    //             },
    //             {
    //                 model: Modalidad,
    //                 as: 'modalidad',
    //                 attributes: ['id', 'num', 'nombre']
    //             },
    //             {
    //                 model: TiposAutorizacion,
    //                 as: 'tipoAutorizacion',
    //                 attributes: ['id', 'nombre']
    //             },
    //             {
    //                 model: Documento,
    //                 as: 'documentos',
    //                 include: [{
    //                     model: ArchivoDigital,
    //                     as: 'archivosDigitales',
    //                     attributes: ['id', 'nombre_archivo', 'estado_ocr']
    //                 }],
    //                 separate: true,
    //                 limit: 5
    //             }
    //         ],
    //         limit: 50
    //     });
    // }

    /**
     * Buscar en Documentos
     */
    async buscarEnDocumentos(termino, filtros) {
        try {
            const whereDocumento = this.construirWhereClauseDocumento(termino, filtros);

            console.log('Buscando documentos con where:', JSON.stringify(whereDocumento));

            // Cargar los modelos aquí para asegurar que están disponibles
            const Documento = require('../../explorer/models/documento.model');
            const Autorizacion = require('../../explorer/models/autorizacion.model');
            const ArchivoDigital = require('../../explorer/models/archivo-digital.model');

            // Construir condiciones de búsqueda para autorización si hay término
            const includeAutorizacion = {
                model: Autorizacion,
                as: 'autorizacion',
                attributes: ['id', 'numeroAutorizacion', 'nombreCarpeta'],
                required: false  // LEFT JOIN en lugar de INNER JOIN
            };

            // Si hay término, agregar condiciones a la autorización
            if (termino) {
                includeAutorizacion.where = {
                    [Op.or]: [
                        { numeroAutorizacion: { [Op.iLike]: `%${termino}%` } },
                        { nombreCarpeta: { [Op.iLike]: `%${termino}%` } }
                    ]
                };
            }

            const documentos = await Documento.findAll({
                where: whereDocumento,
                include: [
                    includeAutorizacion,
                    {
                        model: ArchivoDigital,
                        as: 'archivosDigitales',
                        attributes: ['id', 'nombre_archivo', 'texto_ocr', 'estado_ocr'],
                        separate: true,
                        limit: 10
                    }
                ],
                limit: 50
            });

            console.log(`Encontrados ${documentos.length} documentos`);
            return documentos;

        } catch (error) {
            console.error('Error en buscarEnDocumentos:', error);
            throw error;
        }
    }
    // async buscarEnDocumentos(termino, filtros) {
    //     const whereDocumento = this.construirWhereClauseDocumento(termino, filtros);

    //     const whereAutorizacion = {};
    //     if (termino) {
    //         whereAutorizacion[Op.or] = [
    //             { numeroAutorizacion: { [Op.iLike]: `%${termino}%` } }
    //         ];
    //     }

    //     return await Documento.findAll({
    //         where: whereDocumento,
    //         include: [
    //             {
    //                 model: Autorizacion,
    //                 as: 'autorizacion',
    //                 attributes: ['id', 'numeroAutorizacion', 'nombreCarpeta'],
    //                 required: false
    //             },
    //             {
    //                 model: ArchivoDigital,
    //                 as: 'archivosDigitales',
    //                 attributes: ['id', 'nombre_archivo', 'texto_ocr', 'estado_ocr'],
    //                 separate: true,
    //                 limit: 10
    //             }
    //         ],
    //         limit: 50
    //     });
    // }

    /**
     * Buscar en Archivos Digitales (OCR y metadatos)
     */
    async buscarEnArchivosDigitales(termino, filtros) {
        try {
            const whereArchivo = this.construirWhereClauseArchivo(termino, filtros);

            console.log('Buscando archivos con where:', JSON.stringify(whereArchivo));

            // Cargar modelos aquí
            const ArchivoDigital = require('../../explorer/models/archivo-digital.model');
            const Documento = require('../../explorer/models/documento.model');
            const Autorizacion = require('../../explorer/models/autorizacion.model');

            return await ArchivoDigital.findAll({
                where: whereArchivo,
                include: [
                    {
                        model: Documento,
                        as: 'documento',
                        attributes: ['id', 'titulo', 'numero_documento'],
                        required: false,  // LEFT JOIN
                        include: [
                            {
                                model: Autorizacion,
                                as: 'autorizacion',
                                attributes: ['id', 'numeroAutorizacion', 'nombreCarpeta'],
                                required: false  // LEFT JOIN
                            }
                        ]
                    }
                ],
                limit: 50
            });

        } catch (error) {
            console.error('Error en buscarEnArchivosDigitales:', error);
            throw error;
        }
    }
    // async buscarEnArchivosDigitales(termino, filtros) {
    //     const whereArchivo = this.construirWhereClauseArchivo(termino, filtros);

    //     const whereAutorizacion = {};
    //     if (termino) {
    //         whereAutorizacion.numeroAutorizacion = { [Op.iLike]: `%${termino}%` };
    //     }

    //     return await ArchivoDigital.findAll({
    //         where: whereArchivo,
    //         include: [
    //             {
    //                 model: Documento,
    //                 as: 'documento',
    //                 attributes: ['id', 'titulo', 'numero_documento'],
    //                 required: false,
    //                 include: [
    //                     {
    //                         model: Autorizacion,
    //                         as: 'autorizacion',
    //                         attributes: ['id', 'numeroAutorizacion', 'nombreCarpeta'],
    //                         required: false,
    //                         where: Object.keys(whereAutorizacion).length ? whereAutorizacion : undefined
    //                     }
    //                 ]
    //             }
    //         ],
    //         limit: 50
    //     });
    // }


    /**
     * Construir cláusula WHERE para Autorizaciones
     */
    construirWhereClauseAutorizacion(termino, filtros) {
        const where = {
            [Op.or]: []
        };

        if (termino) {
            const terminoBusqueda = `%${termino}%`;
            where[Op.or].push(
                { numeroAutorizacion: { [Op.iLike]: terminoBusqueda } },
                { solicitante: { [Op.iLike]: terminoBusqueda } },
                { nombreCarpeta: { [Op.iLike]: terminoBusqueda } }
            );
        }

        // Aplicar filtros adicionales
        if (filtros.municipioId) {
            where.municipio_id = filtros.municipioId;
        }
        if (filtros.modalidadId) {
            where.modalidad_id = filtros.modalidadId;
        }
        if (filtros.activo !== undefined) {
            where.activo = filtros.activo;
        }

        return where;
    }

    /**
     * Construir cláusula WHERE para Documentos
     */
    construirWhereClauseDocumento(termino, filtros) {
        const where = {
            deleted_at: null,
            [Op.or]: []
        };

        if (termino) {
            const terminoBusqueda = `%${termino}%`;
            where[Op.or].push(
                { titulo: { [Op.iLike]: terminoBusqueda } },
                { descripcion: { [Op.iLike]: terminoBusqueda } },
                { numero_documento: { [Op.iLike]: terminoBusqueda } },
                { tipo_documento: { [Op.iLike]: terminoBusqueda } }
            );
        }

        if (filtros.confidencialidad) {
            where.confidencialidad = filtros.confidencialidad;
        }
        if (filtros.estadoDigitalizacion) {
            where.estado_digitalizacion = filtros.estadoDigitalizacion;
        }

        return where;
    }

    /**
     * Construir cláusula WHERE para Archivos Digitales
     */
    construirWhereClauseArchivo(termino, filtros) {
        const where = {
            [Op.or]: []
        };

        if (termino) {
            const terminoBusqueda = `%${termino}%`;
            where[Op.or].push(
                { texto_ocr: { [Op.iLike]: terminoBusqueda } },
                { nombre_archivo: { [Op.iLike]: terminoBusqueda } }
            );
        }

        if (filtros.estadoOcr) {
            where.estado_ocr = filtros.estadoOcr;
        }

        return where;
    }

    /**
     * Combinar y formatear resultados
     */
    combinarResultados(busquedas) {
        const [autorizaciones, documentos, archivos] = busquedas;
        const resultados = [];

        // Procesar autorizaciones
        autorizaciones.forEach(auth => {
            resultados.push({
                tipo: 'autorizacion',
                id: auth.id,
                numero_autorizacion: auth.numeroAutorizacion,
                nombre_carpeta: auth.nombreCarpeta,
                ubicacion: `Autorización: ${auth.nombreCarpeta}`,
                solicitante: auth.solicitante,
                municipio: auth.municipio?.nombre,
                modalidad: auth.modalidad?.nombre,
                tipo_autorizacion: auth.tipoAutorizacion?.nombre,
                fecha_creacion: auth.fechaCreacion,
                documentos_count: auth.documentos?.length || 0,
                data: auth
            });
        });

        // Procesar documentos
        documentos.forEach(doc => {
            resultados.push({
                tipo: 'documento',
                id: doc.id,
                titulo: doc.titulo,
                numero_documento: doc.numero_documento,
                ubicacion: doc.autorizacion
                    ? `Autorización: ${doc.autorizacion.nombreCarpeta} → Documento: ${doc.titulo}`
                    : `Documento: ${doc.titulo}`,
                autorizacion: doc.autorizacion?.numeroAutorizacion,
                nombreCarpeta: doc.autorizacion?.nombreCarpeta,
                municipio: doc.autorizacion?.municipio?.nombre,
                confidencialidad: doc.confidencialidad,
                estado_digitalizacion: doc.estado_digitalizacion,
                fecha_documento: doc.fecha_documento,
                archivos_count: doc.archivosDigitales?.length || 0,
                data: doc
            });
        });

        // Procesar archivos digitales (OCR)
        archivos.forEach(archivo => {
            resultados.push({
                tipo: 'archivo',
                id: archivo.id,
                nombre_archivo: archivo.nombre_archivo,
                documento_titulo: archivo.documento?.titulo,
                ubicacion: archivo.documento?.autorizacion
                    ? `Autorización: ${archivo.documento.autorizacion.nombreCarpeta} → Documento: ${archivo.documento.titulo} → Archivo: ${archivo.nombre_archivo}`
                    : `Documento: ${archivo.documento?.titulo} → Archivo: ${archivo.nombre_archivo}`,
                autorizacion: archivo.documento?.autorizacion?.numeroAutorizacion,
                nombreCarpeta: archivo.documento?.autorizacion?.nombreCarpeta,
                estado_ocr: archivo.estado_ocr,
                texto_ocr_preview: archivo.texto_ocr
                    ? archivo.texto_ocr.substring(0, 200) + '...'
                    : null,
                pagina_numero: archivo.pagina_numero,
                data: archivo
            });
        });

        return resultados;
    }

    /**
     * Agrupar y eliminar duplicados
     */
    agruparResultados(resultados) {
        const agrupados = {};

        resultados.forEach(resultado => {
            const key = `${resultado.tipo}_${resultado.id}`;
            if (!agrupados[key]) {
                agrupados[key] = resultado;
            }
        });

        return Object.values(agrupados);
    }

    /**
     * Búsqueda avanzada con filtros específicos
     */
    async busquedaAvanzada(filtros) {
        const {
            termino,
            tipoBusqueda, // 'autorizacion', 'documento', 'archivo', 'todo'
            fechaDesde,
            fechaHasta,
            municipioId,
            modalidadId,
            confidencialidad,
            estadoOcr,
            estadoDigitalizacion,
            limit = 100,
            offset = 0
        } = filtros;

        let resultados = [];

        switch (tipoBusqueda) {
            case 'autorizacion':
                resultados = await this.buscarEnAutorizaciones(termino, { municipioId, modalidadId });
                break;
            case 'documento':
                resultados = await this.buscarEnDocumentos(termino, { confidencialidad, estadoDigitalizacion });
                break;
            case 'archivo':
                resultados = await this.buscarEnArchivosDigitales(termino, { estadoOcr });
                break;
            default:
                resultados = await this.busquedaGeneral(termino, {
                    municipioId,
                    modalidadId,
                    confidencialidad,
                    estadoOcr,
                    estadoDigitalizacion
                });
                break;
        }

        // Filtrar por fechas si se especifican
        if (fechaDesde || fechaHasta) {
            resultados = this.filtrarPorFechas(resultados, fechaDesde, fechaHasta);
        }

        // Paginación
        const total = resultados.length;
        const paginados = resultados.slice(offset, offset + limit);

        return {
            total,
            resultados: paginados,
            paginaActual: Math.floor(offset / limit) + 1,
            totalPaginas: Math.ceil(total / limit)
        };
    }

    filtrarPorFechas(resultados, fechaDesde, fechaHasta) {
        return resultados.filter(item => {
            let fechaItem;

            switch (item.tipo) {
                case 'autorizacion':
                    fechaItem = new Date(item.fechaCreacion);
                    break;
                case 'documento':
                    fechaItem = new Date(item.fecha_documento || item.data.created_at);
                    break;
                case 'archivo':
                    fechaItem = new Date(item.data.fecha_digitalizacion || item.data.created_at);
                    break;
                default:
                    return true;
            }

            const desde = fechaDesde ? new Date(fechaDesde) : null;
            const hasta = fechaHasta ? new Date(fechaHasta) : null;

            if (desde && fechaItem < desde) return false;
            if (hasta && fechaItem > hasta) return false;

            return true;
        });
    }
}

module.exports = BusquedaService;