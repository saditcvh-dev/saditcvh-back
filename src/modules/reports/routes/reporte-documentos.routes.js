// reportes/routes/reporte-digitalizacion.routes.js
const express = require('express');
const router = express.Router();
const ReporteDigitalizacionController = require('../controllers/reporte-documentos.controller');

// ==============================================
// CONFIGURAR CORS
// ==============================================
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:4200');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// ==============================================
// RUTAS DE REPORTE DE DIGITALIZACIÓN
// ==============================================

// 1. GENERAR REPORTE DE DIGITALIZACIÓN EN PDF
router.get('/pdf', async (req, res) => {
  console.log('📄 SOLICITUD DE REPORTE DE DIGITALIZACIÓN (PDF)');
  console.log('Filtros:', req.query);
  console.log('Timestamp:', new Date().toISOString());
  
  return await ReporteDigitalizacionController.generarReporteDigitalizacionPDF(req, res);
});

// 2. GENERAR REPORTE DE RENDIMIENTO DE DIGITALIZADORES EN PDF
router.get('/rendimiento/pdf', async (req, res) => {
  console.log('📊 SOLICITUD DE REPORTE DE RENDIMIENTO (PDF)');
  console.log('Filtros:', req.query);
  console.log('Timestamp:', new Date().toISOString());
  
  return await ReporteDigitalizacionController.generarReporteRendimientoPDF(req, res);
});

// 3. OBTENER REPORTE DETALLADO POR MODALIDAD (NUEVA RUTA)
router.get('/modalidad/detallado', async (req, res) => {
  console.log('🚌 SOLICITUD DE REPORTE DETALLADO POR MODALIDAD');
  console.log('Filtros:', req.query);
  console.log('Timestamp:', new Date().toISOString());
  
  return await ReporteDigitalizacionController.getReporteModalidadDetallado(req, res);
});

// 4. OBTENER ÚLTIMOS DOCUMENTOS SUBIDOS
router.get('/ultimos-documentos', async (req, res) => {
  console.log('📄 SOLICITUD DE ÚLTIMOS DOCUMENTOS SUBIDOS');
  console.log('Límite solicitado:', req.query.limit || 5);
  console.log('Timestamp:', new Date().toISOString());
  
  return await ReporteDigitalizacionController.getUltimosDocumentos(req, res);
});

// 5. RUTA DE PRUEBA Y ESTADO DEL SERVICIO
router.get('/status', (req, res) => {
  console.log('🧪 Health check del servicio de reportes de digitalización');
  res.json({ 
    status: 'ok', 
    service: 'reportes-digitalizacion',
    version: '2.0.0',
    new_features: [
      'Distribución detallada por modalidad de transporte',
      'Reporte específico por modalidad',
      'Gráficos de distribución en PDF',
      'Estadísticas avanzadas por modalidad'
    ],
    endpoints: [
      {
        method: 'GET',
        path: '/api/reports/reporte-digitalizacion/pdf',
        description: 'Generar reporte completo de digitalización en PDF',
        filters: 'tipo_id, modalidad_id, municipio_id, estado_digitalizacion, start_date, end_date, search, digitalizado_por'
      },
      {
        method: 'GET',
        path: '/api/reports/reporte-digitalizacion/rendimiento/pdf',
        description: 'Generar reporte de rendimiento de digitalizadores en PDF',
        filters: 'start_date, end_date'
      },
      {
        method: 'GET',
        path: '/api/reports/reporte-digitalizacion/modalidad/detallado',
        description: 'Obtener reporte detallado por modalidad de transporte',
        filters: 'start_date, end_date, estado_digitalizacion',
        features: [
          'Distribución por modalidad',
          'Porcentajes de digitalización',
          'Estadísticas de tamaño y páginas',
          'Información de OCR por modalidad'
        ]
      },
      {
        method: 'GET',
        path: '/api/reports/reporte-digitalizacion/ultimos-documentos',
        description: 'Obtener los últimos documentos subidos',
        parameters: {
          limit: 'Número de documentos a obtener (default: 5)'
        }
      }
    ],
    filters_available: {
      // Filtros generales
      tipo_id: {
        description: 'Filtrar por ID de tipo de autorización',
        values: '1: Concesión, 2: Permiso'
      },
      modalidad_id: {
        description: 'Filtrar por ID de modalidad específica',
        values: 'Consultar tabla modalidad'
      },
      municipio_id: {
        description: 'Filtrar por ID de municipio',
        format: 'Código de 2 dígitos (ej: 01, 80)'
      },
      estado_digitalizacion: {
        description: 'Filtrar por estado de digitalización',
        values: "'completado', 'pendiente', 'en_proceso', 'rechazado'"
      },
      // Filtros por fecha
      start_date: {
        description: 'Fecha de inicio del período',
        format: 'YYYY-MM-DD'
      },
      end_date: {
        description: 'Fecha de fin del período',
        format: 'YYYY-MM-DD'
      },
      // Búsqueda
      search: {
        description: 'Búsqueda textual en documentos',
        fields: 'Número de documento, título, descripción, nombre de archivo'
      },
      // Usuario
      digitalizado_por: {
        description: 'ID del usuario digitalizador'
      },
      // Configuración
      include_files: {
        description: 'Incluir información de archivos digitales',
        default: 'true',
        values: 'true/false'
      },
      limit: {
        description: 'Número máximo de resultados',
        default: '100'
      },
      offset: {
        description: 'Desplazamiento para paginación',
        default: '0'
      }
    },
    metadata_included: {
      general_statistics: {
        total_documents: 'Total de documentos en el sistema',
        digitalized_documents: 'Documentos con al menos un archivo digital',
        pending_documents: 'Documentos sin archivos digitales',
        total_file_size_mb: 'Tamaño total de archivos en MB',
        average_file_size_mb: 'Tamaño promedio por archivo en MB',
        total_pages_digitalized: 'Total de páginas digitalizadas'
      },
      distribution_statistics: {
        documents_by_status: 'Distribución por estado de digitalización',
        documents_by_authorization_type: 'Distribución por tipo de autorización',
        documents_by_modalidad: 'Distribución básica por modalidad',
        distribution_by_modalidad: 'Distribución detallada por modalidad (NUEVO)',
        totals_by_modalidad: 'Totales consolidados por modalidad (NUEVO)'
      },
      performance_statistics: {
        top_digitalizers: 'Top 10 digitalizadores por cantidad de documentos',
        progress_percentage: 'Porcentaje total de avance en digitalización'
      }
    },
    modalidades_soportadas: [
      { id: 1, num: 10, nombre: 'Individual Libre' },
      { id: 2, num: 11, nombre: 'Taxi o Sitio' },
      { id: 3, num: 12, nombre: 'Servicio Colectivo' },
      { id: 4, num: 13, nombre: 'Urbano' },
      { id: 5, num: 14, nombre: 'Sub-Urbano' },
      { id: 6, num: 15, nombre: 'Inter-Urbano' },
      { id: 7, num: 16, nombre: 'Servicio Mixto de Pasajeros y Carga' },
      { id: 8, num: 21, nombre: 'Carga Ligera' },
      { id: 9, num: 22, nombre: 'Servicio de Grua' },
      { id: 10, num: 23, nombre: 'Transporte de Agua en Pipa' },
      { id: 11, num: 24, nombre: 'Materiales para la Construccion' },
      { id: 12, num: 25, nombre: 'Carga en General' },
      { id: 13, num: 27, nombre: 'Transporte de Agua No Potable en Pipa' },
      { id: 14, num: 30, nombre: 'Transporte Escolar' },
      { id: 15, num: 31, nombre: 'Transporte de Personal' },
      { id: 16, num: 32, nombre: 'Transporte de Turismo' },
      { id: 17, num: 40, nombre: 'Transporte Mercantil' },
      { id: 18, num: 50, nombre: 'Transporte Hospitalario' },
      { id: 19, num: 51, nombre: 'Transporte Funeral' }
    ],
    report_structure: [
      'I. Encabezado oficial institucional',
      'II. Distribución por modalidad de transporte (NUEVO)',
      'III. Resumen estadístico de digitalización',
      'IV. Listado de documentos digitalizados',
      'V. Detalle por documento',
      'VI. Observaciones y conclusiones mejoradas',
      'VII. Pie de página institucional'
    ],
    new_modalidad_features: {
      tabla_detallada: {
        columns: [
          'Número de modalidad',
          'Nombre de modalidad',
          'Total documentos',
          'Documentos digitalizados',
          'Porcentaje de avance',
          'Tamaño total (MB)',
          'Total páginas'
        ],
        description: 'Tabla completa con todas las modalidades'
      },
      grafico_barras: {
        description: 'Gráfico de las 10 modalidades con más documentos',
        features: [
          'Visualización comparativa',
          'Porcentajes de distribución',
          'Códigos de colores'
        ]
      },
      analisis_estadistico: {
        features: [
          'Modalidad con más documentos',
          'Modalidad con menos documentos',
          'Porcentaje total por modalidad',
          'Tamaño promedio por modalidad'
        ]
      }
    },
    timestamp: new Date().toISOString()
  });
});

// ==============================================
// RUTA DE EJEMPLO Y PRUEBAS (ACTUALIZADA)
// ==============================================
router.get('/ejemplo', (req, res) => {
  console.log('📋 Ejemplo de parámetros para reportes de digitalización');
  
  const ejemploReporteGeneral = {
    tipo_autorizacion_id: '1',
    modalidad_id: '3',
    municipio_id: '80',
    estado_digitalizacion: 'completado',
    start_date: '2025-01-01',
    end_date: '2025-12-31',
    search: 'reporte',
    digitalizado_por: '9',
    include_files: 'true',
    limit: '50',
    offset: '0'
  };
  
  const ejemploModalidad = {
    start_date: '2025-01-01',
    end_date: '2025-12-31',
    estado_digitalizacion: 'completado'
  };
  
  res.json({
    message: 'Ejemplos de parámetros para reportes de digitalización',
    description: 'Copia los parámetros y ajusta según sea necesario',
    
    general_report: {
      description: 'Reporte completo de digitalización con todos los filtros',
      example_url: '/api/reports/reporte-digitalizacion/pdf?' + Object.entries(ejemploReporteGeneral)
        .map(([key, value]) => `${key}=${value}`)
        .join('&'),
      parameters: ejemploReporteGeneral
    },
    
    modalidad_report: {
      description: 'Reporte detallado por modalidad de transporte (NUEVO)',
      example_url: '/api/reports/reporte-digitalizacion/modalidad/detallado?' + Object.entries(ejemploModalidad)
        .map(([key, value]) => `${key}=${value}`)
        .join('&'),
      parameters: ejemploModalidad,
      features: [
        'Distribución por modalidad',
        'Porcentajes de digitalización',
        'Estadísticas de tamaño',
        'Información de OCR'
      ]
    },
    
    quick_tests: [
      {
        description: 'Reporte de concesiones completadas en municipio 80',
        url: '/api/reports/reporte-digitalizacion/pdf?tipo_autorizacion_id=1&municipio_id=80&estado_digitalizacion=completado'
      },
      {
        description: 'Reporte de documentos pendientes de digitalización',
        url: '/api/reports/reporte-digitalizacion/pdf?estado_digitalizacion=pendiente&limit=20'
      },
      {
        description: 'Reporte detallado por modalidad (todos los estados)',
        url: '/api/reports/reporte-digitalizacion/modalidad/detallado'
      },
      {
        description: 'Reporte por modalidad solo completados',
        url: '/api/reports/reporte-digitalizacion/modalidad/detallado?estado_digitalizacion=completado'
      },
      {
        description: 'Reporte de rendimiento de todos los digitalizadores',
        url: '/api/reports/reporte-digitalizacion/rendimiento/pdf'
      },
      {
        description: 'Reporte de documentos digitalizados por usuario 9',
        url: '/api/reports/reporte-digitalizacion/pdf?digitalizado_por=9&include_files=true'
      },
      {
        description: 'Últimos 10 documentos subidos',
        url: '/api/reports/reporte-digitalizacion/ultimos-documentos?limit=10'
      }
    ],
    
    // Ejemplos específicos por modalidad
    modalidad_examples: [
      {
        modalidad: 'Transporte Escolar (30)',
        url: '/api/reports/reporte-digitalizacion/pdf?modalidad_id=14'
      },
      {
        modalidad: 'Transporte de Turismo (32)',
        url: '/api/reports/reporte-digitalizacion/pdf?modalidad_id=16&estado_digitalizacion=completado'
      },
      {
        modalidad: 'Carga en General (25)',
        url: '/api/reports/reporte-digitalizacion/pdf?modalidad_id=12&start_date=2025-01-01'
      },
      {
        modalidad: 'Comparar múltiples modalidades',
        description: 'Usar reporte general y filtrar en aplicación'
      }
    ],
    
    // Características del nuevo reporte por modalidad
    new_features_info: {
      distribution_by_modalidad: {
        description: 'Sección detallada en PDF con distribución por modalidad',
        includes: [
          'Tabla con todas las modalidades',
          'Gráfico de barras del top 10',
          'Totales consolidados',
          'Porcentajes de avance'
        ]
      },
      enhanced_observations: {
        description: 'Observaciones mejoradas con análisis por modalidad',
        includes: [
          'Modalidad con más documentos',
          'Modalidad con menos documentos',
          'Porcentaje total por modalidad',
          'Recomendaciones específicas'
        ]
      }
    }
  });
});

module.exports = router;