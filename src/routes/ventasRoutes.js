const express = require("express");
const router = express.Router();
const ventasController = require("../controllers/ventasController");

// Rutas para ventas
router.get("/ventas/usuarios", ventasController.getUsuariosVentas);
router.get("/ventas/ventas", ventasController.getVentas);
router.get("/ventas/totales", ventasController.getTotalesVentas);
router.get("/ventas/ventas/hoy/:username", ventasController.getVentasHoyAsistente);
router.delete("/ventas/:id/anular", ventasController.anularVenta);

module.exports = router;