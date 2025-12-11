const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: "postgres",
    logging: false,

    pool: {
        max: 20,
        min: 0,
        idle: 30000,
        acquire: 20000,
    },

    dialectOptions: process.env.PG_SSL === "true"
        ? {
            ssl: {
                require: true,
                rejectUnauthorized: false,
            },
        }
        : {},
});

module.exports = sequelize;
