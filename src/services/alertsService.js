const { query } = require("../../db");

const getLowStockAlerts = async () => {
  try {
    const sql = `
      SELECT 
        p.idproducto,
        p.nombre,
        p.descripcion,
        u.idubicacion,
        u.nombre as nombre_ubicacion,
        p.precio_venta,
        p.precio_compra,
        la.nombre_laboratorio as laboratorio,
        COALESCE(lt.stock_total, 0) as stock,
        p.stock_minimo,
        p.estado,
        p.imagen as imagen_base64
      FROM productos p
      INNER JOIN ubicaciones u ON p.idubicacion = u.idubicacion
      LEFT JOIN laboratorios la ON p.idlaboratorio = la.idlaboratorio
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
      WHERE lt.stock_total <= p.stock_minimo 
        AND lt.stock_total >= 0
        AND p.estado = 0
      GROUP BY 
        p.idproducto, p.nombre, p.descripcion,
        u.idubicacion, u.nombre,
        p.precio_venta, p.precio_compra,
        p.stock_minimo, p.estado, la.nombre_laboratorio,
        lt.stock_total
      ORDER BY p.nombre, lt.stock_total ASC
    `;
    
    const result = await query(sql);
    
    // Agrupar por producto
    const productosMap = new Map();
    
    result.rows.forEach(row => {
      const productoKey = row.idproducto;
      
      if (!productosMap.has(productoKey)) {
        productosMap.set(productoKey, {
          idproducto: row.idproducto,
          nombre: row.nombre,
          descripcion: row.descripcion,
          idubicacion: row.idubicacion,
          nombre_ubicacion: row.nombre_ubicacion,
          precio_venta: row.precio_venta,
          precio_compra: row.precio_compra,
          stock: row.stock,
          stock_minimo: row.stock_minimo,
          estado: row.estado,
          imagen: row.imagen_base64 ? 
            row.imagen_base64
            : 
            ''
        });
      }
    });
    
    return Array.from(productosMap.values());
  } catch (error) {
    console.error("Error en getLowStockAlerts service:", error);
    throw error;
  }
};

const getExpirationAlerts = async () => {
  try {
    const sql = `
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
        p.imagen AS imagen
      FROM lotes l
      INNER JOIN productos p
        ON l.idproducto = p.idproducto
      LEFT JOIN ubicaciones u
        ON p.idubicacion = u.idubicacion
      LEFT JOIN laboratorios lab
        ON p.idlaboratorio = lab.idlaboratorio
      WHERE l.estado = 0
        AND p.estado = 0
        AND (
          l.stock > 0
          OR l.fecha_vencimiento >= CURRENT_DATE
        )
      ORDER BY l.fecha_vencimiento ASC, p.nombre ASC;
    `;
    const result = await query(sql)

    return result.rows;
  } catch (error) {
    console.error("Error en getExpirationAlerts service:", error);
    throw error;
  }
}

module.exports = {
  getLowStockAlerts,
  getExpirationAlerts,
};