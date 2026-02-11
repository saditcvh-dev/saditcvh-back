// reports/services/actividad.service.js
const { Op, QueryTypes } = require("sequelize");
const sequelize = require("../../../config/db");

class ActividadService {

    /**
     * Ajusta la fecha restando 6 horas (para zona horaria)
     * @param {Date|string} fecha - Fecha a ajustar
     * @returns {Date} - Fecha ajustada
     */
    ajustarHoraLocal(fecha) {
        const fechaObj = new Date(fecha);
        return new Date(fechaObj.getTime() - (6 * 60 * 60000));
    }

    /**
     * Formatea una fecha ajustada a string local
     * @param {Date|string} fecha - Fecha a formatear
     * @param {boolean} incluirHora - Si incluye hora completa
     * @returns {string} - Fecha formateada
     */
    formatearFechaAjustada(fecha, incluirHora = false) {
        const fechaAjustada = this.ajustarHoraLocal(fecha);
        
        if (incluirHora) {
            return fechaAjustada.toLocaleString('es-MX', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } else {
            return fechaAjustada.toLocaleDateString('es-MX');
        }
    }
    
    /**
     * Obtiene el reporte completo de actividad de usuarios
     * @param {Object} filters - Filtros opcionales para el reporte
     * @returns {Promise<Object>} - Reporte de actividad
     */
    async getActividadReport(filters = {}) {
        try {
            const {
                user_id,
                role_id,
                start_date,
                end_date,
                limit_users = 50,
                include_inactive = false
            } = filters;

            // 1. Obtener usuarios con información básica
            const usuarios = await this.getUsuariosConInformacion({
                user_id,
                role_id,
                include_inactive,
                limit: limit_users
            });

            // 2. Para cada usuario, obtener sus actividades
            const usuariosConActividad = await Promise.all(
                usuarios.map(async (usuario) => {
                    const actividades = await this.getActividadesPorUsuario(
                        usuario.id,
                        start_date,
                        end_date
                    );
                    
                    return {
                        ...usuario,
                        actividades: actividades
                    };
                })
            );

            // 3. Obtener estadísticas del reporte
            const estadisticas = await this.getEstadisticasReporte({
                start_date,
                end_date,
                usuarios: usuariosConActividad
            });

            return {
                success: true,
                data: usuariosConActividad,
                metadata: {
                    total_usuarios: usuariosConActividad.length,
                    fecha_inicio: start_date,
                    fecha_fin: end_date,
                    generado_en: new Date().toISOString(),
                    estadisticas: estadisticas
                }
            };

        } catch (error) {
            throw new Error(`Error al generar reporte de actividad: ${error.message}`);
        }
    }

    /**
     * Obtiene usuarios con información básica
     */
    async getUsuariosConInformacion(filters = {}) {
        const { user_id, role_id, include_inactive = false, limit = 50 } = filters;

        let whereConditions = ["u.deleted_at IS NULL"];
        const params = [];

        if (user_id) {
            whereConditions.push("u.id = ?");
            params.push(user_id);
        }

        if (!include_inactive) {
            whereConditions.push("u.active = true");
        }

        if (role_id) {
            whereConditions.push("ur.role_id = ?");
            params.push(role_id);
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}` 
            : '';

        const query = `
            SELECT 
                u.id,
                u.username,
                u.first_name,
                u.last_name,
                u.second_last_name,
                u.email,
                u.active,
                u.created_at,
                c.nombre as cargo_nombre,
                COALESCE(r.name, 'Sin rol asignado') as role_name
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            LEFT JOIN cargos c ON u.cargo_id = c.id
            ${whereClause}
            ORDER BY u.created_at DESC
            LIMIT ${parseInt(limit)}
        `;

        const usuarios = await sequelize.query(query, {
            replacements: params,
            type: QueryTypes.SELECT
        });

        return usuarios.map(user => ({
            id: user.id,
            username: user.username,
            nombre_completo: `${user.first_name} ${user.last_name}${user.second_last_name ? ' ' + user.second_last_name : ''}`,
            email: user.email,
            estado: user.active ? 'Activo' : 'Inactivo',
            cargo: user.cargo_nombre || 'No asignado',
            rol: user.role_name,
            fecha_registro: user.created_at,
            fecha_registro_ajustada: this.ajustarHoraLocal(user.created_at),
            fecha_registro_formateada: this.formatearFechaAjustada(user.created_at, true)
        }));
    }

    /**
     * Obtiene todas las actividades de un usuario
     */
    async getActividadesPorUsuario(userId, startDate = null, endDate = null) {
        try {
            const [archivosSubidos, comentarios, archivosVistos] = await Promise.all([
                this.getArchivosSubidosPorUsuario(userId, startDate, endDate),
                this.getComentariosPorUsuario(userId, startDate, endDate),
                this.getArchivosVistosPorUsuario(userId, startDate, endDate)
            ]);

            return {
                archivos_subidos: archivosSubidos,
                comentarios: comentarios,
                archivos_vistos: archivosVistos,
                estadisticas: {
                    total_archivos_subidos: archivosSubidos.length,
                    total_comentarios: comentarios.length,
                    total_archivos_vistos: archivosVistos.length,
                    actividad_total: archivosSubidos.length + comentarios.length + archivosVistos.length
                }
            };
        } catch (error) {
            return {
                archivos_subidos: [],
                comentarios: [],
                archivos_vistos: [],
                estadisticas: {
                    total_archivos_subidos: 0,
                    total_comentarios: 0,
                    total_archivos_vistos: 0,
                    actividad_total: 0
                }
            };
        }
    }

    /**
     * Obtiene archivos subidos por el usuario
     */
    async getArchivosSubidosPorUsuario(userId, startDate = null, endDate = null) {
        try {
            let whereConditions = ["ad.digitalizado_por = ?"];
            const params = [userId];

            if (startDate) {
                whereConditions.push("ad.fecha_digitalizacion >= ?");
                params.push(startDate);
            }

            if (endDate) {
                whereConditions.push("ad.fecha_digitalizacion <= ?");
                params.push(endDate);
            }

            const whereClause = whereConditions.join(' AND ');

            const query = `
                SELECT 
                    ad.id as archivo_id,
                    ad.documento_id,
                    ad.nombre_archivo,
                    ad.fecha_digitalizacion,
                    ad.version_archivo,
                    d.titulo as documento_titulo,
                    d.paginas,
                    d.created_at as documento_creado
                FROM archivos_digitales ad
                LEFT JOIN documentos d ON ad.documento_id = d.id
                WHERE ${whereClause}
                ORDER BY ad.fecha_digitalizacion DESC
                LIMIT 20
            `;

            const archivos = await sequelize.query(query, {
                replacements: params,
                type: QueryTypes.SELECT
            });


            return archivos.map(archivo => {
            const fechaAjustada = this.ajustarHoraLocal(archivo.fecha_digitalizacion);
            
            return {
                tipo: 'archivo_subido',
                archivo_id: archivo.archivo_id,
                documento_id: archivo.documento_id,
                nombre_archivo: archivo.nombre_archivo,
                titulo_documento: archivo.documento_titulo || 'Sin título',
                version: archivo.version_archivo,
                paginas: archivo.paginas || 1,
                fecha: archivo.fecha_digitalizacion,
                fecha_original: archivo.fecha_digitalizacion,
                fecha_ajustada: fechaAjustada,
                fecha_formateada: this.formatearFechaAjustada(archivo.fecha_digitalizacion, false),
                fecha_formateada_completa: this.formatearFechaAjustada(archivo.fecha_digitalizacion, true)
            };
        });
        } catch (error) {
            return [];
        }
    }

    /**
     * Obtiene comentarios realizados por el usuario (CORREGIDO - maneja objetos y JSON)
     */
    async getComentariosPorUsuario(userId, startDate = null, endDate = null) {
        try {
            let whereConditions = ["a.usuario_id = ?"];
            const params = [userId];

            if (startDate) {
                whereConditions.push("a.created_at >= ?");
                params.push(startDate);
            }

            if (endDate) {
                whereConditions.push("a.created_at <= ?");
                params.push(endDate);
            }

            const whereClause = whereConditions.join(' AND ');

            const query = `
                SELECT 
                    a.id as anotacion_id,
                    a.archivo_nombre,
                    a.comentarios,
                    a.created_at,
                    a.metadata,
                    d.titulo as documento_titulo,
                    d.id as documento_id
                FROM anotaciones a
                LEFT JOIN archivos_digitales ad ON a.archivo_nombre = ad.nombre_archivo
                LEFT JOIN documentos d ON ad.documento_id = d.id
                WHERE ${whereClause}
                ORDER BY a.created_at DESC
                LIMIT 20
            `;

            const anotaciones = await sequelize.query(query, {
                replacements: params,
                type: QueryTypes.SELECT
            });

            // Procesar comentarios (cada anotación puede tener múltiples comentarios)
            const comentarios = [];
            
            anotaciones.forEach(anotacion => {
                try {
                    if (anotacion.comentarios) {
                        let comentariosData;
                        
                        // Verificar el tipo de dato
                        if (typeof anotacion.comentarios === 'string') {
                            // Es un string JSON, necesitamos parsearlo
                            comentariosData = JSON.parse(anotacion.comentarios);
                        } else if (Array.isArray(anotacion.comentarios)) {
                            // Ya es un array (PostgreSQL JSONB devuelve como array)
                            comentariosData = anotacion.comentarios;
                        } else if (typeof anotacion.commentarios === 'object' && anotacion.comentarios !== null) {
                            comentariosData = [anotacion.comentarios]; // Intentar tratarlo como array con un solo elemento
                        } else {
                            comentariosData = [];
                        }
                        
                        // Verificar que es un array
                        if (Array.isArray(comentariosData)) {
                            comentariosData.forEach(comentario => {
                                if (comentario && typeof comentario === 'object') {
                                    // Extraer el texto del comentario - verificar diferentes posibles nombres de campo
                                    const textoComentario = comentario.text || 
                                                        comentario.comentario || 
                                                        comentario.content || 
                                                        comentario.descripcion || 
                                                        'Comentario sin texto específico';
                                    
                                    // Extraer página
                                    const pagina = comentario.page || 
                                                comentario.pagina || 
                                                comentario.pag || 
                                                1;
                                    
                                    // Extraer autor
                                    const autor = comentario.autor || 
                                                comentario.author || 
                                                comentario.usuario || 
                                                comentario.user || 
                                                'Usuario';
                                    
                                    // Extraer fecha - intentar diferentes formatos
                                    let fechaComentario;
                                    if (comentario.date) {
                                        fechaComentario = new Date(comentario.date);
                                    } else if (comentario.fecha) {
                                        fechaComentario = new Date(comentario.fecha);
                                    } else if (comentario.created_at) {
                                        fechaComentario = new Date(comentario.created_at);
                                    } else {
                                        fechaComentario = new Date(anotacion.created_at);
                                    }
                                    
                                    // Verificar si la fecha es válida
                                    if (isNaN(fechaComentario.getTime())) {
                                        fechaComentario = new Date(anotacion.created_at);
                                    }
                                    
                                    comentarios.push({
                                        tipo: 'comentario',
                                        anotacion_id: anotacion.anotacion_id,
                                        documento_id: anotacion.documento_id,
                                        archivo_nombre: anotacion.archivo_nombre,
                                        titulo_documento: anotacion.documento_titulo || anotacion.archivo_nombre,
                                        comentario: textoComentario,
                                        pagina: pagina,
                                        fecha_comentario: fechaComentario,
                                        fecha_original: fechaComentario,
                                        fecha_ajustada: this.ajustarHoraLocal(fechaComentario),
                                        fecha_anotacion: anotacion.created_at,
                                        fecha_formateada: this.formatearFechaAjustada(fechaComentario, false),
                                        fecha_formateada_completa: this.formatearFechaAjustada(fechaComentario, true),
                                        autor: autor,
                                        datos_originales: comentario
                                    });
                                } else if (typeof comentario === 'string') {
                                    comentarios.push({
                                        tipo: 'comentario',
                                        anotacion_id: anotacion.anotacion_id,
                                        documento_id: anotacion.documento_id,
                                        archivo_nombre: anotacion.archivo_nombre,
                                        titulo_documento: anotacion.documento_titulo || anotacion.archivo_nombre,
                                        comentario: comentario,
                                        pagina: 1,
                                        fecha_comentario: new Date(anotacion.created_at),
                                        fecha_original: new Date(anotacion.created_at),
                                        fecha_ajustada: this.ajustarHoraLocal(anotacion.created_at),
                                        fecha_anotacion: anotacion.created_at,
                                        fecha_formateada: this.formatearFechaAjustada(anotacion.created_at, false),
                                        fecha_formateada_completa: this.formatearFechaAjustada(anotacion.created_at, true),
                                        autor: 'Usuario',
                                        datos_originales: { texto: comentario }
                                    });
                                }
                            });
                        } else {
                            throw new Error(`Formato de comentarios desconocido para anotación ${anotacion.anotacion_id}`);
                        }
                    }
                } catch (error) {
                    // Si hay error, crear un comentario de error con más información
                    comentarios.push({
                        tipo: 'comentario',
                        anotacion_id: anotacion.anotacion_id,
                        documento_id: anotacion.documento_id,
                        archivo_nombre: anotacion.archivo_nombre,
                        titulo_documento: anotacion.documento_titulo || anotacion.archivo_nombre,
                        comentario: 'Error al procesar comentario - formato desconocido',
                        pagina: 1,
                        fecha_comentario: new Date(anotacion.created_at),
                        fecha_original: new Date(anotacion.created_at),
                        fecha_ajustada: this.ajustarHoraLocal(anotacion.created_at),
                        fecha_anotacion: anotacion.created_at,
                        fecha_formateada: this.formatearFechaAjustada(anotacion.created_at, false),
                        fecha_formateada_completa: this.formatearFechaAjustada(anotacion.created_at, true),
                        autor: 'Sistema',
                        datos_originales: {
                            tipo_original: typeof anotacion.comentarios,
                            valor_original: anotacion.comentarios
                        }
                    });
                }
            });

            // Ordenar por fecha de comentario y limitar a 20
            return comentarios
                .sort((a, b) => b.fecha_comentario - a.fecha_comentario)
                .slice(0, 20);

        } catch (error) {
            return [];
        }
    }

    /**
     * Obtiene archivos vistos por el usuario (CORREGIDO para mostrar hora)
     */
    async getArchivosVistosPorUsuario(userId, startDate = null, endDate = null) {
        try {
            let whereConditions = ["av.usuario_id = ?"];
            const params = [userId];

            if (startDate) {
                whereConditions.push("av.fecha_apertura >= ?");
                params.push(startDate);
            }

            if (endDate) {
                whereConditions.push("av.fecha_apertura <= ?");
                params.push(endDate);
            }

            const whereClause = whereConditions.join(' AND ');

            const query = `
                SELECT 
                    av.id as visita_id,
                    av.archivo_id,
                    av.fecha_apertura,
                    av.created_at,
                    ad.nombre_archivo,
                    ad.documento_id,
                    d.titulo as documento_titulo
                FROM archivo_visitas av
                LEFT JOIN archivos_digitales ad ON av.archivo_id = ad.id
                LEFT JOIN documentos d ON ad.documento_id = d.id
                WHERE ${whereClause}
                ORDER BY av.fecha_apertura DESC
                LIMIT 20
            `;

            const visitas = await sequelize.query(query, {
                replacements: params,
                type: QueryTypes.SELECT
            });

            return visitas.map(visita => {
            const fechaAjustada = this.ajustarHoraLocal(visita.fecha_apertura);
            
            return {
                tipo: 'archivo_visto',
                visita_id: visita.visita_id,
                archivo_id: visita.archivo_id,
                documento_id: visita.documento_id,
                nombre_archivo: visita.nombre_archivo,
                titulo_documento: visita.documento_titulo || visita.nombre_archivo,
                fecha: visita.fecha_apertura,
                fecha_original: visita.fecha_apertura,
                fecha_ajustada: fechaAjustada,
                fecha_formateada: this.formatearFechaAjustada(visita.fecha_apertura, false),
                fecha_formateada_completa: this.formatearFechaAjustada(visita.fecha_apertura, true),
                hora: fechaAjustada.toLocaleTimeString('es-MX', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                })
            };
        });
        } catch (error) {
            return [];
        }
    }

    /**
     * Obtiene estadísticas generales del reporte
     */
    async getEstadisticasReporte(filters = {}) {
        const { start_date, end_date, usuarios = [] } = filters;

        let whereConditions = [];
        const params = [];

        if (start_date) {
            whereConditions.push("created_at >= ?");
            params.push(start_date);
        }

        if (end_date) {
            whereConditions.push("created_at <= ?");
            params.push(end_date);
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}` 
            : '';

        try {
            // Estadísticas de archivos subidos
            const archivosQuery = `
                SELECT COUNT(*) as total
                FROM archivos_digitales
                ${whereClause}
            `;
            const archivosResult = await sequelize.query(archivosQuery, {
                replacements: params,
                type: QueryTypes.SELECT
            });

            // Estadísticas de comentarios
            const comentariosQuery = `
                SELECT COUNT(*) as total
                FROM anotaciones
                ${whereClause}
            `;
            const comentariosResult = await sequelize.query(comentariosQuery, {
                replacements: params,
                type: QueryTypes.SELECT
            });

            // Estadísticas de visitas
            const visitasQuery = `
                SELECT COUNT(*) as total
                FROM archivo_visitas
                ${whereClause}
            `;
            const visitasResult = await sequelize.query(visitasQuery, {
                replacements: params,
                type: QueryTypes.SELECT
            });

            // Calcular actividad total de usuarios
            let actividadTotal = 0;
            let usuariosMasActivos = [];

            usuarios.forEach(usuario => {
                const actividadesUsuario = usuario.actividades?.estadisticas?.actividad_total || 0;
                actividadTotal += actividadesUsuario;
                
                if (actividadesUsuario > 0) {
                    usuariosMasActivos.push({
                        usuario_id: usuario.id,
                        username: usuario.username,
                        nombre_completo: usuario.nombre_completo,
                        actividad_total: actividadesUsuario
                    });
                }
            });

            // Ordenar usuarios por actividad
            usuariosMasActivos.sort((a, b) => b.actividad_total - a.actividad_total);

            return {
                total_archivos_subidos: parseInt(archivosResult[0]?.total) || 0,
                total_comentarios: parseInt(comentariosResult[0]?.total) || 0,
                total_visitas: parseInt(visitasResult[0]?.total) || 0,
                actividad_total_reportada: actividadTotal,
                usuarios_mas_activos: usuariosMasActivos.slice(0, 5), // Top 5
                usuarios_con_actividad: usuarios.filter(u => (u.actividades?.estadisticas?.actividad_total || 0) > 0).length,
                periodo: start_date && end_date ? `${start_date} al ${end_date}` : 'Todos los tiempos'
            };

        } catch (error) {
            return {
                total_archivos_subidos: 0,
                total_comentarios: 0,
                total_visitas: 0,
                actividad_total_reportada: 0,
                usuarios_mas_activos: [],
                usuarios_con_actividad: 0,
                periodo: 'No disponible'
            };
        }
    }

    /**
     * Formatea los datos para el reporte PDF
     */
    formatDataForPDF(usuarios) {
        return usuarios.map(usuario => ({
            ...usuario,
            actividades: {
                ...usuario.actividades,
                archivos_subidos: usuario.actividades.archivos_subidos.slice(0, 20),
                comentarios: usuario.actividades.comentarios.slice(0, 20),
                archivos_vistos: usuario.actividades.archivos_vistos.slice(0, 20)
            }
        }));
    }
}

module.exports = new ActividadService();