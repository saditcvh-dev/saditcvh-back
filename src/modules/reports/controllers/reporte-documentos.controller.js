const PDFDocument = require('pdfkit');
const DigitalizationReportService = require('../services/documentos.service');
const fs = require('fs');
const path = require('path');

class DigitalizationReportController {
  
  // GENERAR REPORTE DE DIGITALIZACIÓN EN PDF
  async generarReporteDigitalizacionPDF(req, res) {
    let doc = null;
    
    try {   
      const filters = {
        tipo_autorizacion_id: req.query.tipo_autorizacion_id, 
        modalidad_id: req.query.modalidad_id,
        municipio_id: req.query.municipio_id,
        estado_digitalizacion: req.query.estado_digitalizacion,
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        search: req.query.search,
        digitalizado_por: req.query.digitalizado_por,
        include_files: req.query.include_files !== 'false',
        limit: req.query.limit || 100,
        offset: req.query.offset || 0
      };
      
      // Obtener datos del servicio
      const report = await DigitalizationReportService.getDigitalizationReport(filters);
      
      if (!report.success || !report.data || report.data.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No se encontraron documentos para generar el reporte',
          data: []
        });
      }
      doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: 'Reporte de Digitalización - STCH',
          Author: 'Sistema de Gestión Documental STCH',
          Subject: 'Reporte completo de digitalización de documentos y archivos',
          Keywords: 'STCH, digitalización, reporte, documentos, archivos, estadísticas, OCR, modalidad, transporte'
        }
      });
      
      // Configurar headers para descarga
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="reporte_digitalizacion_stch_${Date.now()}.pdf"`);
      
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
         .text('REPORTE DE DIGITALIZACIÓN DOCUMENTAL', { align: 'center' });
      
      doc.fontSize(12)
         .fillColor(colors.lightText)
         .font('Helvetica')
         .text('Sistema de Gestión Documental STCH - Área de Digitalización', { align: 'center' });
      
      doc.moveDown(1);
      
      doc.fontSize(10)
         .fillColor(colors.gray)
         .font('Helvetica')
         .text(`Número de referencia: STCH-DIG-DET-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${Date.now().toString().slice(-4)}`, { align: 'center' });
      
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
        : 'Período analizado: Completo';
      
      doc.text(periodoText, { align: 'center' });
      
      doc.moveDown(2);
      doc.moveTo(40, doc.y)
         .lineTo(doc.page.width - 40, doc.y)
         .lineWidth(0.8)
         .stroke(colors.lightGray);
      doc.moveDown(1.5);
      
      // ==============================================
      // I. RESUMEN ESTADÍSTICO DE DIGITALIZACIÓN
      // ==============================================
      
      doc.fontSize(16)
         .fillColor(colors.primary)
         .font('Helvetica-Bold')
         .text('I. RESUMEN ESTADÍSTICO DE DIGITALIZACIÓN', 40, doc.y);
      
      doc.moveTo(40, doc.y + 3)
         .lineTo(450, doc.y + 3)
         .lineWidth(2)
         .stroke(colors.secondary);
      
      doc.moveDown(1.5);
      
      const statsY = doc.y;
      const cardWidth = 100;
      const cardHeight = 45;
      const gap = 10;
      
      const totalDocs = report.metadata?.total_documents || 0;
      const digitalizados = report.metadata?.digitalized_documents || 0;
      const pendientes = report.metadata?.pending_documents || 0;
      const porcentajeDigitalizacion = report.metadata?.progressPercentage || 0;
      const totalSizeMB = report.metadata?.total_file_size_mb?.toFixed(2) || 0;
      const avgSizeMB = report.metadata?.average_file_size_mb?.toFixed(2) || 0;
      const totalPaginas = report.metadata?.total_pages_digitalized || 0;
      
      // Tarjeta 1: Total documentos
      doc.rect(40, statsY, cardWidth, cardHeight)
         .fill(colors.lightBg)
         .stroke(colors.primary);
      
      doc.fontSize(22)
         .fillColor(colors.primary)
         .font('Helvetica-Bold')
         .text(totalDocs.toString(), 55, statsY + 8);
      
      doc.fontSize(9)
         .fillColor(colors.darkText)
         .font('Helvetica-Bold')
         .text('DOCUMENTOS TOTALES', 55, statsY + 33, { width: cardWidth - 30 });
      
      // Tarjeta 2: Digitalizados
      doc.rect(40 + cardWidth + gap, statsY, cardWidth, cardHeight)
         .fill('#F0FFF4')
         .stroke(colors.success);
      
      doc.fontSize(22)
         .fillColor(colors.success)
         .font('Helvetica-Bold')
         .text(digitalizados.toString(), 55 + cardWidth + gap, statsY + 8);
      
      doc.fontSize(9)
         .fillColor(colors.darkText)
         .font('Helvetica-Bold')
         .text('DIGITALIZADOS', 55 + cardWidth + gap, statsY + 33, { width: cardWidth - 30 });
      
      // Tarjeta 3: Pendientes
      doc.rect(40 + (cardWidth * 2) + (gap * 2), statsY, cardWidth, cardHeight)
         .fill('#FFF5F5')
         .stroke(colors.danger);
      
      doc.fontSize(22)
         .fillColor(colors.danger)
         .font('Helvetica-Bold')
         .text(pendientes.toString(), 55 + (cardWidth * 2) + (gap * 2), statsY + 8);
      
      doc.fontSize(9)
         .fillColor(colors.darkText)
         .font('Helvetica-Bold')
         .text('PENDIENTES', 55 + (cardWidth * 2) + (gap * 2), statsY + 33, { width: cardWidth - 30 });
      
      // Tarjeta 4: Porcentaje
      doc.rect(40 + (cardWidth * 3) + (gap * 3), statsY, cardWidth, cardHeight)
         .fill('#F0F9FF')
         .stroke(colors.info);
      
      doc.fontSize(22)
         .fillColor(colors.info)
         .font('Helvetica-Bold')
         .text(`${porcentajeDigitalizacion}%`, 55 + (cardWidth * 3) + (gap * 3), statsY + 8);
      
      doc.fontSize(9)
         .fillColor(colors.darkText)
         .font('Helvetica-Bold')
         .text('AVANCE TOTAL', 55 + (cardWidth * 3) + (gap * 3), statsY + 33, { width: cardWidth - 30 });
      
      doc.y = statsY + cardHeight + 25;
      
      // Información de tamaño
      doc.fontSize(12)
         .fillColor(colors.primary)
         .font('Helvetica-Bold')
         .text('Almacenamiento digital:', 40, doc.y);
      
      doc.moveDown(0.8);
      
      const storageY = doc.y;
      
      // Tamaño total
      doc.fontSize(9)
         .fillColor(colors.darkText)
         .font('Helvetica-Bold')
         .text('Tamaño total de archivos:', 40, storageY);
      
      doc.fontSize(11)
         .fillColor(colors.info)
         .font('Helvetica-Bold')
         .text(`${totalSizeMB} MB`, 180, storageY);
      
      // Tamaño promedio
      doc.fontSize(9)
         .fillColor(colors.darkText)
         .font('Helvetica-Bold')
         .text('Tamaño promedio por archivo:', 40, storageY + 12);
      
      doc.fontSize(11)
         .fillColor(colors.purple)
         .font('Helvetica-Bold')
         .text(`${avgSizeMB} MB`, 180, storageY + 12);
      
      // Total páginas digitalizadas
      doc.fontSize(9)
         .fillColor(colors.darkText)
         .font('Helvetica-Bold')
         .text('Total páginas digitalizadas:', 40, storageY + 24);
      
      doc.fontSize(11)
         .fillColor(colors.success)
         .font('Helvetica-Bold')
         .text(`${totalPaginas} páginas`, 180, storageY + 24);
      
      doc.y = storageY + 40;
      
      // ==============================================
      // II. DISTRIBUCIÓN POR TIPO DE AUTORIZACIÓN
      // ==============================================
      
      if (report.metadata?.documents_by_authorization_type && report.metadata.documents_by_authorization_type.length > 0) {
        if (doc.y > 550) {
          doc.addPage();
          doc.y = 40;
        }
        
        doc.moveDown(1.5);
        
        doc.fontSize(16)
           .fillColor(colors.primary)
           .font('Helvetica-Bold')
           .text('II. DISTRIBUCIÓN POR TIPO DE AUTORIZACIÓN', 40, doc.y);
        
        doc.moveTo(40, doc.y + 3)
           .lineTo(400, doc.y + 3)
           .lineWidth(2)
           .stroke(colors.secondary);
        
        doc.moveDown(0.8);
        
        const authStartY = doc.y;
        report.metadata.documents_by_authorization_type.forEach((authType, index) => {
          const y = authStartY + (index * 16);
          const totalByType = authType.count || 0;
          const percentage = totalDocs > 0 ? (totalByType / totalDocs) * 100 : 0;
          const barLength = totalDocs > 0 ? (totalByType / totalDocs) * 200 : 0;
          
          doc.fontSize(9)
             .fillColor(colors.darkText)
             .font('Helvetica-Bold')
             .text(`${authType.type} (${authType.abbreviation})`, 40, y, { width: 120 });
          
          const barColors = [colors.primary, colors.success];
          doc.rect(170, y + 3, barLength, 10)
             .fill(barColors[index % barColors.length]);
          
          doc.fontSize(9)
             .fillColor(colors.lightText)
             .font('Helvetica')
             .text(`${totalByType} (${percentage.toFixed(1)}%)`, 380, y, { width: 80, align: 'right' });
        });
        
        doc.y = authStartY + (report.metadata.documents_by_authorization_type.length * 16) + 20;
      }
      
      // ==============================================
      // III. TOP DIGITALIZADORES
      // ==============================================
      
      if (report.metadata?.top_digitalizers && report.metadata.top_digitalizers.length > 0) {
        if (doc.y > 550) {
          doc.addPage();
          doc.y = 40;
        }
        
        doc.moveDown(1.5);
        
        doc.fontSize(16)
           .fillColor(colors.primary)
           .font('Helvetica-Bold')
           .text('III. TOP DIGITALIZADORES', 40, doc.y);
        
        doc.moveTo(40, doc.y + 3)
           .lineTo(300, doc.y + 3)
           .lineWidth(2)
           .stroke(colors.secondary);
        
        doc.moveDown(0.8);
        
        const topStartY = doc.y;
        report.metadata.top_digitalizers.forEach((dig, index) => {
          const y = topStartY + (index * 16);
          const maxDigitalized = Math.max(...report.metadata.top_digitalizers.map(d => d.total_digitalized));
          const barLength = maxDigitalized > 0 ? (dig.total_digitalized / maxDigitalized) * 150 : 0;
          
          doc.fontSize(8)
             .fillColor(colors.darkText)
             .font('Helvetica-Bold')
             .text(dig.full_name || dig.username, 40, y, { width: 100 });
          
          doc.rect(150, y + 3, barLength, 8)
             .fill(index === 0 ? colors.secondary : colors.info);
          
          doc.fontSize(8)
             .fillColor(colors.lightText)
             .font('Helvetica')
             .text(`${dig.total_digitalized} docs`, 315, y, { width: 80, align: 'right' });
          
          doc.fontSize(7)
             .fillColor(colors.gray)
             .font('Helvetica')
             .text(`(${dig.total_size_mb.toFixed(0)} MB)`, 370, y, { width: 80, align: 'right' });
        });
        
        doc.y = topStartY + (report.metadata.top_digitalizers.length * 16) + 15;
      }
      
      // ==============================================
      // IV. DISTRIBUCIÓN POR MODALIDAD DE TRANSPORTE
      // ==============================================
      
      if (report.metadata?.distribution_by_modalidad && report.metadata.distribution_by_modalidad.length > 0) {
        // Verificar si hay espacio suficiente
        if (doc.y > 500) {
          doc.addPage();
          doc.y = 40;
        }
        
        doc.moveDown(1.5);
        
        doc.fontSize(16)
           .fillColor(colors.primary)
           .font('Helvetica-Bold')
           .text('IV. DISTRIBUCIÓN POR MODALIDAD DE TRANSPORTE', 40, doc.y);
        
        doc.moveTo(40, doc.y + 3)
           .lineTo(500, doc.y + 3)
           .lineWidth(2)
           .stroke(colors.secondary);
        
        doc.moveDown(1.5);
        
        // GRÁFICO DE BARRAS POR MODALIDAD (TODAS)
        doc.moveDown(0.5);
        
        doc.fontSize(14)
           .fillColor(colors.primary)
           .font('Helvetica-Bold')
           .text('Distribución de documentos por modalidad:', 40, doc.y);
        
        doc.moveDown(0.8);
        
        // Usar TODAS las modalidades ordenadas por cantidad de documentos
        const todasModalidades = [...report.metadata.distribution_by_modalidad]
          .sort((a, b) => b.total_documentos - a.total_documentos);
        
        const maxDocumentosModalidad = Math.max(...todasModalidades.map(m => m.total_documentos || 0));
        const chartStartY = doc.y + 10;
        const chartWidth = 400;
        const barHeight = 14;
        const barSpacing = 4;
        
        // Mostrar todas las modalidades
        todasModalidades.forEach((modalidad, index) => {
          const barY = chartStartY + (index * (barHeight + barSpacing));
          const barLength = maxDocumentosModalidad > 0 ? 
            (modalidad.total_documentos / maxDocumentosModalidad) * chartWidth : 0;
          
          // Nombre de modalidad (abreviado si es necesario)
          const modalidadNombre = modalidad.modalidad_nombre || `Mod ${modalidad.modalidad_num}`;
          const nombreDisplay = modalidadNombre.length > 25 ? modalidadNombre.substring(0, 25) + '...' : modalidadNombre;
          
          doc.fontSize(7)
             .fillColor(colors.darkText)
             .font('Helvetica')
             .text(nombreDisplay, 40, barY + 3, { width: 120 });
          
          // Barra
          const barColors = [colors.primary, colors.success, colors.info, colors.warning, colors.purple];
          const barColor = barColors[index % barColors.length];
          
          doc.rect(165, barY, barLength, barHeight)
             .fill(barColor);
          
          // Valor numérico
          doc.fontSize(8)
             .fillColor(colors.darkText)
             .font('Helvetica-Bold')
             .text(modalidad.total_documentos.toString(), 170 + barLength, barY + 3);
          
          // Porcentaje de digitalización
          const porcentajeDigitalizacionModalidad = modalidad.porcentaje_digitalizacion || '0.0';
          doc.fontSize(7)
             .fillColor(colors.success)
             .font('Helvetica')
             .text(`${porcentajeDigitalizacionModalidad}%`, 210 + barLength, barY + 3);
        });
        
        doc.y = chartStartY + (todasModalidades.length * (barHeight + barSpacing)) + 20;
      }
      
      doc.moveDown(1.5);
      doc.moveTo(40, doc.y)
         .lineTo(doc.page.width - 40, doc.y)
         .lineWidth(0.8)
         .stroke(colors.lightGray);
      doc.moveDown(1.5);
      
      // ==============================================
      // V. LISTADO DE DOCUMENTOS DIGITALIZADOS
      // ==============================================

      if (doc.y > 550) {
        doc.addPage();
        doc.y = 40;
      }

      doc.fontSize(16)
         .fillColor(colors.primary)
         .font('Helvetica-Bold')
         .text('V. LISTADO DE DOCUMENTOS DIGITALIZADOS', 40, doc.y);

      doc.moveTo(40, doc.y + 3)
         .lineTo(400, doc.y + 3)
         .lineWidth(2)
         .stroke(colors.secondary);

      doc.moveDown(2);

      // Quitamos la columna 'Número'
      const headers = ['#', 'Título', 'Tipo', 'Modalidad', 'Estado', 'Versión', 'Tamaño (MB)'];
      const colWidths = [25, 160, 50, 80, 70, 50, 60]; // Más ancho para Título
      const totalTableWidth = colWidths.reduce((a, b) => a + b, 0);

      // Función para dibujar encabezado
      const dibujarEncabezadoTabla = (yPos) => {
        doc.rect(40, yPos, totalTableWidth, 28)
           .fill(colors.primary)
           .stroke(colors.primary);
        
        let currentX = 40;
        headers.forEach((header, index) => {
          const width = colWidths[index];
          
          doc.fontSize(9)
             .fillColor(colors.white)
             .font('Helvetica-Bold')
             .text(header, currentX + 3, yPos + 9, {
               width: width - 6,
               align: 'center'
             });
          
          currentX += width;
        });
        
        return yPos + 28;
      };

      let tableStartY = doc.y;
      let currentRowIndex = 0;
      let pageNumber = 1;

      // Dibujar primer encabezado
      tableStartY = dibujarEncabezadoTabla(tableStartY);

      // Procesar documentos
      for (let docIndex = 0; docIndex < report.data.length; docIndex++) {
        const documento = report.data[docIndex];
        
        // Calcular posición Y
        let rowY = tableStartY + (currentRowIndex * 26);
        
        // Verificar si necesitamos nueva página (dejando espacio para al menos 3 filas más)
        if (rowY + 80 > doc.page.height - 100) {
          doc.addPage();
          doc.y = 40;
          pageNumber++;
          
          // Título en página nueva
          if (pageNumber > 1) {
            doc.fontSize(16)
               .fillColor(colors.primary)
               .font('Helvetica-Bold')
               .text(`V. LISTADO DE DOCUMENTOS DIGITALIZADOS (Continuación)`, 40, doc.y);
            
            doc.moveTo(40, doc.y + 3)
               .lineTo(450, doc.y + 3)
               .lineWidth(2)
               .stroke(colors.secondary);
            
            doc.moveDown(2);
          }
          
          // Dibujar encabezado en nueva página
          tableStartY = doc.y;
          tableStartY = dibujarEncabezadoTabla(tableStartY);
          rowY = tableStartY;
          currentRowIndex = 0;
        }
        
        // Calcular posición Y actual
        const actualRowY = tableStartY + (currentRowIndex * 26);
        
        // Fondo alternado
        const rowBgColor = currentRowIndex % 2 === 0 ? colors.white : colors.lightBg;
        doc.rect(40, actualRowY, totalTableWidth, 26)
           .fill(rowBgColor);
        
        // Número global
        doc.fontSize(9)
           .fillColor(colors.darkText)
           .font('Helvetica')
           .text((docIndex + 1).toString(), 45, actualRowY + 8, { width: 15, align: 'center' });
        
        // Título (más ancho y en lugar del número)
        const titulo = documento.titulo || documento.descripcion || 'Sin título';
        // Mostramos el número del documento si no hay título específico
        const tituloDisplay = titulo === 'Sin título' && documento.numero_documento 
          ? documento.numero_documento
          : titulo;
          
        const tituloTruncado = tituloDisplay.length > 25 ? tituloDisplay.substring(0, 25) + '...' : tituloDisplay;
        doc.fontSize(8)
           .fillColor(colors.primary)
           .font('Helvetica-Bold')
           .text(tituloTruncado, 70, actualRowY + 8, { width: 150 });
        
        // Tipo de autorización
        const tipo = documento.tipo_autorizacion_abreviatura || 'N/A';
        const tipoColor = tipo === 'C' ? colors.success : tipo === 'P' ? colors.info : colors.gray;
        doc.fontSize(8)
           .fillColor(tipoColor)
           .font('Helvetica-Bold')
           .text(tipo, 235, actualRowY + 8, { width: 40, align: 'center' });
        
        // Modalidad
        const modalidad = documento.modalidad || 'N/A';
        const modalidadDisplay = modalidad.length > 15 ? modalidad.substring(0, 15) + '...' : modalidad;
        doc.fontSize(7)
           .fillColor(colors.purple)
           .font('Helvetica')
           .text(modalidadDisplay, 290, actualRowY + 8, { width: 70, align: 'center' });
        
        // Estado
        const estado = documento.estado_digitalizacion || 'pendiente';
        let estadoText = 'Pendiente';
        let estadoColor = colors.warning;
        
        if (estado === 'completado') {
          estadoText = 'Completado';
          estadoColor = colors.success;
        } else if (estado === 'en_proceso') {
          estadoText = 'En proceso';
          estadoColor = colors.info;
        } else if (estado === 'rechazado') {
          estadoText = 'Rechazado';
          estadoColor = colors.danger;
        }
        
        doc.fontSize(8)
           .fillColor(estadoColor)
           .font('Helvetica-Bold')
           .text(estadoText, 375, actualRowY + 8, { width: 60, align: 'center' });
        
        // Versión
        const version = documento.version_documento || 1;
        doc.fontSize(8)
           .fillColor(colors.purple)
           .font('Helvetica-Bold')
           .text(`v${version}`, 450, actualRowY + 8, { width: 40, align: 'center' });
        
        // Tamaño
        const tamanoMB = documento.digitalizacion_info?.total_tamano_mb || '0.00';
        const tamanoColor = parseFloat(tamanoMB) > 10 ? colors.warning : colors.gray;
        doc.fontSize(8)
           .fillColor(tamanoColor)
           .font('Helvetica')
           .text(tamanoMB, 505, actualRowY + 8, { width: 50, align: 'center' });
        
        // Borde inferior
        doc.moveTo(40, actualRowY + 26)
           .lineTo(40 + totalTableWidth, actualRowY + 26)
           .lineWidth(0.5)
           .stroke(colors.lightGray);
        
        currentRowIndex++;
      }

      // Borde exterior
      const tableHeight = 28 + (currentRowIndex * 26);
      doc.rect(40, tableStartY - 28, totalTableWidth, tableHeight)
         .stroke(colors.primary);

      doc.y = tableStartY + (currentRowIndex * 26) + 25;

      // ==============================================
      // VI. DETALLE POR DOCUMENTO
      // ==============================================

      // Verificar si hay suficiente espacio
      if (doc.y > 600) {
        doc.addPage();
        doc.y = 40;
      }

      doc.fontSize(16)
         .fillColor(colors.primary)
         .font('Helvetica-Bold')
         .text('VI. DETALLE POR DOCUMENTO', 40, doc.y);

      doc.moveTo(40, doc.y + 3)
         .lineTo(280, doc.y + 3)
         .lineWidth(2)
         .stroke(colors.secondary);

      doc.y += 15;

      // Generar sección detallada para cada documento
      report.data.forEach((documento, docIndex) => {
        // Verificar espacio
        if (doc.y > 680) {
          doc.addPage();
          doc.y = 40;
        }
        
        // Título del documento - Usar el título real o número si no hay título
        let tituloDocumento = documento.titulo || documento.descripcion || 'Sin título';
        
        // Si el título es genérico o vacío, usar el número del documento
        if (tituloDocumento === 'Sin título' || tituloDocumento === '' || tituloDocumento.trim().length === 0) {
          tituloDocumento = documento.numero_documento || `Documento ${documento.documento_id}`;
        }
        
        doc.fontSize(13)
           .fillColor(colors.primary)
           .font('Helvetica-Bold')
           .text(`${docIndex + 1}. ${tituloDocumento}`, 40, doc.y);
        
        doc.moveTo(40, doc.y + 3)
           .lineTo(250, doc.y + 3)
           .lineWidth(1)
           .stroke(colors.secondary);
        
        doc.y += 10;
        
        // Información básica en tarjetas
        let cardsStartY = doc.y;
        const infoCardWidth = (doc.page.width - 100) / 2;
        const infoCardHeight = 95;
        
        // Verificar espacio para tarjetas
        if (cardsStartY + infoCardHeight + 60 > doc.page.height - 100) {
          doc.addPage();
          doc.y = 40;
          
          doc.fontSize(13)
             .fillColor(colors.primary)
             .font('Helvetica-Bold')
             .text(`${docIndex + 1}. ${tituloDocumento}`, 40, doc.y);
          
          doc.moveTo(40, doc.y + 3)
             .lineTo(250, doc.y + 3)
             .lineWidth(1)
             .stroke(colors.secondary);
          
          doc.y += 10;
          cardsStartY = doc.y;
        }
        
        // Tarjeta 1: Información del documento
        doc.rect(40, cardsStartY, infoCardWidth, infoCardHeight)
           .fill(colors.lightBg)
           .stroke(colors.primary);
        
        // Título tarjeta 1
        doc.fontSize(9)
           .fillColor(colors.primary)
           .font('Helvetica-Bold')
           .text('INFORMACIÓN DEL DOCUMENTO', 50, cardsStartY + 8);
        
        // Líneas de información
        doc.fontSize(8)
           .fillColor(colors.darkText)
           .font('Helvetica');
        
        // Título - Mostrar número de documento en la línea de título
        const tituloDisplay = documento.titulo || documento.descripcion || documento.numero_documento || 'Sin título';
        const tituloTruncado = tituloDisplay.length > 25 ? tituloDisplay.substring(0, 25) + '...' : tituloDisplay;
        doc.text(`Título: ${tituloTruncado}`, 50, cardsStartY + 20);
        
        // Tipo de autorización
        const tipoAuth = documento.tipo_autorizacion || 'No especificado';
        doc.text(`Tipo: ${tipoAuth}`, 50, cardsStartY + 30);
        
        // Modalidad
        const modalidad = documento.modalidad || 'No especificada';
        const modalidadNum = documento.modalidad_numero ? ` (${documento.modalidad_numero})` : '';
        doc.text(`Modalidad: ${modalidad}${modalidadNum}`, 50, cardsStartY + 40);
        
        // Estado
        const estado = documento.estado_digitalizacion || 'pendiente';
        const estadoColor = estado === 'completado' ? colors.success : 
                           estado === 'en_proceso' ? colors.info : 
                           estado === 'rechazado' ? colors.danger : colors.warning;
        doc.fontSize(8)
           .fillColor(estadoColor)
           .font('Helvetica-Bold')
           .text(`Estado: ${estado}`, 50, cardsStartY + 50);
        
        // Fecha creación
        if (documento.fecha_creacion_documento) {
          doc.fontSize(7)
             .fillColor(colors.gray)
             .text(`Creado: ${new Date(documento.fecha_creacion_documento).toLocaleDateString('es-ES')}`, 50, cardsStartY + 60);
        }
        
        // Páginas del documento
        if (documento.paginas) {
          doc.fontSize(7)
             .fillColor(colors.gray)
             .text(`Páginas: ${documento.paginas}`, 50, cardsStartY + 70);
        }
        
        // Número de documento (si existe y no es igual al título)
        if (documento.numero_documento && documento.numero_documento !== tituloDisplay) {
          doc.fontSize(7)
             .fillColor(colors.gray)
             .text(`Número: ${documento.numero_documento}`, 50, cardsStartY + 80);
        }
        
        // Tarjeta 2: Información de digitalización
        const card2X = 40 + infoCardWidth + 20;
        
        doc.rect(card2X, cardsStartY, infoCardWidth, infoCardHeight)
           .fill('#F0F9FF')
           .stroke(colors.info);
        
        // Título tarjeta 2
        doc.fontSize(9)
           .fillColor(colors.info)
           .font('Helvetica-Bold')
           .text('INFORMACIÓN DE DIGITALIZACIÓN', card2X + 10, cardsStartY + 8);
        
        // Total archivos
        const totalArchivos = documento.digitalizacion_info?.total_archivos || 0;
        doc.fontSize(8)
           .fillColor(totalArchivos > 0 ? colors.success : colors.gray)
           .font('Helvetica-Bold')
           .text(`Archivos: ${totalArchivos}`, card2X + 10, cardsStartY + 20);
        
        // Tamaño total
        const tamanoTotal = documento.digitalizacion_info?.total_tamano_mb || '0.00';
        doc.fontSize(8)
           .fillColor(colors.purple)
           .font('Helvetica-Bold')
           .text(`Tamaño: ${tamanoTotal} MB`, card2X + 10, cardsStartY + 30);
        
        // Páginas digitalizadas
        const paginasDigitalizadas = documento.digitalizacion_info?.total_paginas || 0;
        doc.fontSize(8)
           .fillColor(colors.info)
           .font('Helvetica-Bold')
           .text(`Páginas: ${paginasDigitalizadas}`, card2X + 10, cardsStartY + 40);
        
        // Fecha última digitalización
        if (documento.digitalizacion_info?.fecha_ultima_digitalizacion) {
          doc.fontSize(7)
             .fillColor(colors.darkText)
             .font('Helvetica')
             .text(`Última: ${new Date(documento.digitalizacion_info.fecha_ultima_digitalizacion).toLocaleDateString('es-ES')}`, 
                   card2X + 10, cardsStartY + 50);
        }
        
        // Digitalizador
        if (documento.digitalizacion_info?.ultimo_digitalizador) {
          doc.fontSize(7)
             .fillColor(colors.darkText)
             .font('Helvetica')
             .text(`Por: ${documento.digitalizacion_info.ultimo_digitalizador}`, 
                   card2X + 10, cardsStartY + 60);
        }
        
        // Estado OCR
        const estadoOCR = documento.digitalizacion_info?.estado_ocr || 'sin_archivos';
        let estadoOCRColor = colors.gray;
        let estadoOCRTexto = 'Sin OCR';
        
        if (estadoOCR === 'procesado') {
          estadoOCRColor = colors.success;
          estadoOCRTexto = 'OCR Procesado';
        } else if (estadoOCR === 'en_proceso') {
          estadoOCRColor = colors.info;
          estadoOCRTexto = 'OCR En proceso';
        } else if (estadoOCR === 'pendiente') {
          estadoOCRColor = colors.warning;
          estadoOCRTexto = 'OCR Pendiente';
        }
        
        doc.fontSize(7)
           .fillColor(estadoOCRColor)
           .font('Helvetica-Bold')
           .text(estadoOCRTexto, card2X + 10, cardsStartY + 70);
        
        // Mover posición Y para siguiente contenido
        doc.y = cardsStartY + infoCardHeight + 12;
        
        // SECCIÓN DE ARCHIVOS ASOCIADOS
        if (documento.archivos_digitales && documento.archivos_digitales.length > 0) {
          // Verificar espacio
          if (doc.y + 25 > doc.page.height - 100) {
            doc.addPage();
            doc.y = 40;
          }
          
          // Título archivos
          doc.fontSize(11)
             .fillColor(colors.primary)
             .font('Helvetica-Bold')
             .text('Archivos digitales asociados:', 40, doc.y);
          
          let currentY = doc.y + 8;
          
          // Mostrar archivos
          documento.archivos_digitales.forEach((archivo, archivoIndex) => {
            // Verificar espacio para este archivo
            if (currentY + 45 > doc.page.height - 100) {
              doc.addPage();
              doc.y = 40;
              currentY = doc.y + 8;
            }
            
            // Contenedor de archivo
            doc.rect(45, currentY, doc.page.width - 85, 40)
               .fill('#F8FAFC')
               .stroke(colors.lightGray);
            
            // Nombre del archivo
            const nombreArchivo = archivo.nombre_archivo || 'Sin nombre';
            const nombreDisplay = nombreArchivo.length > 40 ? nombreArchivo.substring(0, 40) + '...' : nombreArchivo;
            
            doc.fontSize(9)
               .fillColor(colors.primary)
               .font('Helvetica-Bold')
               .text(`${archivoIndex + 1}. ${nombreDisplay}`, 50, currentY + 8);
            
            // Detalles del archivo
            doc.fontSize(7)
               .fillColor(colors.lightText)
               .font('Helvetica');
            
            const detalles = [];
            if (archivo.tamano_mb) detalles.push(`${archivo.tamano_mb} MB`);
            if (archivo.mime_type) detalles.push(archivo.mime_type);
            if (archivo.version_archivo) detalles.push(`v${archivo.version_archivo}`);
            if (archivo.total_paginas) detalles.push(`${archivo.total_paginas} páginas`);
            if (archivo.estado_ocr) detalles.push(`OCR: ${archivo.estado_ocr}`);
            
            doc.text(detalles.join(' | '), 50, currentY + 20);
            
            // Fecha y digitalizador
            if (archivo.fecha_digitalizacion) {
              const fecha = new Date(archivo.fecha_digitalizacion).toLocaleDateString('es-ES');
              const digitalizador = archivo.digitalizador_nombre || 'N/A';
              doc.text(`Digitalizado: ${fecha} por ${digitalizador}`, 50, currentY + 28);
            }
            
            currentY += 45;
          });
          
          doc.y = currentY;
        } else {
          // Sin archivos
          if (doc.y + 15 > doc.page.height - 100) {
            doc.addPage();
            doc.y = 40;
          }
          
          doc.fontSize(9)
             .fillColor(colors.gray)
             .font('Helvetica')
             .text('Sin archivos digitales asociados.', 40, doc.y);
          
          doc.y += 12;
        }
        
        // Línea divisoria entre documentos
        if (docIndex < report.data.length - 1) {
          if (doc.y + 15 > doc.page.height - 100) {
            doc.addPage();
            doc.y = 40;
          } else {
            doc.y += 5;
            doc.moveTo(40, doc.y)
               .lineTo(doc.page.width - 40, doc.y)
               .lineWidth(0.5)
               .stroke(colors.lightGray);
            doc.y += 8;
          }
        }
      });
      
      // ==============================================
      // VII. OBSERVACIONES Y CONCLUSIONES
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
         .text('VII. OBSERVACIONES Y CONCLUSIONES', 40, doc.y);
      
      doc.moveTo(40, doc.y + 3)
         .lineTo(400, doc.y + 3)
         .lineWidth(2)
         .stroke(colors.secondary);
      
      doc.moveDown(1.5);
      
      // Estadísticas globales obtenidas de los metadatos completos (evita limitarse a los 100 del array paginado)
      const documentosConArchivos = report.metadata?.digitalized_documents || 0;
      const statusCompletados = report.metadata?.documents_by_status?.find(s => s.status === 'completado')?.count || 0;
      const statusEnProceso = report.metadata?.documents_by_status?.find(s => s.status === 'en_proceso')?.count || 0;
      const statusPendientes = report.metadata?.documents_by_status?.find(s => s.status === 'pendiente')?.count || 0;
      const documentosCompletados = statusCompletados;
      const documentosEnProceso = statusEnProceso;
      const documentosPendientes = report.metadata?.pending_documents !== undefined ? report.metadata.pending_documents : statusPendientes;
      const documentosConOCR = report.metadata?.distribution_by_modalidad
        ? report.metadata.distribution_by_modalidad.reduce((sum, m) => sum + (m.archivos_ocr_procesado || 0), 0)
        : 0;
      const porcentajeCompletado = totalDocs > 0 ? 
        ((documentosCompletados / totalDocs) * 100).toFixed(1) : 0;
      
      const porcentajeConArchivos = totalDocs > 0 ? 
        ((documentosConArchivos / totalDocs) * 100).toFixed(1) : 0;
      
      const porcentajeOCR = documentosConArchivos > 0 ? 
        ((documentosConOCR / documentosConArchivos) * 100).toFixed(1) : 0;
      
      const topDigitalizador = report.metadata?.top_digitalizers?.[0];
      
      // Calcular promedio de versiones
      const totalVersiones = report.metadata?.digitalized_documents || 0;
      const promedioVersiones = totalDocs > 0 ? (totalVersiones / totalDocs).toFixed(1) : '1.0';
      
      // Distribución por tipo de autorización
      const distribucionTipo = report.metadata?.documents_by_authorization_type
        ? report.metadata.documents_by_authorization_type.map(a => `${a.type}: ${a.count}`).join(', ')
        : 'No disponible';
      
      // Distribución por modalidad (TODAS)
      let distribucionModalidad = 'No disponible';
      let modalidadTop = null;
      let modalidadMenor = null;
      
      if (report.metadata?.distribution_by_modalidad && report.metadata.distribution_by_modalidad.length > 0) {
        // Encontrar modalidad con más documentos (usando TODAS)
        const todasModalidades = [...report.metadata.distribution_by_modalidad]
          .sort((a, b) => b.total_documentos - a.total_documentos);
        
        modalidadTop = todasModalidades[0];
        modalidadMenor = todasModalidades[todasModalidades.length - 1];
        
        // Mostrar todas las modalidades en observaciones (limitado a 8 para no hacer muy largo)
        const modalidadesMostrar = todasModalidades.slice(0, 8);
        distribucionModalidad = modalidadesMostrar
          .map(m => `${m.modalidad_nombre}: ${m.total_documentos}`)
          .join(', ');
        
        // Si hay más de 8, agregar "y X más"
        if (todasModalidades.length > 8) {
          distribucionModalidad += `, y ${todasModalidades.length - 8} más`;
        }
      }
      
      // Totales por modalidad
      const totalsModalidad = report.metadata?.totalsByModalidad || {};
      
      const observaciones = [
        `1. Total de documentos analizados: ${totalDocs}`,
        `2. Documentos completados: ${documentosCompletados} (${porcentajeCompletado}%)`,
        `3. Documentos en proceso: ${documentosEnProceso}`,
        `4. Documentos pendientes: ${documentosPendientes}`,
        `5. Documentos con archivos digitales: ${documentosConArchivos} (${porcentajeConArchivos}%)`,
        `6. Documentos con OCR procesado: ${documentosConOCR} (${porcentajeOCR}% de los digitalizados)`,
        `7. Total páginas digitalizadas: ${totalPaginas} páginas`,
        `8. Tamaño total de almacenamiento: ${totalSizeMB} MB`,
        `9. Tamaño promedio por archivo: ${avgSizeMB} MB`,
        `10. Top digitalizador: ${topDigitalizador ? `${topDigitalizador.full_name} (${topDigitalizador.total_digitalized} docs)` : 'No disponible'}`,
        `11. Versiones por documento: Promedio ${promedioVersiones}`,
        `12. Distribución por tipo de autorización: ${distribucionTipo}`,
        `13. Total modalidades analizadas: ${report.metadata?.distribution_by_modalidad?.length || 0}`,
        `14. Modalidad con más documentos: ${modalidadTop ? `${modalidadTop.modalidad_nombre} (${modalidadTop.total_documentos} docs, ${modalidadTop.porcentaje_digitalizacion}%)` : 'N/A'}`,
        `15. Modalidad con menos documentos: ${modalidadMenor ? `${modalidadMenor.modalidad_nombre} (${modalidadMenor.total_documentos} docs, ${modalidadMenor.porcentaje_digitalizacion}%)` : 'N/A'}`,
        `16. Porcentaje total digitalización por modalidad: ${totalsModalidad.porcentaje_total_digitalizacion && totalsModalidad.porcentaje_total_digitalizacion !== "0.00" ? totalsModalidad.porcentaje_total_digitalizacion : (porcentajeDigitalizacion || "100.00")}%`,
        `17. Tamaño total por modalidad: ${totalsModalidad.total_tamano_mb && totalsModalidad.total_tamano_mb > 0 ? totalsModalidad.total_tamano_mb.toFixed(2) : totalSizeMB} MB`,
        `18. Distribución por modalidad: ${distribucionModalidad}`,
        `19. Fecha de corte del reporte: ${new Date().toLocaleDateString('es-ES')}`,
        `20. Filtros aplicados: ${Object.keys(filters)
          .filter(k => filters[k] !== undefined && filters[k] !== '' && k !== 'limit' && k !== 'offset' && k !== 'include_files')
          .map(k => `${k}: ${filters[k]}`)
          .join(', ') || 'Ninguno'}`,
        `21. Recomendaciones: ${porcentajeCompletado < 70 ? 'Se requiere acelerar el proceso de digitalización, especialmente en modalidades con bajo porcentaje.' : 'Progreso adecuado en digitalización.'}`
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
      const docNumber = `STCH-DIG-DET-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
      
      doc.fontSize(7)
         .fillColor(colors.gray)
         .text(`Documento: ${docNumber}`, docInfoX, footerY + 5, { width: 180, align: 'right' });
      
      doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`, docInfoX, footerY + 17, { width: 180, align: 'right' });
      
      doc.text('Documento Confidencial - Uso Interno', docInfoX, footerY + 29, { width: 180, align: 'right' });
      
      // Finalizar
      doc.end();
    } catch (error) {
      // Si el documento ya comenzó a escribirse, terminarlo limpiamente
      if (doc && !doc._readableState.ended) {
        try {
          doc.end();
        } catch (e) {
        }
      }
      
      // Solo enviar error si no se han enviado headers
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error generando reporte de digitalización',
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      } else {
      }
    }
  }
  
  // GENERAR REPORTE DE RENDIMIENTO POR DIGITALIZADOR EN PDF
  async generarReporteRendimientoPDF(req, res) {
    let doc = null;
    
    try {
      const filters = {
        start_date: req.query.start_date,
        end_date: req.query.end_date
      };
      
      // Obtener datos del servicio
      const report = await DigitalizationReportService.getDigitalizerPerformance(filters);
      
      if (!report.success || !report.data || report.data.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No se encontraron datos de rendimiento para generar el reporte',
          data: []
        });
      }
      
      doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: 'Reporte de Rendimiento - Digitalizadores STCH',
          Author: 'Sistema de Gestión Documental STCH',
          Subject: 'Reporte de rendimiento y productividad de digitalizadores',
          Keywords: 'STCH, rendimiento, digitalizadores, productividad, reporte, OCR'
        }
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="reporte_rendimiento_digitalizadores_stch_${Date.now()}.pdf"`);
      
      doc.pipe(res);
      
      // Colores (mismos que arriba)
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
      
      doc.end();
      
    } catch (error) {
      if (doc && !doc._readableState.ended) doc.end();
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error generando reporte de rendimiento',
          error: error.message
        });
      }
    }
  }

   // OBTENER ÚLTIMOS DOCUMENTOS SUBIDOS
   async getUltimosDocumentos(req, res) {
      try {
         const limit = parseInt(req.query.limit) || 5;

         const result = await DigitalizationReportService.getUltimosDocumentos(limit);
         
         if (result.success) {
               res.json(result);
         } else {
               res.status(500).json(result);
         }
         
      } catch (error) {
         res.status(500).json({
               success: false,
               message: 'Error interno al obtener últimos documentos',
               error: error.message
         });
      }
   }

   // NUEVO: OBTENER REPORTE DETALLADO POR MODALIDAD
   async getReporteModalidadDetallado(req, res) {
      try {
         const filters = {
            start_date: req.query.start_date,
            end_date: req.query.end_date,
            estado_digitalizacion: req.query.estado_digitalizacion
         };
         
         const result = await DigitalizationReportService.getModalidadDetailedReport(filters);
         
         if (result.success) {
            res.json(result);
         } else {
            res.status(500).json(result);
         }
         
      } catch (error) {
         res.status(500).json({
            success: false,
            message: 'Error interno al generar reporte por modalidad',
            error: error.message
         });
      }
   }
}

module.exports = new DigitalizationReportController();
