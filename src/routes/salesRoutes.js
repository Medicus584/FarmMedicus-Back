const express = require("express");
const router = express.Router();
const salesController = require("../controllers/salesController");

// Rutas de ventas
router.get("/sales/cash-status", salesController.getCashStatus);
router.post("/sales/process", salesController.processSale);

// Rutas de doctores
router.get("/sales/doctores", salesController.getDoctores);
router.post("/sales/doctor", salesController.createDoctor);
router.patch("/sales/doctor/:id", salesController.updateDoctor);
router.delete("/sales/doctor/:id", salesController.deleteDoctor);

module.exports = router;
