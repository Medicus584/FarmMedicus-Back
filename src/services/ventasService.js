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

      // Filtro por médico
      if (filtros.medico && filtros.medico !== "Todos") {
        paramCount++;
        whereConditions.push(`m.nombre_doctor = $${paramCount}`);
        queryParams.push(filtros.medico);
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

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
          u.usuario as usuario_usuario,
          m.iddoctor,
          m.nombre_doctor AS medico
        FROM ventas v
        INNER JOIN usuarios u ON v.idusuario = u.idusuario
        LEFT JOIN detalle_ventas dv_medico
          ON dv_medico.idventa = v.idventa
        LEFT JOIN doctores m
          ON dv_medico.iddoctor = m.iddoctor
        ${whereClause}
        GROUP BY
          v.idventa,
          v.fecha_hora,
          v.idusuario,
          v.descripcion,
          v.sub_total,
          v.descuento,
          v.descripcion_descuento,
          v.total,
          v.metodo_pago,
          u.nombres,
          u.apellidos,
          u.usuario,
          m.iddoctor,
          m.nombre_doctor
        ORDER BY v.fecha_hora DESC
      `;

      const ventasResult = await query(ventasQuery, queryParams);
      const ventas = ventasResult.rows;

      // Obtener detalles
      for (const venta of ventas) {
        const detallesQuery = `
          SELECT 
            dv.iddetalle_venta,
            dv.idproducto,
            dv.iddoctor,
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

      // Filtro por médico
      if (filtros.medico && filtros.medico !== "Todos") {
        paramCount++;
        whereConditions.push(`
          EXISTS (
            SELECT 1
            FROM detalle_ventas dv
            INNER JOIN doctores m
              ON dv.iddoctor = m.iddoctor
            WHERE dv.idventa = v.idventa
              AND m.nombre_doctor = $${paramCount}
          )
        `);

        queryParams.push(filtros.medico);
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      const totalesQuery = `
        SELECT 
          COALESCE(SUM(v.total), 0) as total_general,

          COALESCE(
            SUM(
              CASE 
                WHEN v.metodo_pago = 'Efectivo' 
                THEN v.total 
                ELSE 0 
              END
            ),
            0
          ) AS total_efectivo,

          COALESCE(
            SUM(
              CASE 
                WHEN v.metodo_pago = 'QR' 
                THEN v.total 
                ELSE 0 
              END
            ),
            0
          ) AS total_qr

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