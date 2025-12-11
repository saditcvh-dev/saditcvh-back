const userService = require("../services/user.service");

exports.getUsers = async (req, res, next) => {
    try {
        const users = await userService.getAllUsers();
        res.json({ success: true, data: users });
    } catch (err) {
        next(err);
    }
};
