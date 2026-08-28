const express = require("express");
const router = express.Router();
const usersController = require("../controllers/usersController");
const { authenticate, authorize } = require("../middleware/auth");

// Rutas para usuarios (todas protegidas y requieren autenticación)
router.get("/", authenticate, usersController.getUsuarios);
router.post("/", authenticate, usersController.createUsuario);
router.put("/:id", authenticate, usersController.updateUsuario);
router.delete("/:id", authenticate, usersController.deleteUsuario);
router.patch("/:id/toggle-status", authenticate, usersController.toggleUsuarioStatus);

// NUEVA RUTA: Cambiar contraseña del usuario logueado
router.post("/change-password", authenticate, usersController.changePassword);

module.exports = router;