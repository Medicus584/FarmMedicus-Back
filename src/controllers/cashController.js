// src/controllers/cashController.js
const cashService = require("../services/cashService");

exports.getCashStatus = async (req, res) => {
  try {
    const cashStatus = await cashService.getCashStatus();
    res.json(cashStatus);
  } catch (error) {
    console.error("Error in getCashStatus controller:", error);
    res.json({
      estado: "cerrada",
      monto_final: "0.00"
    });
  }
};

exports.getUserTransactions = async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: "ID de usuario requerido" });
    }
    
    const transactions = await cashService.getUserTransactions(parseInt(userId));
    res.json(transactions);
  } catch (error) {
    console.error("Error in getUserTransactions controller:", error);
    res.json([]);
  }
};

exports.createTransaction = async (req, res) => {
  try {
    const { tipo_movimiento, descripcion, monto, idusuario } = req.body;
    
    if (!idusuario) {
      return res.status(400).json({ error: "ID de usuario requerido" });
    }
    
    const transaction = await cashService.createTransaction({
      tipoMovimiento: tipo_movimiento,
      descripcion,
      monto: parseFloat(monto),
      userId: parseInt(idusuario)
    });
    
    res.status(201).json(transaction);
  } catch (error) {
    console.error("Error in createTransaction controller:", error);
    res.status(500).json({ 
      error: error.message || "Error al crear la transacción" 
    });
  }
};

exports.openCash = async (req, res) => {
  try {
    const { monto_inicial, idusuario } = req.body;
    
    if (!idusuario) {
      return res.status(400).json({ error: "ID de usuario requerido" });
    }
    
    await cashService.openCash({
      montoInicial: parseFloat(monto_inicial),
      userId: parseInt(idusuario)
    });
    
    res.json({ success: true, message: "Caja abierta correctamente" });
  } catch (error) {
    console.error("Error in openCash controller:", error);
    res.status(500).json({ 
      error: error.message || "Error al abrir la caja" 
    });
  }
};

exports.closeCash = async (req, res) => {
  try {
    const { idusuario } = req.body;
    
    if (!idusuario) {
      return res.status(400).json({ error: "ID de usuario requerido" });
    }
    
    await cashService.closeCash({
      userId: parseInt(idusuario)
    });
    
    res.json({ success: true, message: "Caja cerrada correctamente" });
  } catch (error) {
    console.error("Error in closeCash controller:", error);
    res.status(500).json({ 
      error: error.message || "Error al cerrar la caja" 
    });
  }
};