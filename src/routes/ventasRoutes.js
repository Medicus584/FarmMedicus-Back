// routes/ventas.js
const express = require("express");
const router = express.Router();
const ventasController = require("../controllers/ventasController");

// Rutas para ventas
router.get("/ventas/usuarios", ventasController.getUsuariosVentas);
router.get("/ventas/ventas", ventasController.getVentas);
router.get("/ventas/totales", ventasController.getTotalesVentas);
router.get("/ventas/ventas/hoy/:username", ventasController.getVentasHoyAsistente);
router.delete("/ventas/:id/anular", ventasController.anularVenta);

// NUEVA RUTA - Total Inversión y Ganancia
router.get("/ventas/totales-inversion-ganancia", ventasController.getTotalesInversionGanancia);

module.exports = router;