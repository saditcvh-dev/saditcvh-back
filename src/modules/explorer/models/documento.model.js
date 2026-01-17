const { DataTypes } = require("sequelize");
const sequelize = require("../../../config/db");
const Autorizacion = require("./autorizacion.model");

const Documento = sequelize.define("Documento", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    // autorizacion_id: {
    //     type: DataTypes.INTEGER,
    //     allowNull: true,
    //     field: 'autorizacion_id',
    //     references: {
    //         model: 'autorizaciones',
    //         key: 'id'
    //     }
    // },
    autorizacionId: {
        type: DataTypes.INTEGER,
        field: 'autorizacion_id',
        allowNull: true
    },

    // tipo_documental_id: {
    //     type: DataTypes.INTEGER,
    //     allowNull: true,
    //     field: 'tipo_documental_id'
    // },
    numero_documento: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'numero_documento'
    },
    titulo: {
        type: DataTypes.STRING(300),
        allowNull: false,
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    fecha_documento: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'fecha_documento'
    },
    fecha_recepcion: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'fecha_recepcion'
    },
    folio_inicio: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'folio_inicio'
    },
    folio_fin: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'folio_fin'
    },
    paginas: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
    },
    confidencialidad: {
        type: DataTypes.ENUM('publico', 'confidencial', 'reservado', 'secreto'),
        defaultValue: 'publico',
        field: 'confidencialidad'
    },
    metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
    },
    estado_digitalizacion: {
        type: DataTypes.ENUM('pendiente', 'en_proceso', 'digitalizado', 'revisado', 'error'),
        defaultValue: 'pendiente',
        field: 'estado_digitalizacion'
    },
    version: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        allowNull: false,
    },
    version_actual: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'version_actual'
    },
    documento_padre_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'documento_padre_id'
    },
    tipo_documento: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'tipo_documento'
    }
}, {
    timestamps: true,
    paranoid: true,
    tableName: "documentos",
    underscored: true,
    updatedAt: 'updated_at',
    createdAt: 'created_at',
    deletedAt: 'deleted_at'
});

// Relaciones
Documento.belongsTo(Autorizacion, {
    foreignKey: 'autorizacion_id',
    targetKey: 'id',
    as: 'autorizacion'
});

Documento.belongsTo(Documento, {
    foreignKey: 'documento_padre_id',
    as: 'documentoPadre',
    constraints: false
});

Documento.hasMany(Documento, {
    foreignKey: 'documento_padre_id',
    as: 'versiones',
    constraints: false
});

module.exports = Documento;