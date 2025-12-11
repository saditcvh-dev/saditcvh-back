const helmet = require("helmet");

const isProduction = process.env.NODE_ENV === "production";

module.exports = helmet({
    hidePoweredBy: true,

    noSniff: true,

    frameguard: { action: "deny" },

    referrerPolicy: { policy: "no-referrer" },

    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: [
                "'self'",
                "http://localhost:3000",
                "http://localhost:4000",
                "https://*.supabase.co"
            ],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
        },
    },

    crossOriginEmbedderPolicy: false,

    crossOriginOpenerPolicy: isProduction
        ? { policy: "same-origin-allow-popups" }
        : { policy: "unsafe-none" },

    hsts: isProduction
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
        }
        : false,
});
