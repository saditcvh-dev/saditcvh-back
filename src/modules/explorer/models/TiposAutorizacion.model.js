const { DataTypes } = require("sequelize");
const sequelize = require("../../../config/db");

const TiposAutorizacion = sequelize.define("TiposAutorizacion", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: false, 
    },
    nombre: {
        type: DataTypes.STRING(150),
        allowNull: false,
    },
    abreviatura: {
        type: DataTypes.CHAR(1),
        allowNull: false,
        unique: true,
    },
}, {
    timestamps: false,
    paranoid: false,
    tableName: "tipos_autorizacion",
    underscored: true,
});

module.exports = TiposAutorizacion;