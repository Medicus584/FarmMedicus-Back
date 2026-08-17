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
  }
};

module.exports = ventasController;