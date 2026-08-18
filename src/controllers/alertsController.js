const alertsService = require("../services/alertsService");

const getLowStockAlerts = async (req, res) => {
  try {
    const lowStockProducts = await alertsService.getLowStockAlerts();
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
    const expirationProducts = await alertsService.getExpirationAlerts();
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