const { DataTypes } = require("sequelize");
const sequelize = require("../../../config/db");

const ComentarioAnotacion = sequelize.define("ComentarioAnotacion", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    anotacion_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'anotacion_id',
        references: {
            model: 'anotaciones',
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
    accion: {
        type: DataTypes.ENUM('crear', 'actualizar', 'eliminar', 'vaciar', 'restaurar'),
        allowNull: false,
        field: 'accion'
    },
    datos_anteriores: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'datos_anteriores'
    },
    datos_nuevos: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'datos_nuevos'
    }
}, {
    timestamps: true,
    tableName: "comentarios_anotaciones_audit",
    underscored: true,
    updatedAt: 'updated_at',
    createdAt: 'created_at'
});

module.exports = ComentarioAnotacion;