const express = require("express");
const router = express.Router();

router.use("/auth", require("./modules/auth/routes/auth.routes"));
router.use("/users", require("./modules/users/routes/user.routes"));

module.exports = router;
