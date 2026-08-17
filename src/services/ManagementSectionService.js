const { query } = require("../../db");
const bcrypt = require("bcrypt");

class ManagementSectionService {
  // Categorías
  static async getCategorias() {
    const result = await query("SELECT idcategoria as id, nombre, estado FROM categorias WHERE estado = 0 ORDER BY nombre");
    return result.rows;
  }

  static async createCategoria(nombre) {
    const result = await query(
      "INSERT INTO categorias (nombre) VALUES ($1) RETURNING idcategoria as id, nombre, estado",
      [nombre]
    );
    return result.rows[0];
  }

  static async updateCategoria(id, nombre) {
    const result = await query(
      "UPDATE categorias SET nombre = $1 WHERE idcategoria = $2 RETURNING idcategoria as id, nombre, estado",
      [nombre, id]
    );
    if (result.rows.length === 0) {
      throw new Error("Categoría no encontrada");
    }
    return result.rows[0];
  }

  static async deleteCategoria(id) {
    const result = await query(
      "UPDATE categorias SET estado = 1 WHERE idcategoria = $1 RETURNING idcategoria",
      [id]
    );
    if (result.rows.length === 0) {
      throw new Error("Categoría no encontrada");
    }
  }

  // Ubicaciones
  static async getUbicaciones() {
    const result = await query("SELECT idubicacion as id, nombre, estado FROM ubicaciones WHERE estado = 0 ORDER BY nombre");
    return result.rows;
  }

  static async createUbicacion(nombre) {
    const result = await query(
      "INSERT INTO ubicaciones (nombre) VALUES ($1) RETURNING idubicacion as id, nombre, estado",
      [nombre]
    );
    return result.rows[0];
  }

  static async updateUbicacion(id, nombre) {
    const result = await query(
      "UPDATE ubicaciones SET nombre = $1 WHERE idubicacion = $2 RETURNING idubicacion as id, nombre, estado",
      [nombre, id]
    );
    if (result.rows.length === 0) {
      throw new Error("Ubicación no encontrada");
    }
    return result.rows[0];
  }

  static async deleteUbicacion(id) {
    const result = await query(
      "UPDATE ubicaciones SET estado = 1 WHERE idubicacion = $1 RETURNING idubicacion",
      [id]
    );
    if (result.rows.length === 0) {
      throw new Error("Ubicación no encontrada");
    }
  }

  // Laboratorios
  static async getLaboratorios() {
    const result = await query("SELECT idlaboratorio, nombre_laboratorio as nombre, estado FROM laboratorios WHERE estado = 0 ORDER BY nombre_laboratorio");
    return result.rows;
  }

  static async createLaboratorio(nombre) {
    const result = await query(
      "INSERT INTO laboratorios (nombre_laboratorio) VALUES ($1) RETURNING idlaboratorio, nombre_laboratorio as nombre, estado",
      [nombre]
    );
    return result.rows[0];
  }

  static async updateLaboratorio(id, nombre) {
    const result = await query(
      "UPDATE laboratorios SET nombre_laboratorio = $1 WHERE idlaboratorio = $2 RETURNING idlaboratorio as id, nombre_laboratorio as nombre, estado",
      [nombre, id]
    );
    if (result.rows.length === 0) {
      throw new Error("Ubicación no encontrada");
    }
    return result.rows[0];
  }

  static async deleteLaboratorio(id) {
    const result = await query(
      "UPDATE laboratorios SET estado = 1 WHERE idlaboratorio = $1 RETURNING idlaboratorio",
      [id]
    );
    if (result.rows.length === 0) {
      throw new Error("Ubicación no encontrada");
    }
  }
}

module.exports = ManagementSectionService;