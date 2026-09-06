// src/controllers/alertsController.js
const alertsService = require("../services/alertsService");

const getLowStockAlerts = async (req, res) => {
  try {
    const { search, prioridad, laboratorio, page, limit } = req.query;
    
    const filters = {
      search: search || undefined,
      prioridad: prioridad || undefined,
      laboratorio: laboratorio || undefined,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 15
    };
    
    const lowStockProducts = await alertsService.getLowStockAlerts(filters);
    res.json(lowStockProducts);
  } catch (error) {
    console.error("Error en getLowStockAlerts:", error);
    res.status(500).json({ 
      error: "Error al obtener productos con stock bajo",
      details: error.message 
    });
  }
};

const getExpirationAlerts = async (req, res) => {
  try {
    const { search, prioridad, laboratorio, page, limit } = req.query;
    
    const filters = {
      search: search || undefined,
      prioridad: prioridad || undefined,
      laboratorio: laboratorio || undefined,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 15
    };
    
    const expirationProducts = await alertsService.getExpirationAlerts(filters);
    res.json(expirationProducts);
  } catch (error) {
    console.error("Error en getExpirationAlerts:", error);
    res.status(500).json({ 
      error: "Error al obtener productos con fecha de vencimiento proxima",
      details: error.message 
    });
  }
};

module.exports = {
  getLowStockAlerts,
  getExpirationAlerts,
};