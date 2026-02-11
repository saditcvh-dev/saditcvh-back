// src/modules/backups/services/netdata.service.js
const axios = require('axios');
const NETDATA_URL = 'http://localhost:19999';

/**
 * Obtiene datos crudos de Netdata
 * @param {string} chart - ID del chart (ej: system.cpu, disk_space./data)
 * @param {number} points - Cantidad de registros a recuperar
 */
async function fetchFromNetdata(chart, points = 1) {
    try {
        const res = await axios.get(`${NETDATA_URL}/api/v1/data`, {
            params: {
                chart,
                // after: -60 garantiza un rango, points: 60 garantiza la resolución
                after: -Math.abs(points),
                points: points,
                format: 'json'
            }
        });
        return res.data; // Retorna { labels, data: [ [...] ] }
    } catch (error) {
        console.error(`Netdata Error en chart [${chart}]:`, error.message);
        return null;
    }
}

/**
 * Almacenamiento y Archivos (Baja frecuencia)
 * Consulta el espacio en disco y el uso de inodos (archivos)
 */
async function getStorageData() {
    const [diskRaw, inodesRaw] = await Promise.all([
        fetchFromNetdata('disk_space./data', 1),
        fetchFromNetdata('disk_inodes./data', 1)
    ]);

    return {
        // Datos crudos del espacio en disco
        disk: diskRaw || { labels: ['time', 'avail', 'used'], data: [[0, 0, 0]] },
        // Datos crudos de inodos (representan la cantidad de archivos/carpetas)
        inodes: inodesRaw || { labels: ['time', 'avail', 'used'], data: [[0, 0, 0]] }
    };
}

/**
 * Rendimiento de CPU y RAM (Alta frecuencia)
 * Trae los últimos 60 puntos para alimentar las gráficas de historial
 */
async function getLivePerformance() {
    const [cpuRaw, ramRaw] = await Promise.all([
        // Pedimos 60 puntos para una gráfica más detallada (1 minuto de historial)
        fetchFromNetdata('system.cpu', 60),
        fetchFromNetdata('system.ram', 60)
    ]);

    return {
        cpu: cpuRaw || { labels: ['time', 'idle'], data: [[0, 100]] },
        ram: ramRaw || { labels: ['time', 'free', 'used'], data: [[0, 0, 0]] }
    };
}

module.exports = {
    getStorageData,
    getLivePerformance
};