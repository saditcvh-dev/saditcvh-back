const jwt = require("jsonwebtoken");

/**
 * Middleware PROTECT
 * 1. Lee la cookie.
 * 2. Verifica que el token sea real.
 * 3. Extrae el ID del usuario y lo guarda en req.user.
 */
exports.protect = async (req, res, next) => {
    let token;

    //Buscamos el token en la COOKIE llamada "accessToken"
    if (req.cookies && req.cookies.accessToken) {
        token = req.cookies.accessToken;
    }
    //Respaldo: Buscar en Header (Bearer)
    else if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
    ) {
        token = req.headers.authorization.split(" ")[1];
    }

    // Si no hay token, rechazamos la petición
    if (!token) {
        return res.status(401).json({
            success: false,
            message: "No autorizado. Inicia sesión para continuar.",
        });
    }

    try {
        //Verificamos el token con tu CLAVE SECRETA
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; 

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Token inválido o expirado.",
        });
    }
};

/**
 * Middleware RESTRICT TO
 * solo 'administrador' puede crear usuarios
 */
exports.restrictTo = (...rolesAllowed) => {
    return (req, res, next) => {
        
        if (!req.user.role || !rolesAllowed.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "No tienes permisos para realizar esta acción.",
            });
        }
        next();
    };
};