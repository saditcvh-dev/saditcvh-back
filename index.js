"use strict";

require("dotenv").config();
const app = require("./src/app");
const sequelize = require("./src/config/db");
require("./src/database/associations");
const PORT = process.env.PORT || 4000;

let server;

async function start() {
    try {
        await sequelize.authenticate();
        console.log("PostgreSQL conectado");

        server = app.listen(PORT, () => {
            console.log(`Servidor escuchando en puerto ${PORT}`);
        });

        // graceful shutdown
        const shutdown = async () => {
            console.log("Cerrando servidor...");
            server.close(async () => {
                try {
                    await sequelize.close();
                    console.log("Conexión DB cerrada");
                    process.exit(0);
                } catch (err) {
                    console.error("Error cerrando DB:", err);
                    process.exit(1);
                }
            });
        };

        process.on("SIGINT", shutdown);
        process.on("SIGTERM", shutdown);

    } catch (error) {
        console.error("Error al iniciar:", error);
        process.exit(1);
    }
}

start();
