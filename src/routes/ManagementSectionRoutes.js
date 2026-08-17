const express = require("express");
const router = express.Router();
const ManagementSectionController = require("../controllers/ManagementSectionController");

// Rutas para Categorías
router.get("/management/categorias", ManagementSectionController.getCategorias);
router.post("/management/categorias", ManagementSectionController.createCategoria);
router.put("/management/categorias/:id", ManagementSectionController.updateCategoria);
router.delete("/management/categorias/:id", ManagementSectionController.deleteCategoria);

// Rutas para Ubicaciones
router.get("/management/ubicaciones", ManagementSectionController.getUbicaciones);
router.post("/management/ubicaciones", ManagementSectionController.createUbicacion);
router.put("/management/ubicaciones/:id", ManagementSectionController.updateUbicacion);
router.delete("/management/ubicaciones/:id", ManagementSectionController.deleteUbicacion);

// Rutas para Laboratorios

router.get("/management/laboratorios", ManagementSectionController.getLaboratorios);
router.post("/management/laboratorio", ManagementSectionController.createLaboratorio);
router.put("/management/laboratorio/:id", ManagementSectionController.updateLaboratorio);
router.delete("/management/laboratorio/:id", ManagementSectionController.deleteLaboratorio);

module.exports = router;