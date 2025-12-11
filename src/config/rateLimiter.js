const rateLimit = require("express-rate-limit");

const rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // 100 solicitudes por IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Demasiadas solicitudes, intenta más tarde",
    },
});

module.exports = rateLimiter;
