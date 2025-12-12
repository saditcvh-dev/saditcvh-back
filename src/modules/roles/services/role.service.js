const User = require("../../users/models/user.model");
const Role = require("../models/roles.model");

/**
 * Obtiene los roles de un usuario
 * @param {number} userId
 */
exports.getRolesByUserId = async (userId) => {
    const user = await User.findByPk(userId, {
        include: [{ model: Role }],
    });

    if (!user) {
        return [];
    }
    return user.Roles.map(role => role.name);
};