const { DataTypes } = require("sequelize");
const sequelize = require("../../../config/db");

const Anotacion = sequelize.define("Anotacion", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    documento_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'documento_id',
        references: {
            model: 'documentos',
            key: 'id'
        }
    },
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'usuario_id',
        references: {
            model: 'usuarios',
            key: 'id'
        }
    },
    datos: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {
            comentarios: [],
            metadata: {}
        },
        field: 'datos'
    },
    version: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        field: 'version'
    },
    es_principal: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'es_principal'
    },
    eliminada: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'eliminada'
    },
    fecha_eliminacion: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'fecha_eliminacion'
    },
    eliminada_por: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'eliminada_por'
    }
}, {
    timestamps: true,
    paranoid: true,
    tableName: "anotaciones",
    underscored: true,
    updatedAt: 'updated_at',
    createdAt: 'created_at',
    deletedAt: 'deleted_at',
    defaultScope: {
        where: { eliminada: false }
    }
});

module.exports = Anotacion;