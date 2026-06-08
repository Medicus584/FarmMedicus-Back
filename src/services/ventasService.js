// src/services/ventasService.js
const { query } = require("../../db");

const ventasService = {
  getUsuariosVentas: async () => {
    try {
      const result = await query(
        `SELECT idusuario, nombres, apellidos, usuario 
         FROM usuarios 
         WHERE estado = 0 AND rol IN ('Admin', 'Asistente')
         ORDER BY nombres, apellidos`
      );
      return result.rows;
    } catch (error) {
      throw new Error("Error al obtener usuarios: " + error.message);
    }
  },

  getVentas: async (filtros = {}) => {
    try {
      let whereConditions = [];
      let queryParams = [];
      let paramCount = 0;

      // Filtro por empleado (usamos el username, no el nombre completo)
      if (filtros.empleado && filtros.empleado !== "Todos") {
        paramCount++;
        whereConditions.push(`u.usuario = $${paramCount}`);
        queryParams.push(filtros.empleado);
      }

      // Filtro por método de pago
      if (filtros.metodo && filtros.metodo !== "Todos") {
        paramCount++;
        whereConditions.push(`v.metodo_pago = $${paramCount}`);
        queryParams.push(filtros.metodo);
      }

      // Filtro por fecha específica
      if (filtros.fechaEspecifica) {
        paramCount++;
        whereConditions.push(`DATE(v.fecha_hora AT TIME ZONE 'America/La_Paz') = $${paramCount}`);
        queryParams.push(filtros.fechaEspecifica);
      }

      // Filtro por rango de fechas
      if (filtros.fechaInicio && filtros.fechaFin) {
        paramCount++;
        whereConditions.push(`DATE(v.fecha_hora AT TIME ZONE 'America/La_Paz') >= $${paramCount}`);
        queryParams.push(filtros.fechaInicio);
        
        paramCount++;
        whereConditions.push(`DATE(v.fecha_hora AT TIME ZONE 'America/La_Paz') <= $${paramCount}`);
        queryParams.push(filtros.fechaFin);
      }

      // Si no hay filtros de fecha, mostrar solo ventas de hoy por defecto
      if (!filtros.fechaEspecifica && !filtros.fechaInicio) {
        whereConditions.push(`DATE(v.fecha_hora AT TIME ZONE 'America/La_Paz') = CURRENT_DATE`);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      console.log("Query conditions:", whereConditions);
      console.log("Query params:", queryParams);

      const ventasQuery = `
        SELECT 
          v.idventa,
          v.fecha_hora,
          v.idusuario,
          v.descripcion,
          v.sub_total,
          v.descuento,
          v.descripcion_descuento,
          v.total,
          v.metodo_pago,
          u.nombres as usuario_nombre,
          u.apellidos as usuario_apellidos,
          u.usuario as usuario_usuario
        FROM ventas v
        INNER JOIN usuarios u ON v.idusuario = u.idusuario
        ${whereClause}
        ORDER BY v.fecha_hora DESC
      `;

      const ventasResult = await query(ventasQuery, queryParams);
      const ventas = ventasResult.rows;

      console.log(`Ventas encontradas: ${ventas.length}`);

      // Obtener detalles para cada venta
      for (let venta of ventas) {
        const detallesQuery = `
          SELECT 
            dv.iddetalle_venta,
            dv.idproducto,
            dv.cantidad,
            dv.precio_unitario,
            dv.subtotal_linea,
            p.nombre as nombre_producto
          FROM detalle_ventas dv
          LEFT JOIN productos p ON dv.idproducto = p.idproducto
          WHERE dv.idventa = $1
        `;
        
        const detallesResult = await query(detallesQuery, [venta.idventa]);
        venta.detalle = detallesResult.rows;
      }

      return ventas;
    } catch (error) {
      throw new Error("Error al obtener ventas: " + error.message);
    }
  },

  getTotalesVentas: async (filtros = {}) => {
    try {
      let whereConditions = [];
      let queryParams = [];
      let paramCount = 0;

      // Filtro por empleado (usamos el username, no el nombre completo)
      if (filtros.empleado && filtros.empleado !== "Todos") {
        paramCount++;
        whereConditions.push(`u.usuario = $${paramCount}`);
        queryParams.push(filtros.empleado);
      }

      // Filtro por método de pago
      if (filtros.metodo && filtros.metodo !== "Todos") {
        paramCount++;
        whereConditions.push(`v.metodo_pago = $${paramCount}`);
        queryParams.push(filtros.metodo);
      }

      // Filtro por fecha específica
      if (filtros.fechaEspecifica) {
        paramCount++;
        whereConditions.push(`DATE(v.fecha_hora AT TIME ZONE 'America/La_Paz') = $${paramCount}`);
        queryParams.push(filtros.fechaEspecifica);
      }

      // Filtro por rango de fechas
      if (filtros.fechaInicio && filtros.fechaFin) {
        paramCount++;
        whereConditions.push(`DATE(v.fecha_hora AT TIME ZONE 'America/La_Paz') >= $${paramCount}`);
        queryParams.push(filtros.fechaInicio);
        
        paramCount++;
        whereConditions.push(`DATE(v.fecha_hora AT TIME ZONE 'America/La_Paz') <= $${paramCount}`);
        queryParams.push(filtros.fechaFin);
      }

      // Si no hay filtros de fecha, mostrar solo ventas de hoy por defecto
      if (!filtros.fechaEspecifica && !filtros.fechaInicio) {
        whereConditions.push(`DATE(v.fecha_hora AT TIME ZONE 'America/La_Paz') = CURRENT_DATE`);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const totalesQuery = `
        SELECT 
          COALESCE(SUM(v.total), 0) as total_general,
          COALESCE(SUM(CASE WHEN v.metodo_pago = 'Efectivo' THEN v.total ELSE 0 END), 0) as total_efectivo,
          COALESCE(SUM(CASE WHEN v.metodo_pago = 'QR' THEN v.total ELSE 0 END), 0) as total_qr
        FROM ventas v
        INNER JOIN usuarios u ON v.idusuario = u.idusuario
        ${whereClause}
      `;

      const result = await query(totalesQuery, queryParams);
      return result.rows[0];
    } catch (error) {
      throw new Error("Error al obtener totales: " + error.message);
    }
  },

  getVentasHoyAsistente: async (username) => {
    try {
      const ventasQuery = `
        SELECT 
          v.idventa,
          v.fecha_hora,
          v.idusuario,
          v.descripcion,
          v.sub_total,
          v.descuento,
          v.total,
          v.metodo_pago,
          u.nombres as usuario_nombre,
          u.apellidos as usuario_apellidos,
          u.usuario as usuario_usuario
        FROM ventas v
        INNER JOIN usuarios u ON v.idusuario = u.idusuario
        WHERE DATE(v.fecha_hora AT TIME ZONE 'America/La_Paz') = CURRENT_DATE
          AND u.usuario = $1
        ORDER BY v.fecha_hora DESC
      `;

      const ventasResult = await query(ventasQuery, [username]);
      const ventas = ventasResult.rows;

      // Obtener detalles para cada venta
      for (let venta of ventas) {
        const detallesQuery = `
          SELECT 
            dv.iddetalle_venta,
            dv.idproducto,
            dv.cantidad,
            dv.precio_unitario,
            dv.subtotal_linea,
            p.nombre as nombre_producto
          FROM detalle_ventas dv
          LEFT JOIN productos p ON dv.idproducto = p.idproducto
          WHERE dv.idventa = $1
        `;
        
        const detallesResult = await query(detallesQuery, [venta.idventa]);
        venta.detalle = detallesResult.rows;
      }

      return ventas;
    } catch (error) {
      throw new Error("Error al obtener ventas de hoy: " + error.message);
    }
  }
};

module.exports = ventasService;