// 404 - Ruta no encontrada
const notFoundHandler = (req, res, next) => {
    res.status(404).json({
        success: false,
        message: "Ruta no encontrada",
        path: req.originalUrl,
    });
};

// Manejador global de errores
const errorHandler = (err, req, res, next) => {
    console.error("ERROR:", err);

    const statusCode = err.status || 500;

    res.status(statusCode).json({
        success: false,
        message: err.message || "Error interno del servidor",
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
};

module.exports = {
    notFoundHandler,
    errorHandler,
};
