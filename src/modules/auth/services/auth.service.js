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
// src/modules/auth/services/auth.service.js
exports.authenticate = async (username, password) => {
    const user = await User.findOne({
        where: { username },
        include: [{ model: Role, as: 'roles' }],
    });

    if (!user || user.active === false) {
        throw unauthorized("Credenciales inválidas.");
    }

    // bcrypt.compare ya es timing-safe
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
        throw unauthorized("Credenciales inválidas.");
    }

    const roles = user.roles.map(role => role.name);

    const payload = {
        id: user.id,
        username: user.username,
        roles,
    };

    const accessToken = jwtConfig.sign(payload, ACCESS_TOKEN_EXPIRATION);
    const refreshToken = jwtConfig.sign(payload, REFRESH_TOKEN_EXPIRATION);

    const userData = {
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        roles,
    };

    return { user: userData, accessToken, refreshToken };
};