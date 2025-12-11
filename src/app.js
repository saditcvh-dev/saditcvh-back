const express = require("express");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");

const config = require("./config");
const routes = require("./routes");
const { notFoundHandler, errorHandler } = require("./middlewares/errorHandlers");

const app = express();

app.disable("etag");
app.use((req, res, next) => {
    res.removeHeader("Server");
    next();
});
app.use(config.helmet);
app.use(config.rateLimiter);
app.use(config.cors);

// Logging
if (process.env.NODE_ENV !== "production") {
    app.use(morgan("dev"));
}

// Parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// CSRF 
app.use(config.csrf.doubleCsrfProtection);

// CSRF token endpoint 
app.get("/csrf-token", (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

// Rutas
app.use("/api", routes);

// 404
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

module.exports = app;
