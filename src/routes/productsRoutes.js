// src/routes/productsRoutes.js
const express = require("express");
const router = express.Router();
const productsController = require("../controllers/productsController");
const multer = require("multer");
const path = require("path");

const storage = multer.memoryStorage();

// Configuración de multer con mejor manejo de errores
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    // Verificar extensión
    const allowedExtensions = /jpeg|jpg|png|gif|webp/;
    const extname = allowedExtensions.test(
      path.extname(file.originalname).toLowerCase(),
    );
    
    // Verificar mimetype
    const allowedMimetypes = /image\/(jpeg|jpg|png|gif|webp)/;
    const mimetype = allowedMimetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      // Error con mensaje detallado
      const error = new Error(
        `Solo se permiten imágenes (jpeg, jpg, png, gif, webp). Archivo recibido: ${file.originalname} (${file.mimetype})`
      );
      error.code = "INVALID_IMAGE_TYPE";
      return cb(error);
    }
  },
});

// Middleware para manejar errores de multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: `El archivo es demasiado grande. El tamaño máximo permitido es de 5MB.`,
        code: 'FILE_TOO_LARGE'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Demasiados archivos. Solo se permite una imagen.',
        code: 'TOO_MANY_FILES'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Campo de archivo inesperado. El campo debe llamarse "imagen".',
        code: 'UNEXPECTED_FILE'
      });
    }
    return res.status(400).json({
      error: `Error al subir el archivo: ${err.message}`,
      code: 'UPLOAD_ERROR'
    });
  }
  
  if (err && err.code === 'INVALID_IMAGE_TYPE') {
    return res.status(400).json({
      error: err.message,
      code: 'INVALID_IMAGE_TYPE'
    });
  }
  
  if (err && err.message && err.message.includes('Solo se permiten imágenes')) {
    return res.status(400).json({
      error: err.message,
      code: 'INVALID_IMAGE_TYPE'
    });
  }
  
  next(err);
};

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

// Rutas con upload - usando el middleware de manejo de errores
router.post(
  "/productos",
  (req, res, next) => {
    upload.single("imagen")(req, res, (err) => {
      if (err) {
        // Pasar el error al middleware de manejo de multer
        return handleMulterError(err, req, res, next);
      }
      next();
    });
  },
  productsController.createProducto
);

router.put(
  "/productos/:id",
  (req, res, next) => {
    upload.single("imagen")(req, res, (err) => {
      if (err) {
        return handleMulterError(err, req, res, next);
      }
      next();
    });
  },
  productsController.updateProducto
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