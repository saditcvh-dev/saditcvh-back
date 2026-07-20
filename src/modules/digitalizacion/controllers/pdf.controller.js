const ArchivoDigital = require("../../explorer/models/archivo-digital.model");

const getList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        const { count, rows: archivos } = await ArchivoDigital.findAndCountAll({
            offset,
            limit,
            order: [["fecha_digitalizacion", "DESC"]],
        });

        // Contadores agrupados
        const total = count;
        
        // Podemos hacer count individual o usar group by
        const completed = await ArchivoDigital.count({ where: { estado_ocr: "completado" } });
        const processing = await ArchivoDigital.count({ where: { estado_ocr: "procesando" } });
        const pending = await ArchivoDigital.count({ where: { estado_ocr: "pendiente" } });
        const failed = await ArchivoDigital.count({ where: { estado_ocr: "fallido" } });

        const mappedPdfs = archivos.map(archivo => ({
            id: archivo.id,
            filename: archivo.nombre_archivo,
            pages: archivo.total_paginas || 1,
            size: archivo.tamano_bytes,
            size_bytes: archivo.tamano_bytes,
            status: archivo.estado_ocr, // pendiente, procesando, completado, fallido
            upload_time: new Date(archivo.fecha_digitalizacion).getTime(),
            created_at: archivo.fecha_digitalizacion,
            extracted_text_path: archivo.ruta_texto,
            used_ocr: archivo.estado_ocr !== 'pendiente',
            error: null
        }));

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

module.exports = {
    getList
};
