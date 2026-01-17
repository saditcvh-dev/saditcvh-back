const express = require("express");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");

const config = require("./config");
const routes = require("./routes");
const { notFoundHandler, errorHandler } = require("./middlewares/errorHandlers");
const userRoutes = require("./modules/users/routes/user.routes");
const roleRoutes = require("./modules/roles/routes/roles.routes");
const cargoRoutes = require("./modules/cargo/routes/cargo.routes");
const reporteUsuariosRoutes = require('./modules/reports/routes/reporte-usuarios.routes');
const ejemploRoutes = require('./modules/reports/routes/ejemplo.routes');
const dashboardRoutes = require('./modules/dashboard/routes/dashboard.routes');
const DigitalizationReportService = require('./modules/reports/routes/reporte-documentos.routes');
const municipioRoutes = require("./modules/municipios/routes/municipio.routes");
const permissionRoutes = require("./modules/permissions/routes/permission.routes");
const auditRoutes = require("./modules/audit/routes/audit.routes");
const path = require("path");

const app = express();

app.disable("etag");
app.use((req, res, next) => {
    res.removeHeader("Server");
    next();
});
app.use(config.helmet);

app.use('/storage', (req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; frame-ancestors *"
  );
  next();
});

app.use('/storage', express.static(path.join(__dirname, '../storage')));

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

// ==============================================
// CSRF - CON EXCLUSIÓN PARA REPORTES
// ==============================================
app.use((req, res, next) => {
  // Excluir rutas de reportes de la validación CSRF
  if (req.path.startsWith('/api/reports') || req.path.startsWith('/api/reportes')) {
    console.log(`✅ Saltando CSRF para: ${req.path}`);
    return next();
  }
  // Para otras rutas, aplicar CSRF normalmente
  config.csrf.doubleCsrfProtection(req, res, next);
});

// CSRF token endpoint 
app.get("/api/csrf-token", (req, res) => {
    const token = req.csrfToken();
    res.json({ csrfToken: token });
});

// ==============================================
// RUTAS
// ==============================================

// Ruta de ejemplo (sin autenticación para pruebas)
app.use('/api/reports', ejemploRoutes);
app.use('/api/reports/reporte-usuarios', reporteUsuariosRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports/reporte-digitalizacion', DigitalizationReportService);

// Rutas principales
app.use("/api", routes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/cargos", cargoRoutes);
app.use("/api/municipios", municipioRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/audit", auditRoutes);

// 404
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

module.exports = app;