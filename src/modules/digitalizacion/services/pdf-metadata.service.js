// services/pdf-metadata.service.js
const pdfParse = require('pdf-parse');

class PdfMetadataService {

    /**
     * Obtener número real de páginas de un PDF
     */
    async contarPaginas(buffer) {
        try {
            const data = await pdfParse(buffer);

            return {
                success: true,
                paginas: data.numpages || 1
            };
        } catch (error) {
            console.error('Error contando páginas PDF:', error.message);

            return {
                success: false,
                paginas: 1, // fallback seguro
                error: error.message
            };
        }
    }
}

module.exports = new PdfMetadataService();
