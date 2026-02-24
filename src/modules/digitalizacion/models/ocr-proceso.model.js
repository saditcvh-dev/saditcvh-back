
const { DataTypes } = require("sequelize");
const sequelize = require("../../../config/db");
const { handleModelAudit } = require("../../audit/utils/auditHelper");

const OCRProceso = sequelize.define("OCRProceso", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    lote_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    archivo_id: {
        type: DataTypes.STRING,
        allowNull: false // ID del archivo en Python
    },
    nombre_archivo: {
        type: DataTypes.STRING,
        allowNull: false
    },
    autorizacion_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    documento_id: {
        type: DataTypes.INTEGER,
        allowNull: true // Se completará después
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    estado: {
        type: DataTypes.ENUM("pendiente", "procesando", "completado", "fallado"),
        defaultValue: "pendiente"
    },
    intentos: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    max_intentos: {
        type: DataTypes.INTEGER,
        defaultValue: 3
    },
    error: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true
    },
    fecha_procesado: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: "ocr_procesos",
    schema: "public",
    timestamps: true,
    paranoid: true,
    underscored: true,
    hooks: {
        afterCreate: (instance, options) =>
            handleModelAudit(instance, options, "CREATE"),
        afterUpdate: (instance, options) =>
            handleModelAudit(instance, options, "UPDATE"),
        afterDestroy: (instance, options) =>
            handleModelAudit(instance, options, "DELETE")
    }
});

module.exports = OCRProceso;