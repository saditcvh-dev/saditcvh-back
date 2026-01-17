const { DataTypes } = require("sequelize");
const sequelize = require("../../../config/db");

const Modalidad = sequelize.define("Modalidad", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    num: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
    },
    nombre: {
        type: DataTypes.STRING(150),
        allowNull: false,
    },
}, {
    timestamps: false,
    paranoid: false,
    tableName: "modalidad",
    underscored: true,
});

module.exports = Modalidad;