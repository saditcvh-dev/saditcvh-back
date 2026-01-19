// reports/services/digitalization.service.js
const { Op, QueryTypes } = require("sequelize");
const sequelize = require("../../../config/db");

class DigitalizationReportService {

    /**
     * Obtiene el reporte completo de documentos digitalizados
     */
    async getDigitalizationReport(filters = {}) {
        try {
            const {
                tipo_autorizacion_id,
                modalidad_id,
                municipio_id,
                estado_digitalizacion,
                start_date,
                end_date,
                search,
                digitalizado_por,
                include_files = true,
                limit = 100,
                offset = 0
            } = filters;

            let whereConditions = ["d.deleted_at IS NULL", "d.version_actual = true"];
            const params = [];

            // Filtro por tipo de autorización
            if (tipo_autorizacion_id) {
                whereConditions.push("ta.id = ?");
                params.push(tipo_autorizacion_id);
            }

            // Filtro por modalidad
            if (modalidad_id) {
                whereConditions.push("m.id = ?");
                params.push(modalidad_id);
            }

            // Filtro por municipio (extraer de número de documento)
            if (municipio_id) {
                whereConditions.push("SUBSTRING(SPLIT_PART(d.numero_documento, ' ', 2) FROM 1 FOR 2) = ?");
                params.push(municipio_id.toString().padStart(2, '0'));
            }

            // Filtro por estado de digitalización
            if (estado_digitalizacion) {
                whereConditions.push("d.estado_digitalizacion = ?");
                params.push(estado_digitalizacion);
            }

            // Filtro por rango de fechas
            if (start_date) {
                whereConditions.push("d.created_at >= ?");
                params.push(start_date);
            }

            if (end_date) {
                whereConditions.push("d.created_at <= ?");
                params.push(end_date);
            }

            // Filtro por digitalizador
            if (digitalizado_por) {
                whereConditions.push("ad.digitalizado_por = ?");
                params.push(digitalizado_por);
            }

            // Búsqueda general
            if (search) {
                whereConditions.push(`(
                    d.numero_documento ILIKE ? OR 
                    d.titulo ILIKE ? OR 
                    d.descripcion ILIKE ? OR
                    ad.nombre_archivo ILIKE ?
                )`);
                const term = `%${search}%`;
                params.push(term, term, term, term);
            }

            const whereClause = whereConditions.length
                ? `WHERE ${whereConditions.join(" AND ")}`
                : "";

            // ============================
            // CONSULTA PRINCIPAL DE DOCUMENTOS
            // ============================
            const documentsQuery = `
                SELECT 
                    d.id as documento_id,
                    d.autorizacion_id,
                    d.numero_documento,
                    d.titulo,
                    d.descripcion,
                    d.fecha_documento,
                    d.fecha_recepcion,
                    d.folio_inicio,
                    d.folio_fin,
                    d.paginas,
                    d.confidencialidad,
                    d.estado_digitalizacion,
                    d.created_at as fecha_creacion_documento,
                    d.updated_at as fecha_actualizacion_documento,
                    d.version as version_documento,
                    d.tipo_documento,
                    
                    -- Información del archivo digital
                    ad.id as archivo_id,
                    ad.nombre_archivo,
                    ad.ruta_almacenamiento,
                    ad.ruta_preservacion,
                    ad.ruta_acceso,
                    ad.ruta_texto,
                    ad.mime_type,
                    ad.tamano_bytes,
                    ad.dimensiones,
                    ad.resolucion_dpi,
                    ad.pagina_numero,
                    ad.total_paginas,
                    ad.checksum_md5,
                    ad.checksum_sha256,
                    ad.calidad_escaneo,
                    ad.estado_ocr,
                    ad.texto_ocr,
                    ad.metadatos_tecnicos,
                    ad.fecha_digitalizacion,
                    ad.digitalizado_por,
                    ad.revisado_por,
                    ad.fecha_revision,
                    ad.created_at as fecha_creacion_archivo,
                    ad.version_archivo,
                    
                    -- Información de usuarios
                    u_digitalizador.id as digitalizador_id,
                    u_digitalizador.username as digitalizador_username,
                    u_digitalizador.first_name as digitalizador_nombre,
                    u_digitalizador.last_name as digitalizador_apellido,
                    u_digitalizador.email as digitalizador_email,
                    
                    u_revisor.id as revisor_id,
                    u_revisor.username as revisor_username,
                    u_revisor.first_name as revisor_nombre,
                    u_revisor.last_name as revisor_apellido,
                    u_revisor.email as revisor_email,
                    
                    -- Información de autorización
                    ta.id as tipo_autorizacion_id,
                    ta.nombre as tipo_autorizacion_nombre,
                    ta.abreviatura as tipo_autorizacion_abreviatura,
                    
                    -- Información de modalidad
                    m.id as modalidad_id,
                    m.num as modalidad_numero,
                    m.nombre as modalidad_nombre
                    
                FROM documentos d
                LEFT JOIN archivos_digitales ad ON d.id = ad.documento_id
                LEFT JOIN users u_digitalizador ON ad.digitalizado_por = u_digitalizador.id
                LEFT JOIN users u_revisor ON ad.revisado_por = u_revisor.id
                LEFT JOIN autorizaciones a ON d.autorizacion_id = a.id
                LEFT JOIN tipos_autorizacion ta ON a.tipo_id = ta.id
                LEFT JOIN modalidad m ON a.modalidad_id = m.id
                ${whereClause}
                ORDER BY d.created_at DESC, d.numero_documento ASC
                LIMIT ${parseInt(limit)}
                OFFSET ${parseInt(offset)}
            `;

            const documents = await sequelize.query(documentsQuery, {
                replacements: params,
                type: QueryTypes.SELECT
            });

            // ============================
            // PROCESAMIENTO DE DOCUMENTOS
            // ============================
            const processedDocuments = this.processDocumentsData(documents, include_files);

            // ============================
            // OBTENER ESTADÍSTICAS
            // ============================
            const stats = await this.getReportStatistics(filters);

            return {
                success: true,
                data: processedDocuments,
                metadata: {
                    total_documents: stats.totalDocuments,
                    digitalized_documents: stats.digitalizedDocuments,
                    pending_documents: stats.pendingDocuments,
                    total_file_size_mb: stats.totalFileSizeMB,
                    average_file_size_mb: stats.averageFileSizeMB,
                    total_pages_digitalized: stats.totalPagesDigitalized,
                    documents_by_status: stats.documentsByStatus,
                    documents_by_authorization_type: stats.documentsByAuthorizationType,
                    documents_by_modalidad: stats.documentsByModalidad,
                    distribution_by_modalidad: stats.distributionByModalidad, // NUEVO: Distribución detallada por modalidad
                    top_digitalizers: stats.topDigitalizers,
                    pagination: {
                        limit: parseInt(limit),
                        offset: parseInt(offset),
                        hasMore: offset + documents.length < stats.totalDocuments
                    }
                }
            };

        } catch (error) {
            console.error('❌ Error en DigitalizationReportService.getDigitalizationReport:', error);
            throw error;
        }
    }

    // ============================
    // ESTADÍSTICAS DEL REPORTE (ACTUALIZADAS)
    // ============================
    async getReportStatistics(filters = {}) {
        try {
            let whereConditions = ["d.deleted_at IS NULL", "d.version_actual = true"];
            const params = [];

            // Aplicar mismos filtros que en la consulta principal
            if (filters.tipo_autorizacion_id) {
                whereConditions.push("ta.id = ?");
                params.push(filters.tipo_autorizacion_id);
            }

            if (filters.modalidad_id) {
                whereConditions.push("m.id = ?");
                params.push(filters.modalidad_id);
            }

            if (filters.municipio_id) {
                whereConditions.push("SUBSTRING(SPLIT_PART(d.numero_documento, ' ', 2) FROM 1 FOR 2) = ?");
                params.push(filters.municipio_id.toString().padStart(2, '0'));
            }

            if (filters.estado_digitalizacion) {
                whereConditions.push("d.estado_digitalizacion = ?");
                params.push(filters.estado_digitalizacion);
            }

            if (filters.start_date) {
                whereConditions.push("d.created_at >= ?");
                params.push(filters.start_date);
            }

            if (filters.end_date) {
                whereConditions.push("d.created_at <= ?");
                params.push(filters.end_date);
            }

            const whereClause = whereConditions.length
                ? `WHERE ${whereConditions.join(" AND ")}`
                : "";

            // CONSULTA PRINCIPAL DE ESTADÍSTICAS
            // Usamos subconsultas para evitar duplicación por múltiples archivos
            const statsQuery = `
                WITH documentos_base AS (
                    SELECT DISTINCT d.id
                    FROM documentos d
                    LEFT JOIN autorizaciones a ON d.autorizacion_id = a.id
                    LEFT JOIN tipos_autorizacion ta ON a.tipo_id = ta.id
                    LEFT JOIN modalidad m ON a.modalidad_id = m.id
                    ${whereClause}
                ),
                documentos_con_archivos AS (
                    SELECT DISTINCT d.id
                    FROM documentos d
                    INNER JOIN archivos_digitales ad ON d.id = ad.documento_id
                    LEFT JOIN autorizaciones a ON d.autorizacion_id = a.id
                    LEFT JOIN tipos_autorizacion ta ON a.tipo_id = ta.id
                    LEFT JOIN modalidad m ON a.modalidad_id = m.id
                    ${whereClause}
                )
                SELECT 
                    -- Total de documentos únicos
                    (SELECT COUNT(*) FROM documentos_base) as total_documents,
                    
                    -- Documentos con al menos un archivo digital
                    (SELECT COUNT(*) FROM documentos_con_archivos) as digitalized_count,
                    
                    -- Documentos sin archivos digitales
                    ((SELECT COUNT(*) FROM documentos_base) - 
                     (SELECT COUNT(*) FROM documentos_con_archivos)) as pending_count
                FROM documentos_base
                LIMIT 1
            `;

            const [stats] = await sequelize.query(statsQuery, {
                replacements: params,
                type: QueryTypes.SELECT
            });

            // CONSULTA DE TAMAÑOS Y PÁGINAS
            const sizesQuery = `
                SELECT 
                    COALESCE(SUM(ad.tamano_bytes), 0) as total_bytes,
                    COALESCE(AVG(ad.tamano_bytes), 0) as avg_bytes,
                    COALESCE(SUM(ad.total_paginas), 0) as total_paginas
                FROM documentos d
                LEFT JOIN archivos_digitales ad ON d.id = ad.documento_id
                LEFT JOIN autorizaciones a ON d.autorizacion_id = a.id
                LEFT JOIN tipos_autorizacion ta ON a.tipo_id = ta.id
                LEFT JOIN modalidad m ON a.modalidad_id = m.id
                ${whereClause}
                AND ad.id IS NOT NULL
            `;

            const [sizes] = await sequelize.query(sizesQuery, {
                replacements: params,
                type: QueryTypes.SELECT
            });

            // DISTRIBUCIÓN POR TIPO DE AUTORIZACIÓN
            const authTypeQuery = `
                SELECT 
                    ta.abreviatura as type_abbr,
                    ta.nombre as type_name,
                    COUNT(DISTINCT d.id) as document_count
                FROM documentos d
                LEFT JOIN autorizaciones a ON d.autorizacion_id = a.id
                LEFT JOIN tipos_autorizacion ta ON a.tipo_id = ta.id
                ${whereClause}
                GROUP BY ta.abreviatura, ta.nombre
                ORDER BY document_count DESC
            `;

            const authTypeResults = await sequelize.query(authTypeQuery, {
                replacements: params,
                type: QueryTypes.SELECT
            });

            // DISTRIBUCIÓN POR MODALIDAD (BÁSICA)
            const modalidadQuery = `
                SELECT 
                    m.nombre as modalidad_name,
                    m.num as modalidad_num,
                    COUNT(DISTINCT d.id) as document_count
                FROM documentos d
                LEFT JOIN autorizaciones a ON d.autorizacion_id = a.id
                LEFT JOIN modalidad m ON a.modalidad_id = m.id
                ${whereClause}
                AND m.nombre IS NOT NULL
                GROUP BY m.nombre, m.num
                ORDER BY document_count DESC
            `;

            const modalidadResults = await sequelize.query(modalidadQuery, {
                replacements: params,
                type: QueryTypes.SELECT
            });

            // DISTRIBUCIÓN DETALLADA POR MODALIDAD (NUEVO)
            const distributionByModalidadQuery = `
                WITH modalidad_stats AS (
                    SELECT 
                        m.id as modalidad_id,
                        m.num as modalidad_num,
                        m.nombre as modalidad_nombre,
                        COUNT(DISTINCT d.id) as total_documentos,
                        COUNT(DISTINCT CASE WHEN ad.id IS NOT NULL THEN d.id END) as documentos_digitalizados,
                        COUNT(DISTINCT CASE WHEN ad.id IS NULL THEN d.id END) as documentos_pendientes,
                        SUM(CASE WHEN ad.id IS NOT NULL THEN ad.tamano_bytes ELSE 0 END) as total_bytes,
                        SUM(CASE WHEN ad.id IS NOT NULL THEN ad.total_paginas ELSE 0 END) as total_paginas,
                        COUNT(DISTINCT CASE WHEN ad.id IS NOT NULL THEN ad.digitalizado_por END) as digitalizadores_unicos,
                        AVG(CASE WHEN ad.id IS NOT NULL THEN ad.tamano_bytes ELSE NULL END) as promedio_bytes,
                        COUNT(DISTINCT CASE WHEN ad.estado_ocr = 'procesado' THEN ad.id END) as archivos_ocr_procesado
                    FROM documentos d
                    LEFT JOIN autorizaciones a ON d.autorizacion_id = a.id
                    LEFT JOIN modalidad m ON a.modalidad_id = m.id
                    LEFT JOIN archivos_digitales ad ON d.id = ad.documento_id
                    ${whereClause}
                    GROUP BY m.id, m.num, m.nombre
                )
                SELECT * FROM modalidad_stats
                WHERE total_documentos > 0
                ORDER BY total_documentos DESC, modalidad_num ASC
            `;

            const distributionByModalidadResults = await sequelize.query(distributionByModalidadQuery, {
                replacements: params,
                type: QueryTypes.SELECT
            });

            // DISTRIBUCIÓN POR ESTADO DE DIGITALIZACIÓN
            const statusQuery = `
                SELECT 
                    d.estado_digitalizacion,
                    COUNT(DISTINCT d.id) as document_count
                FROM documentos d
                LEFT JOIN autorizaciones a ON d.autorizacion_id = a.id
                LEFT JOIN tipos_autorizacion ta ON a.tipo_id = ta.id
                LEFT JOIN modalidad m ON a.modalidad_id = m.id
                ${whereClause}
                GROUP BY d.estado_digitalizacion
                ORDER BY document_count DESC
            `;

            const statusResults = await sequelize.query(statusQuery, {
                replacements: params,
                type: QueryTypes.SELECT
            });

            // TOP DIGITALIZADORES
            const topDigitalizersQuery = `
                SELECT 
                    u.id as user_id,
                    u.username,
                    u.first_name,
                    u.last_name,
                    COUNT(DISTINCT ad.documento_id) as total_digitalized,
                    SUM(ad.tamano_bytes) as total_size_bytes
                FROM archivos_digitales ad
                INNER JOIN users u ON ad.digitalizado_por = u.id
                INNER JOIN documentos d ON ad.documento_id = d.id
                LEFT JOIN autorizaciones a ON d.autorizacion_id = a.id
                LEFT JOIN tipos_autorizacion ta ON a.tipo_id = ta.id
                LEFT JOIN modalidad m ON a.modalidad_id = m.id
                ${whereClause}
                GROUP BY u.id, u.username, u.first_name, u.last_name
                ORDER BY total_digitalized DESC
                LIMIT 10
            `;

            const topDigitalizers = await sequelize.query(topDigitalizersQuery, {
                replacements: params,
                type: QueryTypes.SELECT
            });

            // CALCULAR PORCENTAJE DE AVANCE
            const totalDocs = parseInt(stats.total_documents) || 0;
            const digitalizedDocs = parseInt(stats.digitalized_count) || 0;
            const progressPercentage = totalDocs > 0 ? (digitalizedDocs / totalDocs * 100).toFixed(2) : 0;

            // CALCULAR TOTALES POR MODALIDAD
            const totalDocumentosModalidad = distributionByModalidadResults.reduce((sum, item) => sum + (parseInt(item.total_documentos) || 0), 0);
            const totalDigitalizadosModalidad = distributionByModalidadResults.reduce((sum, item) => sum + (parseInt(item.documentos_digitalizados) || 0), 0);
            const totalPendientesModalidad = distributionByModalidadResults.reduce((sum, item) => sum + (parseInt(item.documentos_pendientes) || 0), 0);
            const totalBytesModalidad = distributionByModalidadResults.reduce((sum, item) => sum + (parseFloat(item.total_bytes) || 0), 0);

            return {
                totalDocuments: totalDocs,
                digitalizedDocuments: digitalizedDocs,
                pendingDocuments: parseInt(stats.pending_count) || 0,
                progressPercentage: parseFloat(progressPercentage),
                totalFileSizeMB: (parseFloat(sizes.total_bytes) || 0) / (1024 * 1024),
                averageFileSizeMB: (parseFloat(sizes.avg_bytes) || 0) / (1024 * 1024),
                totalPagesDigitalized: parseInt(sizes.total_paginas) || 0,
                
                documentsByStatus: statusResults.map(item => ({
                    status: item.estado_digitalizacion || 'sin_estado',
                    count: parseInt(item.document_count) || 0
                })),
                
                documentsByAuthorizationType: authTypeResults.map(item => ({
                    type: item.type_name || item.type_abbr,
                    abbreviation: item.type_abbr,
                    count: parseInt(item.document_count) || 0
                })),
                
                documentsByModalidad: modalidadResults.map(item => ({
                    modalidad: item.modalidad_name || `Modalidad ${item.modalidad_num}`,
                    numero: item.modalidad_num,
                    count: parseInt(item.document_count) || 0
                })),
                
                // NUEVO: Distribución detallada por modalidad
                distributionByModalidad: distributionByModalidadResults.map(item => ({
                    modalidad_id: item.modalidad_id,
                    modalidad_num: item.modalidad_num,
                    modalidad_nombre: item.modalidad_nombre || `Modalidad ${item.modalidad_num}`,
                    total_documentos: parseInt(item.total_documentos) || 0,
                    documentos_digitalizados: parseInt(item.documentos_digitalizados) || 0,
                    documentos_pendientes: parseInt(item.documentos_pendientes) || 0,
                    porcentaje_digitalizacion: item.total_documentos > 0 ? 
                        ((parseInt(item.documentos_digitalizados) / parseInt(item.total_documentos)) * 100).toFixed(2) : 0,
                    total_bytes: parseFloat(item.total_bytes) || 0,
                    total_tamano_mb: (parseFloat(item.total_bytes) || 0) / (1024 * 1024),
                    promedio_bytes: parseFloat(item.promedio_bytes) || 0,
                    promedio_tamano_mb: (parseFloat(item.promedio_bytes) || 0) / (1024 * 1024),
                    total_paginas: parseInt(item.total_paginas) || 0,
                    digitalizadores_unicos: parseInt(item.digitalizadores_unicos) || 0,
                    archivos_ocr_procesado: parseInt(item.archivos_ocr_procesado) || 0,
                    porcentaje_ocr: item.documentos_digitalizados > 0 ? 
                        ((parseInt(item.archivos_ocr_procesado) / parseInt(item.documentos_digitalizados)) * 100).toFixed(2) : 0
                })),
                
                // Totales por modalidad para resumen
                totalsByModalidad: {
                    total_documentos: totalDocumentosModalidad,
                    total_digitalizados: totalDigitalizadosModalidad,
                    total_pendientes: totalPendientesModalidad,
                    total_bytes: totalBytesModalidad,
                    total_tamano_mb: totalBytesModalidad / (1024 * 1024),
                    porcentaje_total_digitalizacion: totalDocumentosModalidad > 0 ? 
                        ((totalDigitalizadosModalidad / totalDocumentosModalidad) * 100).toFixed(2) : 0
                },
                
                topDigitalizers: topDigitalizers.map(d => ({
                    user_id: d.user_id,
                    username: d.username,
                    full_name: `${d.first_name || ''} ${d.last_name || ''}`.trim(),
                    total_digitalized: parseInt(d.total_digitalized) || 0,
                    total_size_mb: (parseFloat(d.total_size_bytes) || 0) / (1024 * 1024)
                }))
            };

        } catch (error) {
            console.error('❌ Error en getReportStatistics:', error);
            return {
                totalDocuments: 0,
                digitalizedDocuments: 0,
                pendingDocuments: 0,
                progressPercentage: 0,
                totalFileSizeMB: 0,
                averageFileSizeMB: 0,
                totalPagesDigitalized: 0,
                documentsByStatus: [],
                documentsByAuthorizationType: [],
                documentsByModalidad: [],
                distributionByModalidad: [],
                totalsByModalidad: {
                    total_documentos: 0,
                    total_digitalizados: 0,
                    total_pendientes: 0,
                    total_bytes: 0,
                    total_tamano_mb: 0,
                    porcentaje_total_digitalizacion: 0
                },
                topDigitalizers: []
            };
        }
    }

    // ============================
    // PROCESAMIENTO DE DATOS (SIN CAMBIOS SIGNIFICATIVOS)
    // ============================
    processDocumentsData(documents, includeFiles = true) {
        // Agrupar documentos por ID (para manejar múltiples versiones)
        const documentsMap = new Map();
        
        documents.forEach(doc => {
            if (!documentsMap.has(doc.documento_id)) {
                documentsMap.set(doc.documento_id, {
                    documento_id: doc.documento_id,
                    autorizacion_id: doc.autorizacion_id,
                    numero_documento: doc.numero_documento,
                    titulo: doc.titulo,
                    descripcion: doc.descripcion,
                    fecha_documento: doc.fecha_documento,
                    fecha_recepcion: doc.fecha_recepcion,
                    folio_inicio: doc.folio_inicio,
                    folio_fin: doc.folio_fin,
                    paginas: doc.paginas,
                    confidencialidad: doc.confidencialidad,
                    estado_digitalizacion: doc.estado_digitalizacion,
                    fecha_creacion_documento: doc.fecha_creacion_documento,
                    fecha_actualizacion_documento: doc.fecha_actualizacion_documento,
                    version_documento: doc.version_documento,
                    tipo_documento: doc.tipo_documento,
                    
                    tipo_autorizacion: doc.tipo_autorizacion_nombre,
                    tipo_autorizacion_abreviatura: doc.tipo_autorizacion_abreviatura,
                    modalidad: doc.modalidad_nombre,
                    modalidad_numero: doc.modalidad_numero,
                    
                    // Extraer municipio del número de documento
                    municipio_num: doc.numero_documento ? 
                        parseInt(doc.numero_documento.split(' ')[1]?.split('-')[0]) : null,
                    
                    archivos_digitales: [],
                    
                    // Información de digitalización consolidada
                    digitalizacion_info: {
                        total_archivos: 0,
                        fecha_ultima_digitalizacion: null,
                        ultimo_digitalizador: null,
                        total_tamano_bytes: 0,
                        total_paginas: 0,
                        estado_ocr: 'sin_archivos'
                    }
                });
            }
            
            const documentData = documentsMap.get(doc.documento_id);
            
            // Si hay archivo asociado, agregarlo
            if (doc.archivo_id && includeFiles) {
                const archivo = {
                    archivo_id: doc.archivo_id,
                    nombre_archivo: doc.nombre_archivo,
                    ruta_almacenamiento: doc.ruta_almacenamiento,
                    ruta_preservacion: doc.ruta_preservacion,
                    ruta_acceso: doc.ruta_acceso,
                    ruta_texto: doc.ruta_texto,
                    mime_type: doc.mime_type,
                    tamano_bytes: doc.tamano_bytes,
                    tamano_mb: doc.tamano_bytes ? (doc.tamano_bytes / (1024 * 1024)).toFixed(2) : null,
                    dimensiones: doc.dimensiones,
                    resolucion_dpi: doc.resolucion_dpi,
                    pagina_numero: doc.pagina_numero,
                    total_paginas: doc.total_paginas,
                    checksum_md5: doc.checksum_md5,
                    checksum_sha256: doc.checksum_sha256,
                    calidad_escaneo: doc.calidad_escaneo,
                    estado_ocr: doc.estado_ocr,
                    fecha_digitalizacion: doc.fecha_digitalizacion,
                    digitalizado_por: doc.digitalizado_por,
                    digitalizador_nombre: doc.digitalizador_nombre ? 
                        `${doc.digitalizador_nombre} ${doc.digitalizador_apellido}` : null,
                    revisado_por: doc.revisado_por,
                    revisor_nombre: doc.revisor_nombre ? 
                        `${doc.revisor_nombre} ${doc.revisor_apellido}` : null,
                    fecha_revision: doc.fecha_revision,
                    fecha_creacion_archivo: doc.fecha_creacion_archivo,
                    version_archivo: doc.version_archivo
                };
                
                documentData.archivos_digitales.push(archivo);
                
                // Actualizar información consolidada
                documentData.digitalizacion_info.total_archivos++;
                documentData.digitalizacion_info.total_tamano_bytes += (doc.tamano_bytes || 0);
                documentData.digitalizacion_info.total_paginas += (doc.total_paginas || 0);
                
                // Actualizar fecha más reciente
                if (!documentData.digitalizacion_info.fecha_ultima_digitalizacion || 
                    new Date(doc.fecha_digitalizacion) > new Date(documentData.digitalizacion_info.fecha_ultima_digitalizacion)) {
                    documentData.digitalizacion_info.fecha_ultima_digitalizacion = doc.fecha_digitalizacion;
                    documentData.digitalizacion_info.ultimo_digitalizador = archivo.digitalizador_nombre;
                }
                
                // Actualizar estado OCR (usar el más avanzado)
                const ocrPriority = {
                    'procesado': 3,
                    'en_proceso': 2,
                    'pendiente': 1,
                    'sin_archivos': 0
                };
                
                if (ocrPriority[doc.estado_ocr] > ocrPriority[documentData.digitalizacion_info.estado_ocr]) {
                    documentData.digitalizacion_info.estado_ocr = doc.estado_ocr;
                }
            }
        });
        
        // Convertir map a array y procesar datos finales
        const processedDocs = Array.from(documentsMap.values()).map(doc => {
            // Calcular tamaño total en MB
            doc.digitalizacion_info.total_tamano_mb = 
                (doc.digitalizacion_info.total_tamano_bytes / (1024 * 1024)).toFixed(2);
            
            // Ordenar archivos por versión (más reciente primero)
            doc.archivos_digitales.sort((a, b) => b.version_archivo - a.version_archivo);
            
            return doc;
        });
        
        return processedDocs;
    }

    /**
     * Obtiene reporte resumido por municipio
     */
    async getMunicipalitySummary(filters = {}) {
        try {
            const whereConditions = ["d.deleted_at IS NULL", "d.version_actual = true"];
            const params = [];

            if (filters.start_date) {
                whereConditions.push("d.created_at >= ?");
                params.push(filters.start_date);
            }

            if (filters.end_date) {
                whereConditions.push("d.created_at <= ?");
                params.push(filters.end_date);
            }

            const whereClause = whereConditions.length
                ? `WHERE ${whereConditions.join(" AND ")}`
                : "";

            const summaryQuery = `
                SELECT 
                    SUBSTRING(SPLIT_PART(d.numero_documento, ' ', 2) FROM 1 FOR 2) as municipio_code,
                    COUNT(DISTINCT d.id) as total_documentos,
                    COUNT(DISTINCT CASE WHEN ad.id IS NOT NULL THEN d.id END) as digitalizados,
                    COUNT(DISTINCT CASE WHEN ad.id IS NULL THEN d.id END) as pendientes,
                    SUM(COALESCE(ad.tamano_bytes, 0)) as total_bytes,
                    SUM(COALESCE(ad.total_paginas, 0)) as total_paginas,
                    COUNT(DISTINCT ad.digitalizado_por) as digitalizadores_unicos
                FROM documentos d
                LEFT JOIN archivos_digitales ad ON d.id = ad.documento_id
                ${whereClause}
                GROUP BY SUBSTRING(SPLIT_PART(d.numero_documento, ' ', 2) FROM 1 FOR 2)
                ORDER BY municipio_code
            `;

            const summary = await sequelize.query(summaryQuery, {
                replacements: params,
                type: QueryTypes.SELECT
            });

            return {
                success: true,
                data: summary.map(item => ({
                    municipio_code: item.municipio_code,
                    total_documentos: parseInt(item.total_documentos) || 0,
                    digitalizados: parseInt(item.digitalizados) || 0,
                    pendientes: parseInt(item.pendientes) || 0,
                    porcentaje_digitalizacion: item.total_documentos > 0 ? 
                        ((parseInt(item.digitalizados) / parseInt(item.total_documentos)) * 100).toFixed(2) : 0,
                    total_tamano_mb: (parseFloat(item.total_bytes) || 0) / (1024 * 1024),
                    total_paginas: parseInt(item.total_paginas) || 0,
                    digitalizadores_unicos: parseInt(item.digitalizadores_unicos) || 0
                }))
            };

        } catch (error) {
            console.error('❌ Error en getMunicipalitySummary:', error);
            throw error;
        }
    }

    /**
     * Obtiene estadísticas de rendimiento por digitalizador
     */
    async getDigitalizerPerformance(filters = {}) {
        try {
            const whereConditions = ["ad.digitalizado_por IS NOT NULL"];
            const params = [];

            if (filters.start_date) {
                whereConditions.push("ad.fecha_digitalizacion >= ?");
                params.push(filters.start_date);
            }

            if (filters.end_date) {
                whereConditions.push("ad.fecha_digitalizacion <= ?");
                params.push(filters.end_date);
            }

            const whereClause = whereConditions.length
                ? `WHERE ${whereConditions.join(" AND ")}`
                : "";

            const performanceQuery = `
                SELECT 
                    u.id,
                    u.username,
                    u.first_name,
                    u.last_name,
                    u.email,
                    COUNT(DISTINCT ad.documento_id) as total_documentos,
                    COUNT(DISTINCT ad.id) as total_archivos,
                    SUM(ad.tamano_bytes) as total_bytes,
                    SUM(ad.total_paginas) as total_paginas,
                    MIN(ad.fecha_digitalizacion) as primera_digitalizacion,
                    MAX(ad.fecha_digitalizacion) as ultima_digitalizacion,
                    AVG(ad.tamano_bytes) as promedio_bytes,
                    COUNT(DISTINCT CASE WHEN ad.estado_ocr = 'procesado' THEN ad.id END) as ocr_procesados,
                    COUNT(DISTINCT CASE WHEN ad.estado_ocr = 'pendiente' THEN ad.id END) as ocr_pendientes
                FROM archivos_digitales ad
                INNER JOIN users u ON ad.digitalizado_por = u.id
                ${whereClause}
                GROUP BY u.id, u.username, u.first_name, u.last_name, u.email
                ORDER BY total_documentos DESC
            `;

            const performance = await sequelize.query(performanceQuery, {
                replacements: params,
                type: QueryTypes.SELECT
            });

            return {
                success: true,
                data: performance.map(p => ({
                    digitalizador_id: p.id,
                    username: p.username,
                    nombre_completo: `${p.first_name} ${p.last_name}`,
                    email: p.email,
                    total_documentos: parseInt(p.total_documentos) || 0,
                    total_archivos: parseInt(p.total_archivos) || 0,
                    total_paginas: parseInt(p.total_paginas) || 0,
                    total_tamano_gb: ((parseFloat(p.total_bytes) || 0) / (1024 * 1024 * 1024)).toFixed(2),
                    promedio_tamano_mb: ((parseFloat(p.promedio_bytes) || 0) / (1024 * 1024)).toFixed(2),
                    primera_digitalizacion: p.primera_digitalizacion,
                    ultima_digitalizacion: p.ultima_digitalizacion,
                    ocr_procesados: parseInt(p.ocr_procesados) || 0,
                    ocr_pendientes: parseInt(p.ocr_pendientes) || 0,
                    porcentaje_ocr_procesado: p.total_archivos > 0 ? 
                        ((parseInt(p.ocr_procesados) / parseInt(p.total_archivos)) * 100).toFixed(2) : 0
                }))
            };

        } catch (error) {
            console.error('❌ Error en getDigitalizerPerformance:', error);
            throw error;
        }
    }

    /**
     * Obtiene los últimos 5 documentos subidos
     */
    async getUltimosDocumentos(limit = 5) {
        try {
            const query = `
                SELECT 
                    d.id as documento_id,
                    d.numero_documento,
                    d.titulo,
                    d.descripcion,
                    d.estado_digitalizacion,
                    d.created_at as fecha_creacion,
                    d.tipo_documento,
                    
                    -- Información del último archivo digital
                    ad.id as archivo_id,
                    ad.nombre_archivo,
                    ad.fecha_digitalizacion,
                    ad.estado_ocr,
                    
                    -- Información del usuario digitalizador
                    u.id as usuario_id,
                    u.username as usuario_username,
                    u.first_name as usuario_nombre,
                    u.last_name as usuario_apellido,
                    u.email as usuario_email
                    
                FROM documentos d
                LEFT JOIN archivos_digitales ad ON d.id = ad.documento_id 
                    AND ad.id = (
                        SELECT id FROM archivos_digitales 
                        WHERE documento_id = d.id 
                        ORDER BY version_archivo DESC 
                        LIMIT 1
                    )
                LEFT JOIN users u ON ad.digitalizado_por = u.id
                WHERE d.deleted_at IS NULL
                ORDER BY d.created_at DESC
                LIMIT ${parseInt(limit)}
            `;
            
            console.log('🔍 Ejecutando consulta de documentos recientes...');
            const documentos = await sequelize.query(query, {
                type: QueryTypes.SELECT
            });
            
            console.log(`📄 Documentos recientes encontrados: ${documentos.length}`);
            
            // Procesar datos
            const processedDocuments = documentos.map(doc => ({
                documento_id: doc.documento_id,
                numero_documento: doc.numero_documento,
                titulo: doc.titulo || `Documento ${doc.documento_id}`,
                descripcion: doc.descripcion,
                estado_digitalizacion: doc.estado_digitalizacion || 'pendiente',
                fecha_creacion: doc.fecha_creacion,
                tipo_documento: doc.tipo_documento,
                
                // Información del archivo
                archivo_info: doc.archivo_id ? {
                    archivo_id: doc.archivo_id,
                    nombre_archivo: doc.nombre_archivo,
                    fecha_digitalizacion: doc.fecha_digitalizacion,
                    estado_ocr: doc.estado_ocr || 'pendiente',
                    tiene_archivo: true
                } : {
                    tiene_archivo: false,
                    estado_ocr: 'sin_archivo'
                },
                
                // Información del usuario
                usuario_info: doc.usuario_id ? {
                    usuario_id: doc.usuario_id,
                    username: doc.usuario_username,
                    nombre_completo: `${doc.usuario_nombre || ''} ${doc.usuario_apellido || ''}`.trim(),
                    email: doc.usuario_email
                } : null,
                
                // Métodos helper
                getEstadoTexto: function() {
                    if (!this.archivo_info.tiene_archivo) return 'Pendiente';
                    const estado = this.archivo_info.estado_ocr;
                    const estadosMap = {
                        'pendiente': 'Pendiente OCR',
                        'en_proceso': 'Procesando OCR',
                        'procesado': 'OCR Completado',
                        'fallido': 'OCR Fallido',
                        'sin_archivo': 'Sin archivo'
                    };
                    return estadosMap[estado] || estado;
                },
                
                getEstadoColor: function() {
                    if (!this.archivo_info.tiene_archivo) return 'gray';
                    const estado = this.archivo_info.estado_ocr;
                    const coloresMap = {
                        'pendiente': 'yellow',
                        'en_proceso': 'blue',
                        'procesado': 'green',
                        'fallido': 'red',
                        'sin_archivo': 'gray'
                    };
                    return coloresMap[estado] || 'gray';
                },
                
                getTiempoTranscurrido: function() {
                    const fecha = new Date(this.fecha_creacion);
                    const ahora = new Date();
                    const diffMs = ahora - fecha;
                    const diffMin = Math.floor(diffMs / 60000);
                    const diffHoras = Math.floor(diffMs / 3600000);
                    const diffDias = Math.floor(diffMs / 86400000);
                    
                    if (diffMin < 1) return 'Hace unos segundos';
                    if (diffMin < 60) return `Hace ${diffMin} minuto${diffMin !== 1 ? 's' : ''}`;
                    if (diffHoras < 24) return `Hace ${diffHoras} hora${diffHoras !== 1 ? 's' : ''}`;
                    if (diffDias < 7) return `Hace ${diffDias} día${diffDias !== 1 ? 's' : ''}`;
                    
                    // Formato completo para más de una semana
                    return fecha.toLocaleDateString('es-MX', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                    });
                },
                
                getUsuarioDisplay: function() {
                    if (!this.usuario_info) return 'Sin asignar';
                    return this.usuario_info.nombre_completo || this.usuario_info.username;
                }
            }));
            
            return {
                success: true,
                data: processedDocuments,
                metadata: {
                    total: processedDocuments.length,
                    generated_at: new Date().toISOString()
                }
            };
            
        } catch (error) {
            console.error('❌ Error en getUltimosDocumentos:', error);
            return {
                success: false,
                message: 'Error al obtener documentos recientes',
                error: error.message,
                data: []
            };
        }
    }
    
    /**
     * Obtiene reporte detallado por modalidad (NUEVO MÉTODO)
     */
    async getModalidadDetailedReport(filters = {}) {
        try {
            const whereConditions = ["d.deleted_at IS NULL", "d.version_actual = true"];
            const params = [];

            if (filters.start_date) {
                whereConditions.push("d.created_at >= ?");
                params.push(filters.start_date);
            }

            if (filters.end_date) {
                whereConditions.push("d.created_at <= ?");
                params.push(filters.end_date);
            }

            if (filters.estado_digitalizacion) {
                whereConditions.push("d.estado_digitalizacion = ?");
                params.push(filters.estado_digitalizacion);
            }

            const whereClause = whereConditions.length
                ? `WHERE ${whereConditions.join(" AND ")}`
                : "";

            // Consulta detallada por modalidad
            const modalidadDetailedQuery = `
                WITH modalidad_data AS (
                    SELECT 
                        m.id as modalidad_id,
                        m.num as modalidad_num,
                        m.nombre as modalidad_nombre,
                        COUNT(DISTINCT d.id) as total_documentos,
                        COUNT(DISTINCT CASE WHEN ad.id IS NOT NULL THEN d.id END) as documentos_digitalizados,
                        COUNT(DISTINCT CASE WHEN ad.id IS NULL THEN d.id END) as documentos_pendientes,
                        COUNT(DISTINCT CASE WHEN d.estado_digitalizacion = 'completado' THEN d.id END) as documentos_completados,
                        COUNT(DISTINCT CASE WHEN d.estado_digitalizacion = 'en_proceso' THEN d.id END) as documentos_en_proceso,
                        COUNT(DISTINCT CASE WHEN d.estado_digitalizacion = 'pendiente' THEN d.id END) as documentos_pendientes_estado,
                        SUM(CASE WHEN ad.id IS NOT NULL THEN ad.tamano_bytes ELSE 0 END) as total_bytes,
                        SUM(CASE WHEN ad.id IS NOT NULL THEN ad.total_paginas ELSE 0 END) as total_paginas,
                        COUNT(DISTINCT CASE WHEN ad.id IS NOT NULL THEN ad.digitalizado_por END) as digitalizadores_unicos,
                        AVG(CASE WHEN ad.id IS NOT NULL THEN ad.tamano_bytes ELSE NULL END) as promedio_bytes,
                        COUNT(DISTINCT CASE WHEN ad.estado_ocr = 'procesado' THEN ad.id END) as archivos_ocr_procesado,
                        COUNT(DISTINCT CASE WHEN ad.estado_ocr = 'pendiente' THEN ad.id END) as archivos_ocr_pendiente,
                        COUNT(DISTINCT CASE WHEN ad.estado_ocr = 'en_proceso' THEN ad.id END) as archivos_ocr_en_proceso,
                        MIN(CASE WHEN ad.id IS NOT NULL THEN ad.fecha_digitalizacion ELSE NULL END) as primera_digitalizacion,
                        MAX(CASE WHEN ad.id IS NOT NULL THEN ad.fecha_digitalizacion ELSE NULL END) as ultima_digitalizacion
                    FROM documentos d
                    LEFT JOIN autorizaciones a ON d.autorizacion_id = a.id
                    LEFT JOIN modalidad m ON a.modalidad_id = m.id
                    LEFT JOIN archivos_digitales ad ON d.id = ad.documento_id
                    ${whereClause}
                    GROUP BY m.id, m.num, m.nombre
                )
                SELECT * FROM modalidad_data
                WHERE total_documentos > 0
                ORDER BY total_documentos DESC, modalidad_num ASC
            `;

            const modalidadResults = await sequelize.query(modalidadDetailedQuery, {
                replacements: params,
                type: QueryTypes.SELECT
            });

            // Totales generales
            const totals = {
                total_documentos: 0,
                documentos_digitalizados: 0,
                documentos_pendientes: 0,
                documentos_completados: 0,
                documentos_en_proceso: 0,
                total_bytes: 0,
                total_paginas: 0,
                digitalizadores_unicos: new Set()
            };

            // Procesar resultados
            const processedData = modalidadResults.map(item => {
                const totalDocs = parseInt(item.total_documentos) || 0;
                const digitalizados = parseInt(item.documentos_digitalizados) || 0;
                const pendientes = parseInt(item.documentos_pendientes) || 0;
                const totalBytes = parseFloat(item.total_bytes) || 0;
                const totalPaginas = parseInt(item.total_paginas) || 0;
                const ocrProcesado = parseInt(item.archivos_ocr_procesado) || 0;

                // Acumular totales
                totals.total_documentos += totalDocs;
                totals.documentos_digitalizados += digitalizados;
                totals.documentos_pendientes += pendientes;
                totals.documentos_completados += parseInt(item.documentos_completados) || 0;
                totals.documentos_en_proceso += parseInt(item.documentos_en_proceso) || 0;
                totals.total_bytes += totalBytes;
                totals.total_paginas += totalPaginas;

                return {
                    modalidad_id: item.modalidad_id,
                    modalidad_num: item.modalidad_num,
                    modalidad_nombre: item.modalidad_nombre,
                    total_documentos: totalDocs,
                    documentos_digitalizados: digitalizados,
                    documentos_pendientes: pendientes,
                    documentos_completados: parseInt(item.documentos_completados) || 0,
                    documentos_en_proceso: parseInt(item.documentos_en_proceso) || 0,
                    documentos_pendientes_estado: parseInt(item.documentos_pendientes_estado) || 0,
                    porcentaje_digitalizacion: totalDocs > 0 ? ((digitalizados / totalDocs) * 100).toFixed(2) : 0,
                    porcentaje_completado: totalDocs > 0 ? ((parseInt(item.documentos_completados) || 0) / totalDocs * 100).toFixed(2) : 0,
                    total_bytes: totalBytes,
                    total_tamano_mb: (totalBytes / (1024 * 1024)).toFixed(2),
                    promedio_bytes: parseFloat(item.promedio_bytes) || 0,
                    promedio_tamano_mb: ((parseFloat(item.promedio_bytes) || 0) / (1024 * 1024)).toFixed(2),
                    total_paginas: totalPaginas,
                    digitalizadores_unicos: parseInt(item.digitalizadores_unicos) || 0,
                    archivos_ocr_procesado: ocrProcesado,
                    archivos_ocr_pendiente: parseInt(item.archivos_ocr_pendiente) || 0,
                    archivos_ocr_en_proceso: parseInt(item.archivos_ocr_en_proceso) || 0,
                    porcentaje_ocr: digitalizados > 0 ? ((ocrProcesado / digitalizados) * 100).toFixed(2) : 0,
                    primera_digitalizacion: item.primera_digitalizacion,
                    ultima_digitalizacion: item.ultima_digitalizacion,
                    tiempo_transcurrido: item.primera_digitalizacion ? 
                        this.calcularTiempoTranscurrido(item.primera_digitalizacion, item.ultima_digitalizacion) : null
                };
            });

            // Calcular porcentajes generales
            const porcentajeDigitalizacionTotal = totals.total_documentos > 0 ? 
                ((totals.documentos_digitalizados / totals.total_documentos) * 100).toFixed(2) : 0;
            
            const porcentajeCompletadoTotal = totals.total_documentos > 0 ? 
                ((totals.documentos_completados / totals.total_documentos) * 100).toFixed(2) : 0;

            return {
                success: true,
                data: processedData,
                metadata: {
                    total_modalidades: processedData.length,
                    totals: {
                        total_documentos: totals.total_documentos,
                        documentos_digitalizados: totals.documentos_digitalizados,
                        documentos_pendientes: totals.documentos_pendientes,
                        documentos_completados: totals.documentos_completados,
                        documentos_en_proceso: totals.documentos_en_proceso,
                        porcentaje_digitalizacion_total: parseFloat(porcentajeDigitalizacionTotal),
                        porcentaje_completado_total: parseFloat(porcentajeCompletadoTotal),
                        total_bytes: totals.total_bytes,
                        total_tamano_mb: (totals.total_bytes / (1024 * 1024)).toFixed(2),
                        total_paginas: totals.total_paginas,
                        digitalizadores_unicos_total: totals.digitalizadores_unicos.size
                    },
                    generated_at: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error('❌ Error en getModalidadDetailedReport:', error);
            return {
                success: false,
                message: 'Error al obtener reporte detallado por modalidad',
                error: error.message,
                data: []
            };
        }
    }

    /**
     * Calcula el tiempo transcurrido entre dos fechas
     */
    calcularTiempoTranscurrido(fechaInicio, fechaFin) {
        if (!fechaInicio || !fechaFin) return null;
        
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);
        const diffMs = fin - inicio;
        const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDias < 1) return 'Menos de 1 día';
        if (diffDias === 1) return '1 día';
        if (diffDias < 30) return `${diffDias} días`;
        
        const diffMeses = Math.floor(diffDias / 30);
        if (diffMeses === 1) return '1 mes';
        if (diffMeses < 12) return `${diffMeses} meses`;
        
        const diffAnios = Math.floor(diffDias / 365);
        return diffAnios === 1 ? '1 año' : `${diffAnios} años`;
    }

}

module.exports = new DigitalizationReportService();