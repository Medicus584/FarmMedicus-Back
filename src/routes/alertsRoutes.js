const express = require("express");
const router = express.Router();
const alertsController = require("../controllers/alertsController");

// Rutas para alertas de stock
router.get("/alerts/low-stock", alertsController.getLowStockAlerts);
router.get("/alerts/expiring-soon", alertsController.getExpirationAlerts);

module.exports = router;