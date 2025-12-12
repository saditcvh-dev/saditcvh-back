// src/modules/auth/services/auth.service.js
const User = require("../../users/models/user.model");
const bcrypt = require("bcryptjs");
const jwtConfig = require("../../../config/jwt");
const { unauthorized } = require("../../../utils/errorResponse");
const Role = require("../../roles/models/roles.model");
// const { getRolesByUserId } = require("../../roles/services/role.service"); // Esta línea no se necesita si ya incluyes los roles directamente

// Tiempos de expiración en segundos (mantener)
const ACCESS_TOKEN_EXPIRATION = process.env.ACCESS_TOKEN_EXPIRATION || "15m"; // 15 minutos
const REFRESH_TOKEN_EXPIRATION = process.env.REFRESH_TOKEN_EXPIRATION || "7d";  // 7 días

/**
 * Busca al usuario por username y verifica la contraseña.
 * Genera Access Token y Refresh Token.
 * @param {string} username // <-- CAMBIADO DE email A username
 * @param {string} password
 * @returns {object} { user, accessToken, refreshToken }
 */
exports.authenticate = async (username, password) => { // <-- CAMBIADO DE email A username
    // 1. Buscar usuario por username
    const user = await User.findOne({
        where: { username }, // <-- FILTRAR POR USERNAME
       include: [{ model: Role }],
    });

    if (!user || user.active === false) {
        throw unauthorized("Credenciales inválidas."); // Mensaje genérico por seguridad
    }

    // 2. Verificar contraseña (bcrypt)
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
        console.log(password);
        console.log(user.password);
        console.log(await bcrypt.compare(password, user.password));
        throw unauthorized("Credenciales inválidas. por contraseña"); // Mensaje genérico por seguridad
    }

    // 3. Obtener roles para el payload
    const roles = user.Roles.map(role => role.name);

    // 4. Crear Payload JWT
    const payload = {
        id: user.id,
        username: user.username, // <-- AGREGAR USERNAME AL PAYLOAD
        roles: roles,
    };

    // 5. Generar Tokens (mantener)
    const accessToken = jwtConfig.sign(payload, ACCESS_TOKEN_EXPIRATION);
    const refreshToken = jwtConfig.sign(payload, REFRESH_TOKEN_EXPIRATION);

    // Excluir la contraseña del objeto de respuesta
    const userData = {
        id: user.id,
        username: user.username, // <-- AGREGAR USERNAME A LA RESPUESTA
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email, // Dejar email por si el frontend lo necesita
        roles: roles,
    };

    return { user: userData, accessToken, refreshToken };
};