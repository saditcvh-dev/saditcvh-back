const PDFDocument = require('pdfkit');
const ActividadService = require('../services/actividad.service');
const path = require('path');
const fs = require('fs');

class ReporteActividadController {
  
  // GENERAR REPORTE DE ACTIVIDAD EN PDF
  async generarReporteActividadPDF(req, res) {
    // Variables para manejar el stream
    let doc = null;
    
    try {
      const filters = {
        user_id: req.query.user_id ? parseInt(req.query.user_id) : undefined,
        role_id: req.query.role_id ? parseInt(req.query.role_id) : undefined,
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        limit_users: req.query.limit_users || 50,
        include_inactive: req.query.include_inactive === 'true'
      };
      
      // Obtener datos del servicio PRIMERO
      const report = await ActividadService.getActividadReport(filters);
      
      if (!report.success || !report.data || report.data.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No se encontró actividad para generar el reporte',
          data: []
        });
      }
      
      // Formatear datos para PDF
      const usuarios = ActividadService.formatDataForPDF(report.data);
      const estadisticas = report.metadata.estadisticas;
      
      // Crear documento PDF
      doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: 'Reporte de Actividad de Usuarios - STCH',
          Author: 'Sistema de Gestión Documental STCH',
          Subject: 'Reporte detallado de actividad de usuarios: archivos subidos, comentarios y visitas',
          Keywords: 'STCH, actividad, usuarios, reporte, comentarios, archivos, visitas, detallado'
        }
      });
      
      // Configurar headers para descarga
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="reporte_actividad_usuarios_stch_${Date.now()}.pdf"`);
      
      // Manejar errores en el stream
      doc.on('error', (error) => {
        if (!res.headersSent) {
          try {
            res.status(500).json({
              success: false,
              message: 'Error al generar el documento PDF',
              error: error.message
            });
          } catch (e) {
            console.error('Error enviando respuesta de error:', e);
          }
        }
      });
      
      res.on('error', (error) => {
        console.error('Error en respuesta HTTP:', error);
      });
      
      // Pipe el documento a la respuesta
      doc.pipe(res);
      
      // Colores institucionales
      const colors = {
        primary: '#8B1E3F',
        secondary: '#D4AF37',
        lightBg: '#F8F0F3',
        darkText: '#2D3748',
        lightText: '#4A5568',
        success: '#38A169',
        danger: '#E53E3E',
        info: '#3182CE',
        warning: '#DD6B20',
        purple: '#9F7AEA',
        gray: '#718096',
        lightGray: '#E2E8F0',
        white: '#FFFFFF'
      };
      
      // ==============================================
      // ENCABEZADO OFICIAL
      // ==============================================
      
      doc.rect(0, 0, doc.page.width, 130)
         .fill(colors.primary);
         
      // Logo
      const escudoPath = path.join(__dirname, '../../../../src/public/images/escudo_hidalgo.png');
      if (fs.existsSync(escudoPath)) {
        try {
          doc.image(escudoPath, 40, 25, { width: 70, height: 70 });
        } catch (err) {
        }
      }
      
      // Usar fuentes estándar que PDFKit reconoce
      doc.fontSize(18)
         .fillColor(colors.white)
         .font('Helvetica-Bold')
         .text('SISTEMA DE TRANSPORTE', 0, 35, { align: 'center', width: doc.page.width });
      
      doc.fontSize(18)
         .fillColor(colors.white)
         .font('Helvetica-Bold')
         .text('CONVENCIONAL DE HIDALGO', 0, 55, { align: 'center', width: doc.page.width });
      
      doc.fontSize(14)
         .fillColor(colors.secondary)
         .font('Helvetica-Bold')
         .text('MOVILIDAD', 0, 80, { align: 'center', width: doc.page.width });
      
      doc.fontSize(11)
         .fillColor(colors.white)
         .font('Helvetica')
         .text('Estado Libre y Soberano de Hidalgo', 0, 100, { align: 'center', width: doc.page.width });
      
      doc.fontSize(9)
         .fillColor(colors.secondary)
         .font('Helvetica-Bold')
         .text('PRIMERO EL PUEBLO', 0, 115, { align: 'center', width: doc.page.width });
      
      doc.moveTo(40, 125)
         .lineTo(doc.page.width - 40, 125)
         .lineWidth(2)
         .stroke(colors.secondary);
      
      doc.y = 150;
      
      // ==============================================
      // TÍTULO DEL REPORTE
      // ==============================================
      
      doc.fontSize(20)
         .fillColor(colors.primary)
         .font('Helvetica-Bold')
         .text('REPORTE DE ACTIVIDAD DE USUARIOS', { align: 'center' });
      
      doc.fontSize(12)
         .fillColor(colors.lightText)
         .font('Helvetica')
         .text('Sistema de Gestión Documental STCH', { align: 'center' });
      
      doc.moveDown(1);
      
      const docNumber = `STCH-ACT-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Date.now()).slice(-4)}`;
      
      doc.fontSize(10)
         .fillColor(colors.gray)
         .font('Helvetica')
         .text(`Número de referencia: ${docNumber}`, { align: 'center' });
      
      doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`, { align: 'center' });
      
      const periodoText = filters.start_date || filters.end_date 
        ? `Período analizado: ${filters.start_date ? new Date(filters.start_date).toLocaleDateString('es-ES') : 'Inicio'} - ${filters.end_date ? new Date(filters.end_date).toLocaleDateString('es-ES') : 'Actual'}`
        : 'Período: Histórico completo';
      
      doc.text(periodoText, { align: 'center' });
      
      doc.moveDown(2);
      doc.moveTo(40, doc.y)
         .lineTo(doc.page.width - 40, doc.y)
         .lineWidth(0.8)
         .stroke(colors.lightGray);
      doc.moveDown(1.5);
      
      // ==============================================
      // RESUMEN ESTADÍSTICO
      // ==============================================
      
      doc.fontSize(16)
         .fillColor(colors.primary)
         .font('Helvetica-Bold')
         .text('I. RESUMEN ESTADÍSTICO', 40, doc.y);
      
      doc.moveTo(40, doc.y + 3)
         .lineTo(350, doc.y + 3)
         .lineWidth(2)
         .stroke(colors.secondary);
      
      doc.moveDown(1.5);
      
      // Tarjetas de estadísticas
      const statsY = doc.y;
      const cardWidth = 100;
      const cardHeight = 50;
      const gap = 15;
      
      // Tarjeta 1: Total usuarios
      doc.rect(40, statsY, cardWidth, cardHeight)
         .fill(colors.lightBg)
         .stroke(colors.primary);
      
      doc.fontSize(22)
         .fillColor(colors.primary)
         .font('Helvetica-Bold')
         .text(usuarios.length.toString(), 55, statsY + 8);
      
      doc.fontSize(9)
         .fillColor(colors.darkText)
         .font('Helvetica-Bold')
         .text('USUARIOS ANALIZADOS', 55, statsY + 33, { width: cardWidth - 30 });
      
      // Tarjeta 2: Actividad total
      const actividadTotal = estadisticas.actividad_total_reportada;
      doc.rect(40 + cardWidth + gap, statsY, cardWidth, cardHeight)
         .fill('#F0FFF4')
         .stroke(colors.success);
      
      doc.fontSize(22)
         .fillColor(colors.success)
         .font('Helvetica-Bold')
         .text(actividadTotal.toString(), 55 + cardWidth + gap, statsY + 8);
      
      doc.fontSize(9)
         .fillColor(colors.darkText)
         .font('Helvetica-Bold')
         .text('ACTIVIDADES TOTALES', 55 + cardWidth + gap, statsY + 33, { width: cardWidth - 30 });
      
      // Tarjeta 3: Usuarios con actividad
      const usuariosConActividad = estadisticas.usuarios_con_actividad;
      doc.rect(40 + (cardWidth * 2) + (gap * 2), statsY, cardWidth, cardHeight)
         .fill('#F0F9FF')
         .stroke(colors.info);
      
      doc.fontSize(22)
         .fillColor(colors.info)
         .font('Helvetica-Bold')
         .text(usuariosConActividad.toString(), 55 + (cardWidth * 2) + (gap * 2), statsY + 8);
      
      doc.fontSize(9)
         .fillColor(colors.darkText)
         .font('Helvetica-Bold')
         .text('USUARIOS ACTIVOS', 55 + (cardWidth * 2) + (gap * 2), statsY + 33, { width: cardWidth - 30 });
      
      // Tarjeta 4: Período
      doc.rect(40 + (cardWidth * 3) + (gap * 3), statsY, cardWidth + 20, cardHeight)
         .fill('#F5F3FF')
         .stroke(colors.purple);
      
      doc.fontSize(9)
         .fillColor(colors.purple)
         .font('Helvetica-Bold')
         .text(estadisticas.periodo.length > 20 ? estadisticas.periodo.substring(0, 20) + '...' : estadisticas.periodo, 
               60 + (cardWidth * 3) + (gap * 3), statsY + 18, { width: cardWidth + 10, align: 'center' });
      
      doc.fontSize(9)
         .fillColor(colors.darkText)
         .font('Helvetica-Bold')
         .text('PERÍODO ANALIZADO', 60 + (cardWidth * 3) + (gap * 3), statsY + 33, { width: cardWidth + 10, align: 'center' });
      
      doc.y = statsY + cardHeight + 25;
      
      // Desglose de actividades
      doc.fontSize(12)
         .fillColor(colors.primary)
         .font('Helvetica-Bold')
         .text('Desglose de Actividades:', 40, doc.y);
      
      doc.moveDown(0.8);
      
      const actividadesY = doc.y;
      const actividadBarWidth = 200;
      const maxActividad = Math.max(
        estadisticas.total_archivos_subidos,
        estadisticas.total_comentarios,
        estadisticas.total_visitas
      );
      
      // Archivos subidos
      doc.fontSize(9)
         .fillColor(colors.darkText)
         .font('Helvetica-Bold')
         .text('Archivos Subidos:', 40, actividadesY, { width: 80 });
      
      const archivosBar = maxActividad > 0 ? (estadisticas.total_archivos_subidos / maxActividad) * actividadBarWidth : 0;
      doc.rect(130, actividadesY + 3, archivosBar, 10)
         .fill(colors.primary);
      
      doc.fontSize(9)
         .fillColor(colors.lightText)
         .font('Helvetica')
         .text(estadisticas.total_archivos_subidos.toString(), 340, actividadesY, { width: 50, align: 'right' });
      
      // Comentarios
      doc.fontSize(9)
         .fillColor(colors.darkText)
         .font('Helvetica-Bold')
         .text('Comentarios:', 40, actividadesY + 18, { width: 80 });
      
      const comentariosBar = maxActividad > 0 ? (estadisticas.total_comentarios / maxActividad) * actividadBarWidth : 0;
      doc.rect(130, actividadesY + 21, comentariosBar, 10)
         .fill(colors.success);
      
      doc.fontSize(9)
         .fillColor(colors.lightText)
         .font('Helvetica')
         .text(estadisticas.total_comentarios.toString(), 340, actividadesY + 18, { width: 50, align: 'right' });
      
      // Visitas
      doc.fontSize(9)
         .fillColor(colors.darkText)
         .font('Helvetica-Bold')
         .text('Archivos Vistos:', 40, actividadesY + 36, { width: 80 });
      
      const visitasBar = maxActividad > 0 ? (estadisticas.total_visitas / maxActividad) * actividadBarWidth : 0;
      doc.rect(130, actividadesY + 39, visitasBar, 10)
         .fill(colors.info);
      
      doc.fontSize(9)
         .fillColor(colors.lightText)
         .font('Helvetica')
         .text(estadisticas.total_visitas.toString(), 340, actividadesY + 36, { width: 50, align: 'right' });
      
      doc.y = actividadesY + 55;
      
      // Top usuarios más activos
      if (estadisticas.usuarios_mas_activos && estadisticas.usuarios_mas_activos.length > 0) {
        doc.fontSize(12)
           .fillColor(colors.primary)
           .font('Helvetica-Bold')
           .text('Top 5 Usuarios Más Activos:', 40, doc.y);
        
        doc.moveDown(0.8);
        
        const topY = doc.y;
        estadisticas.usuarios_mas_activos.forEach((usuario, index) => {
          const yPos = topY + (index * 16);
          
          doc.fontSize(9)
             .fillColor(colors.darkText)
             .font('Helvetica')
             .text(`${index + 1}. ${usuario.nombre_completo} (${usuario.username})`, 50, yPos, { width: 250 });
          
          doc.fontSize(9)
             .fillColor(colors.success)
             .font('Helvetica-Bold')
             .text(usuario.actividad_total.toString(), 310, yPos, { width: 50, align: 'right' });
        });
        
        doc.y = topY + (estadisticas.usuarios_mas_activos.length * 16) + 15;
      }
      
      doc.moveDown(1.5);
      doc.moveTo(40, doc.y)
         .lineTo(doc.page.width - 40, doc.y)
         .lineWidth(0.8)
         .stroke(colors.lightGray);
      doc.moveDown(1.5);
      
      // ==============================================
      // DETALLE POR USUARIO
      // ==============================================
      
      doc.fontSize(16)
         .fillColor(colors.primary)
         .font('Helvetica-Bold')
         .text('II. DETALLE DE ACTIVIDAD POR USUARIO', 40, doc.y);
      
      doc.moveTo(40, doc.y + 3)
         .lineTo(380, doc.y + 3)
         .lineWidth(2)
         .stroke(colors.secondary);
      
      doc.y += 15;
      
      // Generar sección para cada usuario
      usuarios.forEach((usuario, usuarioIndex) => {
        // Verificar espacio para nuevo usuario
        if (doc.y > 700) {
          doc.addPage();
          doc.y = 40;
        }
        
        // Encabezado del usuario
        doc.fontSize(14)
           .fillColor(colors.primary)
           .font('Helvetica-Bold')
           .text(`${usuarioIndex + 1}. ${usuario.nombre_completo} (${usuario.username})`, 40, doc.y);
        
        doc.moveTo(40, doc.y + 3)
           .lineTo(250, doc.y + 3)
           .lineWidth(1)
           .stroke(colors.secondary);
        
        doc.y += 8;
        
        // Información básica del usuario
        const infoCardY = doc.y;
        doc.fontSize(9)
        .fillColor(colors.darkText)
        .font('Helvetica');

        doc.text(`Email: ${usuario.email}`, 40, infoCardY);
        doc.text(`Rol: ${usuario.rol}`, 40, infoCardY + 12);
        doc.text(`Cargo: ${usuario.cargo}`, 40, infoCardY + 24);
        doc.text(`Estado: ${usuario.estado}`, 40, infoCardY + 36);

        doc.text(`Fecha registro: ${usuario.fecha_registro_formateada || new Date(usuario.fecha_registro).toLocaleDateString('es-ES')}`, 250, infoCardY);
        doc.text(`Total actividades: ${usuario.actividades.estadisticas.actividad_total}`, 250, infoCardY + 12);
        doc.text(`Archivos subidos: ${usuario.actividades.estadisticas.total_archivos_subidos}`, 250, infoCardY + 24);
        doc.text(`Comentarios: ${usuario.actividades.estadisticas.total_comentarios}`, 250, infoCardY + 36);
        doc.text(`Archivos vistos: ${usuario.actividades.estadisticas.total_archivos_vistos}`, 250, infoCardY + 48);

        // Agregar nota de límite
        doc.fontSize(7)
        .fillColor(colors.gray)
        .font('Helvetica')
        .text('Nota: Se muestran hasta 20 registros por categoría', 40, infoCardY + 60);

        doc.y = infoCardY + 70;


        // Subsección: Archivos subidos - MOSTRAR TODOS (hasta 20)
        if (usuario.actividades.archivos_subidos.length > 0) {
            if (doc.y > 650) {
                doc.addPage();
                doc.y = 40;
            }
            
            doc.fontSize(11)
            .fillColor(colors.primary)
            .font('Helvetica-Bold')
            .text(`Archivos Subidos (últimos ${Math.min(usuario.actividades.archivos_subidos.length, 20)}):`, 40, doc.y);
            
            doc.moveTo(40, doc.y + 2)
            .lineTo(220, doc.y + 2)
            .lineWidth(1)
            .stroke(colors.primary);
            
            doc.y += 12;
            
            // Mostrar TODOS los archivos subidos (hasta 20)
            usuario.actividades.archivos_subidos.forEach((archivo, index) => {
                if (doc.y > 750) {
                    doc.addPage();
                    doc.y = 40;
                }
                
                const rowY = doc.y;
                
                // Fondo alternado
                if (index % 2 === 0) {
                    doc.rect(40, rowY, doc.page.width - 80, 30)
                    .fill(colors.lightBg);
                }
                
                // Número
                doc.fontSize(9)
                .fillColor(colors.darkText)
                .font('Helvetica-Bold')
                .text(`${index + 1}.`, 45, rowY + 10);
                
                // Título del documento
                const tituloCorto = archivo.titulo_documento.length > 50 
                    ? archivo.titulo_documento.substring(0, 50) + '...' 
                    : archivo.titulo_documento;
                
                doc.fontSize(9)
                .fillColor(colors.darkText)
                .font('Helvetica')
                .text(tituloCorto, 65, rowY + 10, { width: 250 });
                
                // Nombre del archivo
                const archivoCorto = archivo.nombre_archivo.length > 25 
                    ? archivo.nombre_archivo.substring(0, 25) + '...' 
                    : archivo.nombre_archivo;
                
                doc.fontSize(8)
                .fillColor(colors.info)
                .font('Helvetica')
                .text(archivoCorto, 320, rowY + 10, { width: 150 });
                
                // Información adicional en segunda línea
                const infoText = `Versión: ${archivo.version} | Páginas: ${archivo.paginas} | Fecha: ${archivo.fecha_formateada_completa}`;
                doc.fontSize(8)
                .fillColor(colors.gray)
                .font('Helvetica')
                .text(infoText, 65, rowY + 22, { width: 450 });
                
                doc.y = rowY + 32;
            });
            
            doc.y += 10;
        }

        // Subsección: Comentarios - MOSTRAR TODOS (hasta 20) y con texto correcto
        if (usuario.actividades.comentarios.length > 0) {
            if (doc.y > 650) {
                doc.addPage();
                doc.y = 40;
            }
            
            doc.fontSize(11)
            .fillColor(colors.success)
            .font('Helvetica-Bold')
            .text(`Comentarios (últimos ${Math.min(usuario.actividades.comentarios.length, 20)}):`, 40, doc.y);
            
            doc.moveTo(40, doc.y + 2)
            .lineTo(200, doc.y + 2)
            .lineWidth(1)
            .stroke(colors.success);
            
            doc.y += 12;
            
            // Mostrar TODOS los comentarios (hasta 20)
            usuario.actividades.comentarios.forEach((comentario, index) => {
                if (doc.y > 750) {
                    doc.addPage();
                    doc.y = 40;
                }
                
                const comentarioY = doc.y;
                
                // Fondo alternado
                if (index % 2 === 0) {
                    doc.rect(40, comentarioY, doc.page.width - 80, 45)
                    .fill('#F0FFF4');
                }
                
                // Número
                doc.fontSize(9)
                .fillColor(colors.darkText)
                .font('Helvetica-Bold')
                .text(`${index + 1}.`, 45, comentarioY + 10);
                
                // Comentario (texto real)
                const comentarioTexto = comentario.comentario && comentario.comentario !== 'Error al cargar comentario'
                    ? comentario.comentario
                    : 'Comentario sin texto';
                
                const comentarioCorto = comentarioTexto.length > 80 
                    ? comentarioTexto.substring(0, 80) + '...' 
                    : comentarioTexto;
                
                doc.fontSize(9)
                .fillColor(colors.darkText)
                .font('Helvetica')
                .text(`"${comentarioCorto}"`, 65, comentarioY + 10, { width: 450 });
                
                // Información del documento y fecha
                const docInfo = `${comentario.titulo_documento || comentario.archivo_nombre} | Pág. ${comentario.pagina}`;
                const fechaInfo = comentario.fecha_formateada_completa;
                
                doc.fontSize(8)
                .fillColor(colors.gray)
                .font('Helvetica')
                .text(`En: ${docInfo}`, 65, comentarioY + 23, { width: 300 });
                
                doc.fontSize(8)
                .fillColor(colors.gray)
                .font('Helvetica')
                .text(fechaInfo, 370, comentarioY + 23, { width: 150 });
                
                doc.y = comentarioY + 48;
            });
            
            doc.y += 10;
        }

        // Subsección: Archivos vistos - MOSTRAR TODOS (hasta 20) con fecha y hora
        if (usuario.actividades.archivos_vistos.length > 0) {
            if (doc.y > 650) {
                doc.addPage();
                doc.y = 40;
            }
            
            doc.fontSize(11)
            .fillColor(colors.info)
            .font('Helvetica-Bold')
            .text(`Archivos Vistos (últimos ${Math.min(usuario.actividades.archivos_vistos.length, 20)}):`, 40, doc.y);
            
            doc.moveTo(40, doc.y + 2)
            .lineTo(240, doc.y + 2)
            .lineWidth(1)
            .stroke(colors.info);
            
            doc.y += 12;
            
            // Mostrar TODOS los archivos vistos (hasta 20)
            usuario.actividades.archivos_vistos.forEach((visita, index) => {
                if (doc.y > 750) {
                    doc.addPage();
                    doc.y = 40;
                }
                
                const visitaY = doc.y;
                
                // Fondo alternado
                if (index % 2 === 0) {
                    doc.rect(40, visitaY, doc.page.width - 80, 25)
                    .fill('#F0F9FF');
                }
                
                // Número
                doc.fontSize(9)
                .fillColor(colors.darkText)
                .font('Helvetica-Bold')
                .text(`${index + 1}.`, 45, visitaY + 8);
                
                // Título del documento
                const tituloCorto = visita.titulo_documento.length > 60 
                    ? visita.titulo_documento.substring(0, 60) + '...' 
                    : visita.titulo_documento;
                
                doc.fontSize(9)
                .fillColor(colors.darkText)
                .font('Helvetica')
                .text(tituloCorto, 65, visitaY + 8, { width: 350 });
                
                // Fecha y hora COMPLETA
                const fechaHora = visita.fecha_formateada_completa;
                
                doc.fontSize(8)
                .fillColor(colors.gray)
                .font('Helvetica')
                .text(fechaHora, 420, visitaY + 8, { width: 150 });
                
                doc.y = visitaY + 28;
            });
        }
        
        // Línea divisoria entre usuarios
        if (usuarioIndex < usuarios.length - 1) {
          if (doc.y + 15 > doc.page.height - 100) {
            doc.addPage();
            doc.y = 40;
          } else {
            doc.y += 10;
            doc.moveTo(40, doc.y)
               .lineTo(doc.page.width - 40, doc.y)
               .lineWidth(0.5)
               .stroke(colors.lightGray);
            doc.y += 10;
          }
        }
      });
      
      // ==============================================
      // OBSERVACIONES FINALES
      // ==============================================
      
      if (doc.y > 500) {
        doc.addPage();
        doc.y = 40;
      } else {
        doc.moveDown(2);
      }
      
      doc.fontSize(16)
         .fillColor(colors.primary)
         .font('Helvetica-Bold')
         .text('III. CONCLUSIONES', 40, doc.y);
      
      doc.moveTo(40, doc.y + 3)
         .lineTo(400, doc.y + 3)
         .lineWidth(2)
         .stroke(colors.secondary);
      
      doc.moveDown(1.5);
      
      const totalUsuariosAnalizados = usuarios.length;
      const porcentajeActivos = totalUsuariosAnalizados > 0 
        ? ((estadisticas.usuarios_con_actividad / totalUsuariosAnalizados) * 100).toFixed(1) 
        : 0;
      
      const promedioActividad = totalUsuariosAnalizados > 0 
        ? (actividadTotal / totalUsuariosAnalizados).toFixed(1) 
        : 0;
      
      const observaciones = [
        `1. Total de usuarios analizados: ${totalUsuariosAnalizados}`,
        `2. Usuarios con actividad registrada: ${estadisticas.usuarios_con_actividad} (${porcentajeActivos}%)`,
        `3. Actividad total registrada: ${actividadTotal} acciones`,
        `4. Promedio de actividad por usuario: ${promedioActividad} acciones`,
        `5. Archivos subidos en el período: ${estadisticas.total_archivos_subidos}`,
        `6. Comentarios realizados: ${estadisticas.total_comentarios}`,
        `7. Archivos visualizados: ${estadisticas.total_visitas}`,
        `8. Usuario más activo: ${estadisticas.usuarios_mas_activos[0]?.nombre_completo || 'No disponible'} (${estadisticas.usuarios_mas_activos[0]?.actividad_total || 0} acciones)`,
      ];
      
      observaciones.forEach((obs) => {
        doc.fontSize(9)
           .fillColor(colors.darkText)
           .font('Helvetica')
           .text(obs, 50, doc.y, {
             width: 500,
             indent: 10,
             paragraphGap: 6
           });
      });
      
      // Pie de página
      const minFooterY = doc.page.height - 90;
      if (doc.y < minFooterY) {
        doc.y = minFooterY;
      }
      
      const footerY = doc.page.height - 80;
      doc.moveTo(40, footerY)
         .lineTo(doc.page.width - 40, footerY)
         .lineWidth(1)
         .stroke(colors.secondary);
      
      doc.fontSize(8)
         .fillColor(colors.primary)
         .font('Helvetica-Bold')
         .text('SISTEMA DE TRANSPORTE CONVENCIONAL DE HIDALGO', 40, footerY + 5);
      
      doc.fontSize(7)
         .fillColor(colors.darkText)
         .font('Helvetica')
         .text('MOVILIDAD - SECRETARÍA DE MOVILIDAD Y TRANSPORTE', 40, footerY + 17);
      
      doc.fontSize(7)
         .fillColor(colors.lightText)
         .font('Helvetica')
         .text('Estado Libre y Soberano de Hidalgo - PRIMERO EL PUEBLO', 40, footerY + 29);
      
      const docInfoX = doc.page.width - 220;
      
      doc.fontSize(7)
         .fillColor(colors.gray)
         .text(`Documento: ${docNumber}`, docInfoX, footerY + 5, { width: 180, align: 'right' });
      
      doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`, docInfoX, footerY + 17, { width: 180, align: 'right' });
      
      doc.text('Documento Confidencial - Uso Interno', docInfoX, footerY + 29, { width: 180, align: 'right' });
      
      // Finalizar el documento
      doc.end();
      
    } catch (error) {
      console.error('Error en generación de reporte:', error);
      
      // Solo enviar error si no se han enviado headers
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error generando reporte de actividad',
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      } else {
        // Si ya se enviaron headers, forzar cierre de la conexión
        try {
          res.destroy();
        } catch (e) {
          console.error('Error cerrando conexión:', e);
        }
      }
    }
  }
}

module.exports = new ReporteActividadController();