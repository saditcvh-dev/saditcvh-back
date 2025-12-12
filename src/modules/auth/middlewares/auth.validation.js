
const { badRequest } = require("../../../utils/errorResponse");

exports.loginValidation = (req, res, next) => {
    
    const { username, password } = req.body; 

    if (!username || !password) {
        return next(badRequest("El usuario y la contraseña son requeridos."));
    }

    if (username.length < 5 || password.length < 8) {
        return next(badRequest("Credenciales no válidas."));
    }

    next();
};