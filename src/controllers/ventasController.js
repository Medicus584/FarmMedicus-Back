// src/controllers/ventasController.js
const ventasService = require("../services/ventasService");

const ventasController = {
  getUsuariosVentas: async (req, res) => {
    try {
      const usuarios = await ventasService.getUsuariosVentas();
      res.json(usuarios);
    } catch (error) {
      console.error("Error en getUsuariosVentas:", error);
      res.status(500).json({ error: error.message });
    }
  },

  getVentas: async (req, res) => {
    try {
      const { empleado, metodo, fechaEspecifica, fechaInicio, fechaFin, medico } = req.query;
      
      const ventas = await ventasService.getVentas({
        empleado,
        metodo,
        fechaEspecifica,
        fechaInicio,
        fechaFin,
        medico,
      });
      
      res.json(ventas);
    } catch (error) {
      console.error("Error en getVentas:", error);
      res.status(500).json({ error: error.message });
    }
  },

  getTotalesVentas: async (req, res) => {
    try {
      const { empleado, metodo, fechaEspecifica, fechaInicio, fechaFin, medico } = req.query;
      
      const totales = await ventasService.getTotalesVentas({
        empleado,
        metodo,
        fechaEspecifica,
        fechaInicio,
        fechaFin,
        medico,
      });
      
      res.json(totales);
    } catch (error) {
      console.error("Error en getTotalesVentas:", error);
      res.status(500).json({ error: error.message });
    }
  },

  getVentasHoyAsistente: async (req, res) => {
    try {
      const { username } = req.params;
      const ventas = await ventasService.getVentasHoyAsistente(username);
      res.json(ventas);
    } catch (error) {
      console.error("Error en getVentasHoyAsistente:", error);
      res.status(500).json({ error: error.message });
    }
  },

  getTotalesInversionGanancia: async (req, res) => {
    try {
      const { empleado, metodo, fechaEspecifica, fechaInicio, fechaFin, medico } = req.query;
      
      const totales = await ventasService.getTotalesInversionGanancia({
        empleado,
        metodo,
        fechaEspecifica,
        fechaInicio,
        fechaFin,
        medico,
      });
      
      res.json(totales);
    } catch (error) {
      console.error("Error en getTotalesInversionGanancia:", error);
      res.status(500).json({ error: error.message });
    }
  },

  anularVenta: async (req, res) => {
    try {
      const { id } = req.params;
      const usuarioId = req.user?.idusuario || 1;
      const username = req.user?.usuario || "Sistema";

      if (!id || isNaN(Number(id))) {
        return res.status(400).json({
          success: false,
          message: "ID de venta inválido"
        });
      }

      const result = await ventasService.anularVenta(id, usuarioId, username);

      res.json({
        success: true,
        message: "Venta anulada correctamente",
        data: result
      });
    } catch (error) {
      console.error("Error en anularVenta controller:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error al anular la venta"
      });
    }
  }
};

module.exports = ventasController;