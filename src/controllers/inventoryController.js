// src/controllers/inventoryController.js
const inventoryService = require("../services/inventoryService");

const getInventory = async (req, res) => {
  try {
    const { search, lowMarginOnly, categories } = req.query;
    
    // Convertir categorías y tipos a arrays si existen
    const categoryArray = categories ? categories.split(',') : [];
    
    const inventory = await inventoryService.getInventory(
      search, 
      lowMarginOnly === 'true',
      categoryArray
    );
    
    res.json(inventory);
  } catch (error) {
    console.error("Error en getInventory:", error);
    res.status(500).json({ 
      error: "Error al obtener el inventario",
      details: error.message 
    });
  }
};

const getLowMarginCount = async (req, res) => {
  try {
    const count = await inventoryService.getLowMarginCount();
    res.json({ count });
  } catch (error) {
    console.error("Error en getLowMarginCount:", error);
    res.status(500).json({ 
      error: "Error al obtener el conteo de márgenes bajos",
      details: error.message 
    });
  }
};

const getCategories = async (req, res) => {
  try {
    const categories = await inventoryService.getCategories();
    res.json(categories);
  } catch (error) {
    console.error("Error en getCategories:", error);
    res.status(500).json({ 
      error: "Error al obtener las categorías",
      details: error.message 
    });
  }
};

module.exports = {
  getInventory,
  getLowMarginCount,
  getCategories
};