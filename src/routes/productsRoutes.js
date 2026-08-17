// src/routes/productsRoutes.js
const express = require("express");
const router = express.Router();
const productsController = require("../controllers/productsController");
const multer = require("multer");
const path = require("path");

// Configuración de multer para manejar archivos
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB límite
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

// Rutas para productos
router.get("/productos", productsController.getProductos); // Búsqueda por query param
router.get("/todos", productsController.getTodosProductos); // Todos los productos
router.get("/todos-select", productsController.getTodosProductosSelect); // Solo id y nombre para selects
router.get("/buscar", productsController.buscarProductos); // Búsqueda específica
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

// Rutas para variantes
router.put("/productos/:id/stock", productsController.updateStockProducto);
router.post("/productos/:id/stock", productsController.addStockProducto);

module.exports = router;
