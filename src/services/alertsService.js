// src/services/alertsService.js
const { query } = require("../../db");

const getLowStockAlerts = async (filters = {}) => {
  try {
    const { search, prioridad, page = 1, limit = 15 } = filters;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT 
        p.idproducto,
        p.nombre,
        p.descripcion,
        u.nombre as nombre_ubicacion,
        la.nombre_laboratorio as laboratorio,
        COALESCE(lt.stock_total, 0) as stock,
        p.stock_minimo,
        p.imagen
      FROM productos p
      INNER JOIN ubicaciones u ON p.idubicacion = u.idubicacion
      LEFT JOIN laboratorios la ON p.idlaboratorio = la.idlaboratorio
      LEFT JOIN LATERAL (
        SELECT SUM(lo.stock) as stock_total
        FROM lotes lo
        WHERE lo.idproducto = p.idproducto AND lo.estado = 0
          AND (lo.fecha_vencimiento >= CURRENT_DATE OR lo.stock > 0 OR lo.fecha_vencimiento IS NULL)
      ) lt ON true
      WHERE lt.stock_total <= p.stock_minimo AND lt.stock_total >= 0 AND p.estado = 0
    `;

    const params = [];
    let paramCount = 1;

    if (search) {
      sql += ` AND (p.nombre ILIKE $${paramCount} OR p.descripcion ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    if (prioridad === 'rojo') {
      sql += ` AND lt.stock_total = 0`;
    } else if (prioridad === 'amarillo') {
      sql += ` AND lt.stock_total > 0 AND lt.stock_total < p.stock_minimo`;
    } else if (prioridad === 'verde') {
      sql += ` AND lt.stock_total = p.stock_minimo`;
    }

    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as subquery`;
    const countResult = await query(countSql, params);
    const total = parseInt(countResult.rows[0].total, 10);

    sql += ` ORDER BY p.nombre, lt.stock_total ASC`;
    sql += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);
    
    const items = result.rows.map(row => ({
      idproducto: row.idproducto,
      nombre: row.nombre,
      descripcion: row.descripcion,
      nombre_ubicacion: row.nombre_ubicacion,
      laboratorio: row.laboratorio || 'Sin laboratorio',
      stock: parseInt(row.stock, 10),
      stock_minimo: parseInt(row.stock_minimo, 10),
      imagen: row.imagen ? row.imagen.toString('base64') : ''
    }));

    return {
      items,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    console.error("Error en getLowStockAlerts service:", error);
    throw error;
  }
};

const getExpirationAlerts = async (filters = {}) => {
  try {
    const { search, prioridad, page = 1, limit = 15 } = filters;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT
        ROW_NUMBER() OVER (ORDER BY l.fecha_vencimiento, p.nombre, l.idlote) AS id,
        p.idproducto,
        p.nombre AS producto,
        p.descripcion,
        u.nombre AS ubicacion,
        lab.nombre_laboratorio AS laboratorio,
        l.idlote,
        l.stock,
        TO_CHAR(l.fecha_vencimiento, 'YYYY-MM-DD') AS "fechaVencimiento",
        (l.fecha_vencimiento - CURRENT_DATE) AS "diasRestantes",
        p.imagen
      FROM lotes l
      INNER JOIN productos p ON l.idproducto = p.idproducto
      LEFT JOIN ubicaciones u ON p.idubicacion = u.idubicacion
      LEFT JOIN laboratorios lab ON p.idlaboratorio = lab.idlaboratorio
      WHERE l.estado = 0 
        AND p.estado = 0 
        AND l.stock > 0 
        AND l.fecha_vencimiento >= CURRENT_DATE
        AND (l.fecha_vencimiento - CURRENT_DATE) <= 365
    `;

    const params = [];
    let paramCount = 1;

    if (search) {
      sql += ` AND (p.nombre ILIKE $${paramCount} OR p.descripcion ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    // Rojo: 0 a 6 meses (0 a 180 días)
    // Amarillo: 7 a 9 meses (181 a 270 días)
    // Verde: 10 a 12 meses (271 a 365 días)
    if (prioridad === 'rojo') {
      sql += ` AND (l.fecha_vencimiento - CURRENT_DATE) >= 0 AND (l.fecha_vencimiento - CURRENT_DATE) <= 180`;
    } else if (prioridad === 'amarillo') {
      sql += ` AND (l.fecha_vencimiento - CURRENT_DATE) >= 181 AND (l.fecha_vencimiento - CURRENT_DATE) <= 270`;
    } else if (prioridad === 'verde') {
      sql += ` AND (l.fecha_vencimiento - CURRENT_DATE) >= 271 AND (l.fecha_vencimiento - CURRENT_DATE) <= 365`;
    }

    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as subquery`;
    const countResult = await query(countSql, params);
    const total = parseInt(countResult.rows[0].total, 10);

    sql += ` ORDER BY l.fecha_vencimiento ASC, p.nombre ASC`;
    sql += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);

    const items = result.rows.map(row => ({
      id: parseInt(row.id, 10),
      idproducto: parseInt(row.idproducto, 10),
      producto: row.producto,
      descripcion: row.descripcion,
      ubicacion: row.ubicacion || 'Sin ubicación',
      laboratorio: row.laboratorio || 'Sin laboratorio',
      idlote: parseInt(row.idlote, 10),
      stock: parseInt(row.stock, 10),
      fechaVencimiento: row.fechaVencimiento,
      diasRestantes: parseInt(row.diasRestantes, 10),
      imagen: row.imagen ? row.imagen.toString('base64') : ''
    }));

    return {
      items,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    console.error("Error en getExpirationAlerts service:", error);
    throw error;
  }
};

module.exports = {
  getLowStockAlerts,
  getExpirationAlerts,
};