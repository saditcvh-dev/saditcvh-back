const authService = require("../services/auth.service");
const { badRequest } = require("../../../utils/errorResponse");

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Configuración de las cookies para los tokens de sesión
 */
const COOKIE_OPTIONS = {
    httpOnly: true,                 // No accesible mediante JS del cliente (evita XSS)
    secure: IS_PRODUCTION,          // Solo se envía en HTTPS
    sameSite: "strict",             // Protege contra CSRF
    path: "/",                      // Accesible en todas las rutas
};

/**
 * Inicia sesión del usuario
 */
exports.login = async (req, res, next) => {
    try {
        const { username, password } = req.body;

        // Autenticar y generar tokens
        const { user, accessToken, refreshToken } = await authService.authenticate(
            username,
            password
        );

        // --- 1. Guardar Access Token en Cookie (Corta duración) ---
        // Expiración: 15-30 min
        res.cookie("accessToken", accessToken, {
            ...COOKIE_OPTIONS,
            maxAge: 1000 * 60 * 15, // 15 minutos en milisegundos
        });

        // --- 2. Guardar Refresh Token en Cookie (Larga duración) ---
        // Expiración: 7-30 días
        res.cookie("refreshToken", refreshToken, {
            ...COOKIE_OPTIONS,
            maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días en milisegundos
        });

        // 3. Responder al cliente (no enviamos los tokens en el cuerpo, solo el usuario)
        res.json({
            success: true,
            message: "Login exitoso",
            user: user,
            // Opcional: para el desarrollo, puedes devolver el access token en el body.
            // developmentToken: accessToken, 
        });
    } catch (err) {
        next(err);
    }
};

exports.logout = async (req, res, next) => {
    try {
        // Borrar cookies
        res.clearCookie("accessToken", {
            httpOnly: true,
            secure: IS_PRODUCTION,
            sameSite: "strict",
            path: "/",
        });

        res.clearCookie("refreshToken", {
            httpOnly: true,
            secure: IS_PRODUCTION,
            sameSite: "strict",
            path: "/",
        });

        return res.json({
            success: true,
            message: "Sesión cerrada correctamente",
        });
    } catch (err) {
        next(err);
    }
};
