/**
 * Lanza un error HTTP 400 (Bad Request)
 */
exports.badRequest = (message = "Solicitud inválida.") => {
    const error = new Error(message);
    error.status = 400;
    return error;
};

/**
 * Lanza un error HTTP 401 (Unauthorized)
 */
exports.unauthorized = (message = "Acceso no autorizado.") => {
    const error = new Error(message);
    error.status = 401;
    return error;
};

/**
 * Lanza un error HTTP 403 (Forbidden)
 */
exports.forbidden = (message = "No tienes permiso para acceder a este recurso.") => {
    const error = new Error(message);
    error.status = 403;
    return error;
};
