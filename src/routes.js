const express = require("express");
const router = express.Router();
router.use("/auth", require("./modules/auth/routes/auth.routes"));
router.use("/users", require("./modules/users/routes/user.routes"));

router.use("/autorizacion", require("./modules/explorer/routes/autorizacion.routes"));
// router.use("/municipios", require("./modules/explorer/routes/municipio.routes"));
router.use("/modalidades", require("./modules/explorer/routes/modalidad.routes"));
router.use("/tipos-autorizacion", require("./modules/explorer/routes/tipos-autorizacion.routes"));
router.use("/documentos", require("./modules/explorer/routes/documento.routes"));
module.exports = router;
