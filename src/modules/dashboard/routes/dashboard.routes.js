const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboard.controller');

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
// RUTAS DEL DASHBOARD - ESTADÍSTICAS Y KPIs
// ==============================================

// 1. ESTADÍSTICAS PRINCIPALES PARA KPIs DEL DASHBOARD
router.get('/estadisticas', async (req, res) => {
  console.log('📊 SOLICITUD DE ESTADÍSTICAS DEL DASHBOARD');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Parámetros de consulta:', req.query);
  
  return await DashboardController.getDashboardStats(req, res);
});

// 2. ESTADÍSTICAS AVANZADAS PARA GRÁFICOS Y ANALÍTICAS
router.get('/estadisticas/avanzadas', async (req, res) => {
  console.log('📈 SOLICITUD DE ESTADÍSTICAS AVANZADAS DEL DASHBOARD');
  console.log('Filtros aplicados:', req.query);
  console.log('Timestamp:', new Date().toISOString());
  
  return await DashboardController.getAdvancedStats(req, res);
});

// 3. DATOS ESPECÍFICOS PARA GRÁFICAS DEL DASHBOARD
router.get('/estadisticas/graficas', async (req, res) => {
  console.log('📊 SOLICITUD DE DATOS PARA GRÁFICAS DEL DASHBOARD');
  console.log('Tipo de gráficas solicitadas:', req.query.tipo || 'todas');
  console.log('Timestamp:', new Date().toISOString());
  
  return await DashboardController.getChartData(req, res);
});

// 4. ESTADÍSTICAS EN TIEMPO REAL (ÚLTIMOS 5 MINUTOS)
router.get('/estadisticas/tiempo-real', async (req, res) => {
  console.log('⚡ SOLICITUD DE ESTADÍSTICAS EN TIEMPO REAL');
  console.log('Intervalo:', req.query.intervalo || '5min');
  console.log('Timestamp:', new Date().toISOString());
  
  return await DashboardController.getRealTimeStats(req, res);
});

// 5. TENDENCIAS Y COMPARATIVAS
router.get('/estadisticas/tendencias', async (req, res) => {
  console.log('📈 SOLICITUD DE ANÁLISIS DE TENDENCIAS');
  console.log('Período:', req.query.periodo || 'mes_actual');
  console.log('Timestamp:', new Date().toISOString());
  
  return await DashboardController.getTrendAnalysis(req, res);
});

// 6. ESTADÍSTICAS DIARIAS (ÚLTIMOS 7 DÍAS)
router.get('/estadisticas/diarias', async (req, res) => {
  console.log('📅 SOLICITUD DE ESTADÍSTICAS DIARIAS (ÚLTIMOS 7 DÍAS)');
  console.log('Timestamp:', new Date().toISOString());
  
  return await DashboardController.getEstadisticasDiarias(req, res);
});

// 7. ESTADÍSTICAS POR TIPO DE DOCUMENTO (PARA GRÁFICA CIRCULAR)
router.get('/estadisticas/tipos', async (req, res) => {
    console.log('📊 SOLICITUD DE ESTADÍSTICAS POR TIPO DE DOCUMENTO');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Query params:', req.query);
    
    return await DashboardController.getEstadisticasPorTipo(req, res);
});

// 8. ESTADÍSTICAS POR MODALIDAD (GRÁFICA DE BARRAS/CIRCULAR)
router.get('/estadisticas/modalidad', async (req, res) => {
    console.log('🚌 SOLICITUD DE ESTADÍSTICAS POR MODALIDAD');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Query params:', req.query);
    
    return await DashboardController.getEstadisticasPorModalidad(req, res);
});

// 9. ESTADÍSTICAS POR MUNICIPIO (GRÁFICA DE MAPA/BARRAS)
router.get('/estadisticas/municipio', async (req, res) => {
    console.log('🗺️ SOLICITUD DE ESTADÍSTICAS POR MUNICIPIO');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Query params:', req.query);
    
    return await DashboardController.getEstadisticasPorMunicipio(req, res);
});

// 10. ESTADÍSTICAS DETALLADAS POR MODALIDAD (CON FILTROS)
router.get('/estadisticas/modalidad/detallada', async (req, res) => {
    console.log('📊 SOLICITUD DE ESTADÍSTICAS DETALLADAS POR MODALIDAD');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Filtros:', req.query);
    
    return await DashboardController.getEstadisticasModalidadDetallada(req, res);
});

// ==============================================
// RUTA DE PRUEBA Y ESTADO DEL SERVICIO
// ==============================================
router.get('/status', (req, res) => {
  console.log('🧪 Health check del servicio de dashboard');
  
  res.json({ 
    status: 'ok', 
    service: 'dashboard-estadisticas',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory_usage: process.memoryUsage(),
    
    endpoints: [
      {
        method: 'GET',
        path: '/api/dashboard/estadisticas',
        description: 'Estadísticas principales para KPIs del dashboard'
      },
      {
        method: 'GET',
        path: '/api/dashboard/estadisticas/avanzadas',
        description: 'Estadísticas avanzadas con filtros para gráficos',
        parameters: {
          tipo_id: 'Filtrar por ID de tipo de autorización',
          modalidad_id: 'Filtrar por ID de modalidad',
          municipio_id: 'Filtrar por ID de municipio',
          start_date: 'Fecha inicio (YYYY-MM-DD)',
          end_date: 'Fecha fin (YYYY-MM-DD)'
        }
      },
      {
        method: 'GET',
        path: '/api/dashboard/estadisticas/graficas',
        description: 'Datos estructurados específicamente para gráficas',
        parameters: {
          tipo: 'tipo de gráfica (documentos_mes, estados, tipos_documento)'
        }
      },
      {
        method: 'GET',
        path: '/api/dashboard/estadisticas/tiempo-real',
        description: 'Estadísticas de los últimos 5 minutos',
        parameters: {
          intervalo: 'intervalo de tiempo (5min, 15min, 30min, 1h)'
        }
      },
      {
        method: 'GET',
        path: '/api/dashboard/estadisticas/tendencias',
        description: 'Análisis de tendencias y comparativas',
        parameters: {
          periodo: 'periodo de análisis (mes_actual, trimestre, año_actual)'
        }
      }
    ],
    
    kpis_disponibles: {
      total_documentos: 'Total de documentos digitalizados en el sistema',
      total_paginas: 'Total de páginas procesadas',
      total_usuarios_activos: 'Usuarios activos en el sistema',
      documentos_hoy: 'Documentos creados en el día actual',
      documentos_semana: 'Documentos creados en la última semana',
      usuarios_nuevos_hoy: 'Usuarios nuevos registrados hoy',
      busquedas_hoy: 'Búsquedas realizadas en el sistema hoy',
      documentos_por_estado: 'Distribución de documentos por estado de digitalización',
      archivos_por_tipo: 'Distribución de archivos por tipo MIME',
      documentos_por_tipo: 'Distribución de documentos por tipo'
    },
    
    graficas_disponibles: {
      documentos_mes: 'Evolución de documentos por mes (últimos 6 meses)',
      estados_documentos: 'Distribución de documentos por estado',
      tipos_documentos: 'Top 10 tipos de documentos más frecuentes',
      digitalizadores_top: 'Top 10 digitalizadores por volumen',
      municipios_top: 'Municipios con más documentos',
      tendencias_temporal: 'Tendencias por día de la semana/hora'
    },
    
    data_refresh: {
      automatic_refresh: 'Cada 30 segundos (configurable)',
      manual_refresh: 'Disponible mediante endpoint',
      cache_enabled: 'Sí, 15 segundos para consultas frecuentes'
    },
    
    examples_quick: {
      kpis_basicos: '/api/dashboard/estadisticas',
      grafica_documentos_mes: '/api/dashboard/estadisticas/graficas?tipo=documentos_mes',
      estadisticas_filtradas: '/api/dashboard/estadisticas/avanzadas?municipio_id=80&tipo_id=1',
      tendencias_mes: '/api/dashboard/estadisticas/tendencias?periodo=mes_actual'
    }
  });
});

// ==============================================
// RUTA DE EJEMPLO Y PRUEBAS
// ==============================================
router.get('/ejemplo', (req, res) => {
  console.log('📋 Ejemplo de uso del dashboard API');
  
  const ejemplos = {
    kpis_principales: {
      description: 'Obtener todos los KPIs principales para el dashboard',
      url: '/api/dashboard/estadisticas',
      method: 'GET',
      response_structure: {
        success: 'boolean',
        data: {
          total_documentos: 'number',
          total_paginas: 'number',
          total_usuarios_activos: 'number',
          documentos_por_estado: 'object',
          documentos_hoy: 'number',
          documentos_semana: 'number',
          usuarios_nuevos_hoy: 'number',
          busquedas_hoy: 'number',
          archivos_por_tipo: 'object',
          documentos_por_tipo: 'object',
          timestamp: 'string'
        },
        metadata: {
          generated_at: 'string',
          query_count: 'number'
        }
      }
    },
    
    estadisticas_filtradas: {
      description: 'Obtener estadísticas filtradas por municipio y tipo',
      url: '/api/dashboard/estadisticas/avanzadas?municipio_id=80&tipo_id=1&start_date=2025-12-01',
      method: 'GET',
      parameters: {
        municipio_id: '80 (ejemplo: Hermosillo)',
        tipo_id: '1 (ejemplo: Concesión)',
        start_date: '2025-12-01 (fecha inicio)'
      }
    },
    
    datos_graficas: {
      description: 'Obtener datos para gráfica de documentos por mes',
      url: '/api/dashboard/estadisticas/graficas?tipo=documentos_mes',
      method: 'GET',
      response_example: {
        success: true,
        data: {
          documentos_por_mes: [
            { mes: '2025-07', mes_corto: 'Jul', cantidad: 15 },
            { mes: '2025-08', mes_corto: 'Aug', cantidad: 23 },
            // ... más meses
          ]
        }
      }
    },
    
    tendencias: {
      description: 'Análisis de tendencias del mes actual',
      url: '/api/dashboard/estadisticas/tendencias?periodo=mes_actual',
      method: 'GET',
      response_includes: {
        crecimiento: 'Porcentaje de crecimiento vs mes anterior',
        promedio_diario: 'Documentos procesados por día en promedio',
        dias_pico: 'Días con mayor actividad',
        comparativa: 'Comparativa con período anterior'
      }
    }
  };
  
  res.json({
    message: 'Ejemplos de uso del Dashboard API',
    service_description: 'API para obtener estadísticas y KPIs del sistema de gestión documental',
    version: '1.0.0',
    
    quick_tests: [
      {
        test: 'KPIs básicos del sistema',
        curl: 'curl -X GET "http://localhost:4000/api/dashboard/estadisticas" -H "Accept: application/json"'
      },
      {
        test: 'Datos para gráfica de documentos por estado',
        curl: 'curl -X GET "http://localhost:4000/api/dashboard/estadisticas/graficas?tipo=estados" -H "Accept: application/json"'
      },
      {
        test: 'Estadísticas del municipio 80',
        curl: 'curl -X GET "http://localhost:4000/api/dashboard/estadisticas/avanzadas?municipio_id=80" -H "Accept: application/json"'
      },
      {
        test: 'Tendencias del trimestre',
        curl: 'curl -X GET "http://localhost:4000/api/dashboard/estadisticas/tendencias?periodo=trimestre" -H "Accept: application/json"'
      }
    ],
    
    integration_example: {
      angular_component: {
        file: 'cards.component.ts',
        endpoint: 'http://localhost:4000/api/dashboard/estadisticas',
        refresh_interval: '30000 (30 segundos)',
        cards_config: [
          {
            id: 'documentos',
            title: 'Documentos Digitalizados',
            data_field: 'total_documentos',
            trend_field: 'documentos_hoy'
          },
          {
            id: 'paginas',
            title: 'Páginas Procesadas',
            data_field: 'total_paginas',
            trend_field: 'documentos_semana'
          },
          {
            id: 'usuarios',
            title: 'Usuarios Activos',
            data_field: 'total_usuarios_activos',
            trend_field: 'usuarios_nuevos_hoy'
          }
        ]
      }
    },
    
    available_filters: {
      general_filters: {
        tipo_id: 'ID del tipo de autorización (1: Concesión, 2: Permiso)',
        modalidad_id: 'ID de modalidad de autorización',
        municipio_id: 'ID de municipio (ej: 80 para Hermosillo)',
        digitalizado_por: 'ID del usuario digitalizador'
      },
      date_filters: {
        start_date: 'YYYY-MM-DD - Fecha de inicio para filtrar',
        end_date: 'YYYY-MM-DD - Fecha de fin para filtrar',
        periodo: 'predefinido: hoy, semana_actual, mes_actual, año_actual, trimestre'
      },
      analysis_filters: {
        intervalo: 'Para tiempo real: 5min, 15min, 30min, 1h, 24h',
        tipo_grafica: 'Para gráficas: documentos_mes, estados, tipos_documento, digitalizadores, municipios'
      }
    },
    
    response_format: {
      standard_response: {
        success: 'boolean - Indica si la operación fue exitosa',
        data: 'object - Datos principales de la respuesta',
        metadata: 'object - Metadatos adicionales (opcional)',
        message: 'string - Mensaje descriptivo (para errores o info)',
        error: 'string - Detalle del error (solo en caso de fallo)'
      },
      error_response: {
        status: 'HTTP status code (400, 404, 500, etc.)',
        success: 'false',
        message: 'Descripción del error',
        error: 'Detalle técnico del error',
        timestamp: 'Fecha/hora del error'
      }
    },
    
    monitoring: {
      health_check: '/api/dashboard/status',
      performance: 'Todas las consultas incluyen tiempo de ejecución en logs',
      caching: 'Las consultas frecuentes tienen cache de 15 segundos',
      logging: 'Todas las solicitudes se registran con timestamp y parámetros'
    },
    
    examples: ejemplos,
    
    timestamp: new Date().toISOString(),
    note: 'Para soporte técnico, revisar logs del servidor o contactar al administrador'
  });
});

// ==============================================
// RUTAS DE MONITOREO Y MÉTRICAS DEL SISTEMA
// ==============================================
router.get('/monitor/performance', async (req, res) => {
  console.log('📈 SOLICITUD DE MÉTRICAS DE PERFORMANCE DEL SISTEMA');
  console.log('Timestamp:', new Date().toISOString());
  
  return await DashboardController.getSystemPerformance(req, res);
});

router.get('/monitor/database', async (req, res) => {
  console.log('🗄️ SOLICITUD DE ESTADO DE LA BASE DE DATOS');
  console.log('Timestamp:', new Date().toISOString());
  
  return await DashboardController.getDatabaseStatus(req, res);
});


// ==============================================
// RUTA DE REINICIO DE CACHE
// ==============================================
router.post('/cache/clear', async (req, res) => {
  console.log('🧹 SOLICITUD DE LIMPIEZA DE CACHE DEL DASHBOARD');
  console.log('Timestamp:', new Date().toISOString());
  
  return await DashboardController.clearCache(req, res);
});

module.exports = router;