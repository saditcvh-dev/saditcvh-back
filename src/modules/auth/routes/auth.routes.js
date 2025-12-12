const express = require("express");
const controller = require("../controllers/auth.controller");
const { loginValidation } = require("../middlewares/auth.validation");

const router = express.Router();

// POST /api/auth/login
router.post("/login", loginValidation, controller.login);

// POST /api/auth/logout
router.post("/logout", controller.logout);

module.exports = router;