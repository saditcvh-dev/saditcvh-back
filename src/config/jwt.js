const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

module.exports = {
    sign(payload, expiresIn = EXPIRES_IN) {
        return jwt.sign(payload, JWT_SECRET, { expiresIn });
    },

    verify(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return null;
        }
    }
};
