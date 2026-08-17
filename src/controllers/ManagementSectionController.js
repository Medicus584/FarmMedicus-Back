const ManagementSectionService = require("../services/ManagementSectionService");

class ManagementSectionController {
  // Categorías
  static async getCategorias(req, res) {
    try {
      const categorias = await ManagementSectionService.getCategorias();
      res.json(categorias);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createCategoria(req, res) {
    try {
      const { nombre } = req.body;
      const nuevaCategoria = await ManagementSectionService.createCategoria(nombre);
      res.status(201).json(nuevaCategoria);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async updateCategoria(req, res) {
    try {
      const { id } = req.params;
      const { nombre } = req.body;
      const categoriaActualizada = await ManagementSectionService.updateCategoria(parseInt(id), nombre);
      res.json(categoriaActualizada);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async deleteCategoria(req, res) {
    try {
      const { id } = req.params;
      await ManagementSectionService.deleteCategoria(parseInt(id));
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Ubicaciones
  static async getUbicaciones(req, res) {
    try {
      const ubicaciones = await ManagementSectionService.getUbicaciones();
      res.json(ubicaciones);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createUbicacion(req, res) {
    try {
      const { nombre } = req.body;
      const nuevaUbicacion = await ManagementSectionService.createUbicacion(nombre);
      res.status(201).json(nuevaUbicacion);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async updateUbicacion(req, res) {
    try {
      const { id } = req.params;
      const { nombre } = req.body;
      const ubicacionActualizada = await ManagementSectionService.updateUbicacion(parseInt(id), nombre);
      res.json(ubicacionActualizada);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async deleteUbicacion(req, res) {
    try {
      const { id } = req.params;
      await ManagementSectionService.deleteUbicacion(parseInt(id));
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Laboratorios
  static async getLaboratorios(req, res) {
    try {
      const laboratorios = await ManagementSectionService.getLaboratorios();
      res.json(laboratorios);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createLaboratorio(req, res) {
    try {
      const { nombre } = req.body;
      const laboratorio = await ManagementSectionService.createLaboratorio(nombre);
      res.status(201).json(laboratorio);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async updateLaboratorio(req, res) {
    try {
      const { id } = req.params;
      const { nombre } = req.body;
      const laboratorios = await ManagementSectionService.updateLaboratorio(parseInt(id), nombre);
      res.json(laboratorios);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async deleteLaboratorio(req, res) {
    try {
      const { id } = req.params;
      await ManagementSectionService.deleteLaboratorio(parseInt(id));
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = ManagementSectionController;