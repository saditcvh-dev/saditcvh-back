const {
  Documento,
  ArchivoDigital,
  Autorizacion,
} = require("../../../database/associations");

/**
 * Middleware que intercepta peticiones sobre documentos o archivos
 * y determina el municipioId al que pertenecen para inyectarlo en req.municipioId
 */
const verifyDocumentMunicipality = async (req, res, next) => {
  try {
    let municipioId = null;

    // Caso 1: La ruta recibe un ID de archivo digital (por ejemplo: /archivo/:archivoId/descargar)
    if (req.params.archivoId) {
      const archivo = await ArchivoDigital.findByPk(req.params.archivoId, {
        include: [
          {
            model: Documento,
            as: "documento",
            include: [
              {
                model: Autorizacion,
                as: "autorizacion",
                attributes: ["municipioId"], // dependiendo de la estructura
              },
            ],
          },
        ],
      });

      if (!archivo || !archivo.documento || !archivo.documento.autorizacion) {
        return res.status(404).json({
          success: false,
          message: "Archivo o documento asociado no encontrado.",
        });
      }
      municipioId =
        archivo.documento.autorizacion.municipioId ||
        archivo.documento.autorizacion.municipio_id;
    }
    // Caso 2: La ruta recibe un ID de documento (por ejemplo: /:id/version)
    else if (req.params.id) {
      const documento = await Documento.findByPk(req.params.id, {
        include: [
          {
            model: Autorizacion,
            as: "autorizacion",
            attributes: ["municipioId"],
          },
        ],
      });

      if (!documento || !documento.autorizacion) {
        return res.status(404).json({
          success: false,
          message: "Documento o autorización asociada no encontrado.",
        });
      }
      municipioId =
        documento.autorizacion.municipioId ||
        documento.autorizacion.municipio_id;
    }

    // Si logramos encontrar el municipio al que pertenece el documento/archivo, lo inyectamos
    if (municipioId) {
      req.municipioId = municipioId;
    } else {
      // Si llegamos aqui y no hay municipioId podria ser un error critico de integridad en la base.
      return res.status(400).json({
        success: false,
        message:
          "No se pudo determinar el municipio territorial asociado a este registro.",
      });
    }

    next();
  } catch (error) {
    return next(error);
  }
};

module.exports = verifyDocumentMunicipality;
