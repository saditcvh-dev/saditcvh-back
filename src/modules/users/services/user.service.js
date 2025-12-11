const User = require("../models/user.model");

exports.getAllUsers = async () => {
    return await User.findAll({
        attributes: { exclude: ["password"] },
    });
};
