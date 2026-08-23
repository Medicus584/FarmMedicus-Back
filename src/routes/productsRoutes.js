// src/routes/productsRoutes.js
const express = require("express");
const router = express.Router();
const productsController = require("../controllers/productsController");
const multer = require("multer");
const path = require("path");

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Solo se permiten imágenes (jpeg, jpg, png, gif)"));
    }
  },
});

// Rutas para opciones de selección
router.get("/ubicaciones", productsController.getUbicaciones);
router.get("/categorias", productsController.getCategorias);
router.get("/formas-farmaceuticas", productsController.getFormasFarmaceuticas);

// Rutas para productos
router.get("/productos", productsController.getProductos);
router.get("/todos", productsController.getTodosProductos);
router.get("/todos-select", productsController.getTodosProductosSelect);
router.get("/buscar", productsController.buscarProductos);
router.get("/productos/codigo/:codigoP", productsController.getProductoByCodigoP);
router.get("/productos/:id", productsController.getProductoById);
router.post(
  "/productos",
  upload.single("imagen"),
  productsController.createProducto,
);
router.put(
  "/productos/:id",
  upload.single("imagen"),
  productsController.updateProducto,
);
router.delete("/productos/:id", productsController.deleteProducto);

// Rutas para gestión de stock
router.put("/productos/:id/stock", productsController.updateStockProducto);
router.post("/productos/:id/stock", productsController.addStockProducto);

// Rutas para gestión de ubicaciones
router.get("/management/ubicaciones", productsController.getUbicaciones);
router.post("/management/ubicaciones", productsController.createUbicacion);
router.put("/management/ubicaciones/:id", productsController.updateUbicacion);
router.delete("/management/ubicaciones/:id", productsController.deleteUbicacion);

// Rutas para gestión de categorías
router.get("/management/categorias", productsController.getCategorias);
router.post("/management/categorias", productsController.createCategoria);
router.put("/management/categorias/:id", productsController.updateCategoria);
router.delete("/management/categorias/:id", productsController.deleteCategoria);

// Rutas para gestión de laboratorios
router.get("/management/laboratorios", productsController.getLaboratorios);
router.post("/management/laboratorio", productsController.createLaboratorio);
router.put("/management/laboratorio/:id", productsController.updateLaboratorio);
router.delete("/management/laboratorio/:id", productsController.deleteLaboratorio);

// Rutas para gestión de formas farmacéuticas
router.get("/management/formas-farmaceuticas", productsController.getFormasFarmaceuticas);
router.post("/management/formas-farmaceuticas", productsController.createFormaFarmaceutica);
router.put("/management/formas-farmaceuticas/:id", productsController.updateFormaFarmaceutica);
router.delete("/management/formas-farmaceuticas/:id", productsController.deleteFormaFarmaceutica);

module.exports = router;