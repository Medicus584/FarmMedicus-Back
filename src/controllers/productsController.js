// src/controllers/productsController.js
const productsService = require("../services/productsService");

const productsController = {
  getUbicaciones: async (req, res) => {
    try {
      const ubicaciones = await productsService.getUbicaciones();
      res.json(ubicaciones);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getCategorias: async (req, res) => {
    try {
      const categorias = await productsService.getCategorias();
      res.json(categorias);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getLaboratorios: async (req, res) => {
    try {
      const laboratorios = await productsService.getLaboratorios();
      res.json(laboratorios);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getFormasFarmaceuticas: async (req, res) => {
    try {
      const formas = await productsService.getFormasFarmaceuticas();
      res.json(formas);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getTodosProductosSelect: async (req, res) => {
    try {
      const { search } = req.query;
      const productos = await productsService.getTodosProductosSelect(search || '');
      res.json(productos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getProductoByCodigoP: async (req, res) => {
    try {
      const { codigoP } = req.params;
      
      if (!codigoP || codigoP.trim() === '') {
        return res.status(400).json({ error: "Código de producto requerido" });
      }
      
      const producto = await productsService.getProductoByCodigoP(codigoP);
      
      if (!producto) {
        return res.status(404).json({ 
          exists: false,
          message: "Producto no encontrado" 
        });
      }
      
      res.json({ 
        exists: true,
        producto 
      });
    } catch (error) {
      console.error("Error buscando producto por código:", error);
      res.status(500).json({ error: error.message });
    }
  },

  getProductos: async (req, res) => {
    try {
      const { termino } = req.query;
      let productos;

      if (termino && termino.trim().length >= 2) {
        productos = await productsService.buscarProductos(termino);
      } else {
        productos = [];
      }

      res.json(productos);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getTodosProductos: async (req, res) => {
    try {
      const { page, limit } = req.query;
      const productos = await productsService.getTodosProductos(
        parseInt(page) || 1,
        parseInt(limit) || 15
      );
      res.json(productos);
    } catch (error) {
      console.error("Error en getTodosProductos:", error);
      res.json({
        productos: [],
        total: 0,
        page: 1,
        limit: 15,
        totalPages: 0
      });
    }
  },

  buscarProductos: async (req, res) => {
    try {
      const { termino, categoria, laboratorio, page, limit } = req.query;
      
      const productos = await productsService.buscarProductos(
        termino || '',
        categoria || '',
        laboratorio || '',
        parseInt(page) || 1,
        parseInt(limit) || 20
      );
      
      res.json(productos);
    } catch (error) {
      console.error("Error en buscarProductos:", error);
      res.json({
        productos: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0
      });
    }
  },

  getProductoById: async (req, res) => {
    try {
      const { id } = req.params;
      const producto = await productsService.getProductoById(parseInt(id));
      res.json(producto);
    } catch (error) {
      console.error("Error en getProductoById:", error);
      res.status(500).json({ error: error.message });
    }
  },

  createProducto: async (req, res) => {
    try {
      const productoData = {
        codigoP: req.body.codigoP || null,
        nombre: req.body.nombre,
        descripcion: req.body.descripcion,
        idubicacion: parseInt(req.body.idubicacion),
        idlaboratorio: parseInt(req.body.idlaboratorio),
        idforma_farmaceutica: parseInt(req.body.idforma_farmaceutica),
        categorias: JSON.parse(req.body.categorias || "[]"),
        precio_compra: parseFloat(req.body.precio_compra || 0),
        precio_venta: parseFloat(req.body.precio_venta || 0),
        stock_minimo: parseInt(req.body.stock_minimo || 0),
        codigo_barras: req.body.codigo_barras || null,
        productos_similares: JSON.parse(req.body.productos_similares || "[]"),
        lotes: JSON.parse(req.body.lotes || "[]"),
      };

      let imagenFile = null;
      if (req.file) {
        imagenFile = req.file;
      } else if (req.files && req.files.imagen) {
        imagenFile = req.files.imagen;
      }

      const producto = await productsService.createProducto(
        productoData,
        imagenFile,
      );
      res.status(201).json(producto);
    } catch (error) {
      console.error("Error creating producto:", error);
      if (error.message.includes("Ya existe un producto con el código")) {
        return res.status(409).json({ 
          error: error.message,
          code: "DUPLICATE_CODE" 
        });
      }
      res.status(500).json({ error: error.message });
    }
  },

  updateProducto: async (req, res) => {
    try {
      const { id } = req.params;

      const productoData = {
        codigoP: req.body.codigoP || null,
        nombre: req.body.nombre,
        descripcion: req.body.descripcion,
        idubicacion: parseInt(req.body.idubicacion),
        idlaboratorio: parseInt(req.body.idlaboratorio),
        idforma_farmaceutica: parseInt(req.body.idforma_farmaceutica),
        categorias: JSON.parse(req.body.categorias || "[]"),
        precio_compra: parseFloat(req.body.precio_compra || 0),
        precio_venta: parseFloat(req.body.precio_venta || 0),
        stock_minimo: parseInt(req.body.stock_minimo || 0),
        codigo_barras: req.body.codigo_barras || null,
        productos_similares: JSON.parse(req.body.productos_similares || "[]"),
        lotes: JSON.parse(req.body.lotes || "[]"),
      };

      let imagenFile = null;
      if (req.file) {
        imagenFile = req.file;
      } else if (req.files && req.files.imagen) {
        imagenFile = req.files.imagen;
      }

      const producto = await productsService.updateProducto(
        parseInt(id),
        productoData,
        imagenFile,
      );
      res.json(producto);
    } catch (error) {
      console.error("Error updating producto:", error);
      if (error.message.includes("Ya existe otro producto con el código")) {
        return res.status(409).json({ 
          error: error.message,
          code: "DUPLICATE_CODE" 
        });
      }
      res.status(500).json({ error: error.message });
    }
  },

  deleteProducto: async (req, res) => {
    try {
      const { id } = req.params;
      await productsService.deleteProducto(parseInt(id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateStockProducto: async (req, res) => {
    try {
      const { id } = req.params;
      const { cantidad, idlote } = req.body;
      if (cantidad <= 0)
        return res.status(400).json({ error: "el stock no puede ser 0 o menor"});
      const producto = await productsService.updateStockProducto(
        parseInt(id),
        cantidad,
        idlote,
      );
      return res.json(producto);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  addStockProducto: async (req, res) => {
    try {
      const { id } = req.params;
      const { cantidad, fecha_vencimiento } = req.body;
      if (cantidad <= 0)
        res.status(400).json({ error: "El stock no puede ser 0 o menor"});

      const fechaVencimientoDate = new Date(fecha_vencimiento);
      const fechaActual = new Date();
      fechaActual.setHours(0, 0, 0, 0);
      fechaVencimientoDate.setHours(0, 0, 0, 0);
      
      if (fechaVencimientoDate < fechaActual) {
        return res.status(400).json({ error: "La fecha de vencimiento no puede ser anterior a la fecha actual"})
      }

      const producto = await productsService.addStockProducto(
        parseInt(id),
        cantidad,
        fecha_vencimiento,
      );
      return res.json(producto);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createUbicacion: async (req, res) => {
    try {
      const ubicacion = await productsService.createUbicacion(req.body);
      res.status(201).json(ubicacion);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateUbicacion: async (req, res) => {
    try {
      const { id } = req.params;
      const ubicacion = await productsService.updateUbicacion(parseInt(id), req.body);
      res.json(ubicacion);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  deleteUbicacion: async (req, res) => {
    try {
      const { id } = req.params;
      await productsService.deleteUbicacion(parseInt(id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createCategoria: async (req, res) => {
    try {
      const categoria = await productsService.createCategoria(req.body);
      res.status(201).json(categoria);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateCategoria: async (req, res) => {
    try {
      const { id } = req.params;
      const categoria = await productsService.updateCategoria(parseInt(id), req.body);
      res.json(categoria);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  deleteCategoria: async (req, res) => {
    try {
      const { id } = req.params;
      await productsService.deleteCategoria(parseInt(id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createLaboratorio: async (req, res) => {
    try {
      const laboratorio = await productsService.createLaboratorio(req.body);
      res.status(201).json(laboratorio);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateLaboratorio: async (req, res) => {
    try {
      const { id } = req.params;
      const laboratorio = await productsService.updateLaboratorio(parseInt(id), req.body);
      res.json(laboratorio);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  deleteLaboratorio: async (req, res) => {
    try {
      const { id } = req.params;
      await productsService.deleteLaboratorio(parseInt(id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createFormaFarmaceutica: async (req, res) => {
    try {
      const forma = await productsService.createFormaFarmaceutica(req.body);
      res.status(201).json(forma);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateFormaFarmaceutica: async (req, res) => {
    try {
      const { id } = req.params;
      const forma = await productsService.updateFormaFarmaceutica(parseInt(id), req.body);
      res.json(forma);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  deleteFormaFarmaceutica: async (req, res) => {
    try {
      const { id } = req.params;
      await productsService.deleteFormaFarmaceutica(parseInt(id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = productsController;