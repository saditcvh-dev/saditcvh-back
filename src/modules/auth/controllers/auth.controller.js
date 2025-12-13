const authService = require("../services/auth.service");
const { badRequest } = require("../../../utils/errorResponse");
const { User, Role } = require("../../../database/associations")
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const jwtConfig = require("../../../config/jwt");

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
        res.cookie("accessToken", accessToken, {
            ...COOKIE_OPTIONS,
            maxAge: 1000 * 60 * 15, // 15 minutos en milisegundos
        });

        // --- 2. Guardar Refresh Token en Cookie (Larga duración) ---
        res.cookie("refreshToken", refreshToken, {
            ...COOKIE_OPTIONS,
            maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días en milisegundos
        });

        res.json({
            success: true,
            message: "Login exitoso",
            user: user,
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
/**
 * Verifica si el accessToken en cookie es válido → usado al recargar la página
 */
exports.checkStatus = async (req, res, next) => {
    try {
        const token = req.cookies.accessToken;

        if (!token) {
            return res.status(200).json({ authenticated: false });
        }

        // Verificar y decodificar el token
        const payload = jwtConfig.verify(token);

        const user = await User.findByPk(payload.id, {
            include: [{ model: Role }],
        });

        if (!user || user.active === false) {
            console.log("Usuario no válido o desactivado");
            res.clearCookie("accessToken", COOKIE_OPTIONS);
            res.clearCookie("refreshToken", COOKIE_OPTIONS);
            return res.status(200).json({ authenticated: false });
        }

        const roles = user.Roles.map(r => r.name);

        const userData = {
            id: user.id,
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            roles,
        };

        return res.json({
            authenticated: true,
            user: userData,
        });
    } catch (err) {
        res.clearCookie("accessToken", COOKIE_OPTIONS);
        return res.status(200).json({ authenticated: false });
    }
};

/**
 * Refresca el accessToken usando el refreshToken
 */
exports.refreshToken = async (req, res, next) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            throw unauthorized("No hay token de refresco");
        }

        // Verificar refresh token
        const payload = jwtConfig.verify(refreshToken);

        // Buscar usuario actualizado
        const user = await User.findByPk(payload.id, {
            include: [{ model: Role }],
        });

        if (!user || user.active === false) {
            res.clearCookie("accessToken", COOKIE_OPTIONS);
            res.clearCookie("refreshToken", COOKIE_OPTIONS);
            throw unauthorized("Usuario no válido");
        }

        const roles = user.Roles.map(r => r.name);

        const newPayload = {
            id: user.id,
            username: user.username,
            roles,
        };

        const newAccessToken = jwtConfig.sign(newPayload, ACCESS_TOKEN_EXPIRATION);

        // Renovar accessToken (opcional: rotar refresh token si quieres máxima seguridad)
        res.cookie("accessToken", newAccessToken, {
            ...COOKIE_OPTIONS,
            maxAge: 1000 * 60 * 15, // 15 minutos
        });

        const userData = {
            id: user.id,
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            roles,
        };

        return res.json({
            success: true,
            user: userData,
        });
    } catch (err) {
        res.clearCookie("accessToken", COOKIE_OPTIONS);
        res.clearCookie("refreshToken", COOKIE_OPTIONS);
        next(err);
    }
};