// src/services/inventoryService.js
const { query } = require("../../db");

const getInventory = async (searchTerm = null, lowMarginOnly = false, categories = [], types = []) => {
  try {
    let sqlQuery = `
      SELECT DISTINCT
        p.idproducto,
        p.nombre as nombre_producto,
        p.descripcion,
        p.precio_compra,
        p.precio_venta,
        p.stock_minimo,
        p.estado,
        COALESCE(lt.stock_total, 0) as stock,
        COALESCE(
          (SELECT MAX(fecha_hora) 
           FROM detalle_ventas dv 
           JOIN ventas ve ON dv.idventa = ve.idventa 
           WHERE dv.idproducto = p.idproducto),
          CURRENT_TIMESTAMP
        ) as ultima_edicion
      FROM productos p
      LEFT JOIN producto_categorias pc ON p.idproducto = pc.idproducto
      LEFT JOIN LATERAL (
        SELECT 
          SUM(lo.stock) as stock_total
        FROM lotes lo
        WHERE lo.idproducto = p.idproducto AND lo.estado = 0
          AND (
            lo.fecha_vencimiento >= CURRENT_DATE
            OR lo.stock > 0
            OR lo.fecha_vencimiento IS NULL
          )
      ) lt ON true
      WHERE p.estado = 0
    `;

    const params = [];
    let paramCount = 0;

    if (searchTerm) {
      paramCount++;
      // Búsqueda por nombre O descripción (ILIKE para búsqueda insensible a mayúsculas)
      sqlQuery += ` AND (p.nombre ILIKE $${paramCount} OR p.descripcion ILIKE $${paramCount})`;
      params.push(`%${searchTerm}%`);
    }

    if (lowMarginOnly) {
      sqlQuery += `
        AND p.precio_compra > 0
        AND ((p.precio_venta - p.precio_compra) * 100 / p.precio_compra) < 50
      `;
    }

    if (categories && categories.length > 0) {
      paramCount++;
      const placeholders = categories.map((_, index) => `$${paramCount + index}`).join(',');
      sqlQuery += ` AND pc.idcategoria IN (${placeholders})`;
      params.push(...categories);
      paramCount += categories.length - 1;
    }

    sqlQuery += ` ORDER BY p.nombre`;

    const result = await query(sqlQuery, params);
    return result.rows;
  } catch (error) {
    console.error("Error en inventoryService.getInventory:", error);
    throw error;
  }
};

const getLowMarginCount = async () => {
  try {
    const sqlQuery = `
      SELECT COUNT(*) as count
      FROM productos p
      WHERE p.estado = 0
      AND p.precio_compra > 0
      AND ((p.precio_venta - p.precio_compra) * 100 / p.precio_compra) < 50
    `;

    const result = await query(sqlQuery);
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error("Error en inventoryService.getLowMarginCount:", error);
    throw error;
  }
};

const getCategories = async () => {
  try {
    const sqlQuery = `
      SELECT 
        idcategoria as id,
        nombre
      FROM categorias 
      WHERE estado = 0
      ORDER BY nombre
    `;

    const result = await query(sqlQuery);
    return result.rows;
  } catch (error) {
    console.error("Error en inventoryService.getCategories:", error);
    throw error;
  }
};

const getTypes = async () => {
  try {
    const sqlQuery = `
      SELECT 
        idtipo as id,
        nombre
      FROM tipos 
      WHERE estado = 0
      ORDER BY nombre
    `;

    const result = await query(sqlQuery);
    return result.rows;
  } catch (error) {
    console.error("Error en inventoryService.getTypes:", error);
    throw error;
  }
};

module.exports = {
  getInventory,
  getLowMarginCount,
  getCategories,
  getTypes
};