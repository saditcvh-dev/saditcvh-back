const ArchivoDigital = require("../../explorer/models/archivo-digital.model");
const Documento = require("../../explorer/models/documento.model");
const sequelize = require("../../../config/db");
const { QueryTypes } = require("sequelize");

const getList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        // Contadores agrupados basados en documentos vigentes (número de referencia: 24,452)
        const [countsResult] = await sequelize.query(`
            SELECT 
                COUNT(ad.id) as total,
                COUNT(CASE WHEN ad.estado_ocr = 'completado' THEN 1 END) as completed,
                COUNT(CASE WHEN ad.estado_ocr = 'procesando' THEN 1 END) as processing,
                COUNT(CASE WHEN ad.estado_ocr = 'pendiente' THEN 1 END) as pending,
                COUNT(CASE WHEN ad.estado_ocr = 'fallido' THEN 1 END) as failed
            FROM archivos_digitales ad
            INNER JOIN documentos d ON ad.documento_id = d.id
            WHERE ad.deleted_at IS NULL
              AND d.deleted_at IS NULL
              AND d.version_actual = true
        `, { type: QueryTypes.SELECT });

        const total = parseInt(countsResult?.total) || 0;
        const completed = parseInt(countsResult?.completed) || 0;
        const processing = parseInt(countsResult?.processing) || 0;
        const pending = parseInt(countsResult?.pending) || 0;
        const failed = parseInt(countsResult?.failed) || 0;

        // Obtener listado de archivos correspondientes a documentos vigentes
        const archivos = await ArchivoDigital.findAll({
            offset,
            limit,
            order: [["fecha_digitalizacion", "DESC"]],
            include: [{
                model: Documento,
                as: "documento",
                required: true,
                where: {
                    version_actual: true,
                    deleted_at: null,
                },
                attributes: ["id", "version_actual"],
            }],
        });

        const mappedPdfs = archivos.map(archivo => {
            // Normalizar estado_ocr (BD guarda en español, frontend espera inglés)
            const estadoMap = {
                'completado': 'completed',
                'procesando': 'processing',
                'pendiente':  'pending',
                'fallido':    'failed'
            };
            const statusNormalizado = estadoMap[archivo.estado_ocr] || 'failed';

            return {
                id: archivo.id,
                filename: archivo.nombre_archivo,
                pages: archivo.total_paginas || 1,
                size: archivo.tamano_bytes,
                size_bytes: archivo.tamano_bytes,
                status: statusNormalizado,
                upload_time: new Date(archivo.fecha_digitalizacion).getTime(),
                created_at: archivo.fecha_digitalizacion,
                extracted_text_path: archivo.ruta_texto,
                used_ocr: archivo.estado_ocr !== 'pendiente',
                error: null
            };
        });

        res.json({
            total: total,
            page: page,
            limit: limit,
            total_pages: Math.ceil(total / limit),
            by_status: {
                completed,
                processing,
                pending,
                failed
            },
            pdfs: mappedPdfs,
            summary: {}
        });

    } catch (error) {
        console.error("Error en pdf.controller getList:", error);
        res.status(500).json({ error: "Ocurrió un error al listar los PDFs" });
    }
};

const getPdfText = async (req, res) => {
    try {
        const { id } = req.params;
        const archivo = await ArchivoDigital.findByPk(id);

        if (!archivo) {
            return res.status(404).json({ error: "Archivo no encontrado" });
        }

        const texto = archivo.texto_ocr || "";

        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${archivo.nombre_archivo || 'documento'}_ocr.txt"`);
        res.send(texto);
    } catch (error) {
        console.error("Error en pdf.controller getPdfText:", error);
        res.status(500).json({ error: "Ocurrió un error al obtener el texto del PDF" });
    }
};

module.exports = {
    getList,
    getPdfText
};
