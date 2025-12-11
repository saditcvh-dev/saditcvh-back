const User = require("../modules/users/models/user.model");
// const AuthLog = require("../modules/auth/models/authLog.model");

// // Ejemplo:
// User.hasMany(AuthLog, { foreignKey: "userId" });
// AuthLog.belongsTo(User, { foreignKey: "userId" });

module.exports = {
    User,
    // AuthLog,
};
