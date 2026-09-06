// src/routes/alertsRoutes.js
const express = require("express");
const router = express.Router();
const alertsController = require("../controllers/alertsController");
const { query } = require("../../db");

// Rutas de alertas
router.get("/alerts/low-stock", alertsController.getLowStockAlerts);
router.get("/alerts/expiring-soon", alertsController.getExpirationAlerts);

// Ruta para obtener laboratorios
router.get("/laboratorios", async (req, res) => {
  try {
    const result = await query(`
      SELECT idlaboratorio, nombre_laboratorio 
      FROM laboratorios 
      WHERE estado = 0 
      ORDER BY nombre_laboratorio ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching laboratorios:", error);
    res.status(500).json({ error: "Error al obtener laboratorios" });
  }
});

module.exports = router;