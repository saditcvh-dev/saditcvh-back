const cors = require("cors");

const whitelist = [
    "http://localhost:4200",
    "http://127.0.0.1:4200",
    ...(process.env.CORS_WHITELIST ? process.env.CORS_WHITELIST.split(",") : [])
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (whitelist.includes(origin)) return callback(null, true);
        callback(new Error("No permitido por CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "x-csrf-token"],
    exposedHeaders: ["Authorization"],
};

module.exports = cors(corsOptions);
