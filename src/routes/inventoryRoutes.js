// src/routes/inventoryRoutes.js
const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventoryController");

// Rutas para el inventario
router.get("/inventory/inventory", inventoryController.getInventory);
router.get("/inventory/inventory/low-margin-count", inventoryController.getLowMarginCount);
router.get("/inventory/categories", inventoryController.getCategories);
router.get("/inventory/laboratories", inventoryController.getLaboratories);

module.exports = router;