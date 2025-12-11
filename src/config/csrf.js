const { doubleCsrf } = require("csrf-csrf");

const {
    invalidCsrfTokenError,
    generateToken,
    validateRequest,
    doubleCsrfProtection,
} = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET,

    getSessionIdentifier: (req) => {
        return req.ip + req.headers["user-agent"];
    },

    cookieName: "x-csrf-token",

    cookieOptions: {
        httpOnly: false,
        sameSite: "strict",
        maxAge: 1000 * 60 * 60 * 2, // 2 horas
        secure: process.env.NODE_ENV === "production",
    },
});

module.exports = {
    invalidCsrfTokenError,
    generateToken,
    validateRequest,
    doubleCsrfProtection,
};
