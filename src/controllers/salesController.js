const salesService = require("../services/salesService");

const getCashStatus = async (req, res) => {
  try {
    const cashStatus = await salesService.getCurrentCashStatus();
    res.json(cashStatus);
  } catch (error) {
    console.error("Error in getCashStatus:", error);
    res.status(500).json({ error: error.message });
  }
};

const processSale = async (req, res) => {
  try {
    const saleData = req.body;

    const userId = saleData.userId || req.headers["user-id"];

    if (!userId) {
      return res.status(401).json({ error: "Se requiere ID de usuario" });
    }

    const result = await salesService.processSale(saleData, userId);
    res.json(result);
  } catch (error) {
    console.error("Error in processSale:", error);
    res.status(500).json({ error: error.message });
  }
};

const getDoctores = async (req, res) => {
  try {
    const doctores = await salesService.getDoctores();
    res.json(doctores);
  } catch (error) {
    console.error("Error obteniendo doctores:", error);
    res.status(500).json({ error: error.message });
  }
}

const createDoctor = async (req, res) => {
  try {
    const { nombre } = req.body;

    const doctor = await salesService.createDoctor(nombre);
    res.status(201).json(doctor);
  } catch (error) {
    console.error("Error creando doctor:", error);
    res.status(500).json({ error: error.message });
  }
}

const updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;

    const doctor = await salesService.updateDoctor(nombre, id);
    res.json(doctor);
  } catch (error) {
    console.error("Error actualizando doctor:", error);
    res.status(500).json({ error: error.message });
  }
}

const deleteDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await salesService.deleteDoctor(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error obteniendo doctores:", error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getCashStatus,
  processSale,
  getDoctores,
  createDoctor,
  updateDoctor,
  deleteDoctor,
};
