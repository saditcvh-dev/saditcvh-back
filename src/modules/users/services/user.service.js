const sequelize = require("../../../config/db");
const { User, Role, Cargo } = require("../../../database/associations");
const bcrypt = require("bcryptjs");
const { Op, fn, col, where } = require("sequelize");


exports.getAllUsers = async (query) => {
    // --------------------
    // Paginación
    // --------------------
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const offset = (page - 1) * limit;

    // --------------------
    // Filtros
    // --------------------
    const whereUser = {};

    if (query.active !== undefined) {
        whereUser.active = query.active === "true";
    }

    if (query.cargo_id) {
        whereUser.cargo_id = query.cargo_id;
    }

    // --------------------
    // Búsqueda
    // --------------------
    if (query.search) {
        const search = `%${query.search}%`;

        whereUser[Op.or] = [
            { first_name: { [Op.iLike]: search } },
            { last_name: { [Op.iLike]: search } },
            { second_last_name: { [Op.iLike]: search } },
            { username: { [Op.iLike]: search } },
            { email: { [Op.iLike]: search } },

            // Creador
            where(fn("concat",
                col("creator.first_name"),
                " ",
                col("creator.last_name")
            ), { [Op.iLike]: search }),

            { "$creator.username$": { [Op.iLike]: search } },

            // Editor
            where(fn("concat",
                col("editor.first_name"),
                " ",
                col("editor.last_name")
            ), { [Op.iLike]: search }),

            { "$editor.username$": { [Op.iLike]: search } }
        ];
    }

    // --------------------
    // Ordenamiento
    // --------------------
    let order = [["id", "DESC"]];

    if (query.sortBy) {
        const direction = query.order === "desc" ? "DESC" : "ASC";

        switch (query.sortBy) {
            case "name":
                order = [["first_name", direction]];
                break;

            case "creator":
                order = [[{ model: User, as: "creator" }, "first_name", direction]];
                break;

            case "editor":
                order = [[{ model: User, as: "editor" }, "first_name", direction]];
                break;
        }
    }

    // --------------------
    // Query final
    // --------------------
    const result = await User.findAndCountAll({
        where: whereUser,
        distinct: true,
        subQuery: false,
        limit,
        offset,
        order,
        attributes: { exclude: ["password", "deleted_at"] },
        include: [
            {
                model: Cargo,
                as: "cargo",
                attributes: ["id", "nombre"],
                required: !!query.cargo_id
            },
            {
                model: Role,
                as: "roles",
                attributes: ["id", "name"],
                through: { attributes: [] },
                where: query.role_id ? { id: query.role_id } : undefined,
                required: !!query.role_id
            },
            {
                model: User,
                as: "creator",
                attributes: ["id", "username", "first_name", "last_name"]
            },
            {
                model: User,
                as: "editor",
                attributes: ["id", "username", "first_name", "last_name"]
            }
        ]
    });

    return {
        rows: result.rows,
        count: result.count,
        page,
        limit,
        totalPages: Math.ceil(result.count / limit)
    };
};


exports.getUserById = async (id) => {
    return await User.findByPk(id, {
        attributes: { exclude: ["password"] },
        include: [
            { model: Cargo, as: 'cargo' },
            { model: Role, as: 'roles' }
        ]
    });
};

exports.createUser = async (data, adminId) => {
    const transaction = await sequelize.transaction();
    try {
        if (data.password) {
            data.password = await bcrypt.hash(data.password, 12);
        }
        // Crear usuario con auditoría
        const newUser = await User.create({
            ...data,
            created_by: adminId,
            updated_by: adminId
        }, { transaction });

        // Asignar Roles
        if (data.roles && data.roles.length > 0) {
            await newUser.setRoles(data.roles, { transaction });
        }

        await transaction.commit();
        return await exports.getUserById(newUser.id);

    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

exports.updateUser = async (id, data, adminId) => {
    const transaction = await sequelize.transaction();
    try {
        const user = await User.findByPk(id);
        if (!user) throw new Error("Usuario no encontrado");

        if (data.password) {
            data.password = await bcrypt.hash(data.password, 12);
        }

        // Actualizar datos
        await user.update({ ...data, updated_by: adminId }, { transaction });

        // Actualizar Roles
        if (data.roles) {
            await user.setRoles(data.roles, { transaction });
        }

        await transaction.commit();
        return await exports.getUserById(id);

    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

exports.deleteUser = async (id) => {
    const user = await User.findByPk(id);
    if (!user) throw new Error("Usuario no encontrado");
    return await user.destroy();
};