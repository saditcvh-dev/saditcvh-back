const { DataTypes } = require("sequelize");
const sequelize = require("../../../config/db");
const ArchivoDigital = require("./archivo-digital.model");
const User = require('../../users/models/user.model');

const ArchivoVisita = sequelize.define("ArchivoVisita", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    archivo_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'archivo_id',
        references: {
            model: ArchivoDigital,
            key: 'id'
        }
    },
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'usuario_id',
        references: {
            model: User,
            key: 'id'
        }
    },
    fecha_apertura: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'fecha_apertura'
    }
}, {
    timestamps: true,
    paranoid: false,
    tableName: "archivo_visitas",
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false,
    deletedAt: false
});

ArchivoVisita.belongsTo(ArchivoDigital, {
    foreignKey: 'archivo_id',
    as: 'archivo'
});

ArchivoVisita.belongsTo(User, {
    foreignKey: 'usuario_id',
    as: 'usuario'
});


ArchivoDigital.hasMany(ArchivoVisita, {
    foreignKey: 'archivo_id',
    as: 'visitas'
});

User.hasMany(ArchivoVisita, {
    foreignKey: 'usuario_id',
    as: 'visitasArchivos'
});

module.exports = ArchivoVisita;