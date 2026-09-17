// src/services/ventasService.js
const { query } = require("../../db");
const { pool } = require("../../db");

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

      if (filtros.empleado && filtros.empleado !== "Todos") {
        paramCount++;
        whereConditions.push(`u.usuario = $${paramCount}`);
        queryParams.push(filtros.empleado);
      }

      if (filtros.metodo && filtros.metodo !== "Todos") {
        paramCount++;
        whereConditions.push(`v.metodo_pago = $${paramCount}`);
        queryParams.push(filtros.metodo);
      }

      // ✅ CORREGIDO: Sin AT TIME ZONE porque fecha_hora ya está en hora Bolivia
      if (filtros.fechaEspecifica) {
        paramCount++;
        whereConditions.push(`DATE(v.fecha_hora) = $${paramCount}`);
        queryParams.push(filtros.fechaEspecifica);
      }

      if (filtros.fechaInicio && filtros.fechaFin) {
        paramCount++;
        whereConditions.push(`DATE(v.fecha_hora) >= $${paramCount}`);
        queryParams.push(filtros.fechaInicio);
        
        paramCount++;
        whereConditions.push(`DATE(v.fecha_hora) <= $${paramCount}`);
        queryParams.push(filtros.fechaFin);
      }

      if (!filtros.fechaEspecifica && !filtros.fechaInicio) {
        whereConditions.push(`DATE(v.fecha_hora) = CURRENT_DATE`);
      }

      if (filtros.medico && filtros.medico !== "Todos") {
        paramCount++;
        whereConditions.push(`
          EXISTS (
            SELECT 1
            FROM detalle_ventas dv_med
            INNER JOIN doctores m ON dv_med.iddoctor = m.iddoctor
            WHERE dv_med.idventa = v.idventa AND m.nombre_doctor = $${paramCount}
          )
        `);
        queryParams.push(filtros.medico);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

      // ✅ CORREGIDO: Sin GROUP BY innecesario, usando subconsulta para el médico
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
          (
            SELECT m.nombre_doctor 
            FROM detalle_ventas dv_med
            INNER JOIN doctores m ON dv_med.iddoctor = m.iddoctor
            WHERE dv_med.idventa = v.idventa
            LIMIT 1
          ) AS medico
        FROM ventas v
        INNER JOIN usuarios u ON v.idusuario = u.idusuario
        ${whereClause}
        ORDER BY v.fecha_hora DESC, v.idventa DESC
      `;

      const ventasResult = await query(ventasQuery, queryParams);
      const ventas = ventasResult.rows;

      // Cargar detalles de cada venta
      for (const venta of ventas) {
        const detallesQuery = `
          SELECT 
            dv.iddetalle_venta,
            dv.idproducto,
            dv.idlote,
            dv.iddoctor,
            dv.cantidad,
            dv.precio_unitario,
            dv.subtotal_linea,
            p.nombre as nombre_producto,
            l.fecha_vencimiento
          FROM detalle_ventas dv
          LEFT JOIN productos p ON dv.idproducto = p.idproducto
          LEFT JOIN lotes l ON dv.idlote = l.idlote
          WHERE dv.idventa = $1
          ORDER BY dv.iddetalle_venta ASC
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

      if (filtros.empleado && filtros.empleado !== "Todos") {
        paramCount++;
        whereConditions.push(`u.usuario = $${paramCount}`);
        queryParams.push(filtros.empleado);
      }

      if (filtros.metodo && filtros.metodo !== "Todos") {
        paramCount++;
        whereConditions.push(`v.metodo_pago = $${paramCount}`);
        queryParams.push(filtros.metodo);
      }

      // ✅ CORREGIDO: Sin AT TIME ZONE
      if (filtros.fechaEspecifica) {
        paramCount++;
        whereConditions.push(`DATE(v.fecha_hora) = $${paramCount}`);
        queryParams.push(filtros.fechaEspecifica);
      }

      if (filtros.fechaInicio && filtros.fechaFin) {
        paramCount++;
        whereConditions.push(`DATE(v.fecha_hora) >= $${paramCount}`);
        queryParams.push(filtros.fechaInicio);
        
        paramCount++;
        whereConditions.push(`DATE(v.fecha_hora) <= $${paramCount}`);
        queryParams.push(filtros.fechaFin);
      }

      if (!filtros.fechaEspecifica && !filtros.fechaInicio) {
        whereConditions.push(`DATE(v.fecha_hora) = CURRENT_DATE`);
      }

      if (filtros.medico && filtros.medico !== "Todos") {
        paramCount++;
        whereConditions.push(`
          EXISTS (
            SELECT 1
            FROM detalle_ventas dv
            INNER JOIN doctores m ON dv.iddoctor = m.iddoctor
            WHERE dv.idventa = v.idventa AND m.nombre_doctor = $${paramCount}
          )
        `);
        queryParams.push(filtros.medico);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

      const totalesQuery = `
        SELECT 
          COALESCE(SUM(v.total), 0) as total_general,
          COALESCE(SUM(CASE WHEN v.metodo_pago = 'Efectivo' THEN v.total ELSE 0 END), 0) AS total_efectivo,
          COALESCE(SUM(CASE WHEN v.metodo_pago = 'QR' THEN v.total ELSE 0 END), 0) AS total_qr
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
      // ✅ CORREGIDO: Sin AT TIME ZONE
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
        WHERE DATE(v.fecha_hora) = CURRENT_DATE
          AND u.usuario = $1
        ORDER BY v.fecha_hora DESC, v.idventa DESC
      `;

      const ventasResult = await query(ventasQuery, [username]);
      const ventas = ventasResult.rows;

      for (let venta of ventas) {
        const detallesQuery = `
          SELECT 
            dv.iddetalle_venta,
            dv.idproducto,
            dv.idlote,
            dv.cantidad,
            dv.precio_unitario,
            dv.subtotal_linea,
            p.nombre as nombre_producto
          FROM detalle_ventas dv
          LEFT JOIN productos p ON dv.idproducto = p.idproducto
          WHERE dv.idventa = $1
          ORDER BY dv.iddetalle_venta ASC
        `;
        
        const detallesResult = await query(detallesQuery, [venta.idventa]);
        venta.detalle = detallesResult.rows;
      }

      return ventas;
    } catch (error) {
      throw new Error("Error al obtener ventas de hoy: " + error.message);
    }
  },

  // ============================================
  // GET - OBTENER TOTALES DE INVERSIÓN Y GANANCIA
  // ============================================
  getTotalesInversionGanancia: async (filtros = {}) => {
    try {
      let whereConditions = [];
      let queryParams = [];
      let paramCount = 0;

      if (filtros.empleado && filtros.empleado !== "Todos") {
        paramCount++;
        whereConditions.push(`v.idusuario = (SELECT idusuario FROM usuarios WHERE usuario = $${paramCount})`);
        queryParams.push(filtros.empleado);
      }

      if (filtros.metodo && filtros.metodo !== "Todos") {
        paramCount++;
        whereConditions.push(`v.metodo_pago = $${paramCount}`);
        queryParams.push(filtros.metodo);
      }

      // ✅ CORREGIDO: Sin AT TIME ZONE
      if (filtros.fechaEspecifica) {
        paramCount++;
        whereConditions.push(`DATE(v.fecha_hora) = $${paramCount}`);
        queryParams.push(filtros.fechaEspecifica);
      }

      if (filtros.fechaInicio && filtros.fechaFin) {
        paramCount++;
        whereConditions.push(`DATE(v.fecha_hora) >= $${paramCount}`);
        queryParams.push(filtros.fechaInicio);
        
        paramCount++;
        whereConditions.push(`DATE(v.fecha_hora) <= $${paramCount}`);
        queryParams.push(filtros.fechaFin);
      }

      if (!filtros.fechaEspecifica && !filtros.fechaInicio) {
        whereConditions.push(`DATE(v.fecha_hora) = CURRENT_DATE`);
      }

      if (filtros.medico && filtros.medico !== "Todos") {
        paramCount++;
        whereConditions.push(`
          EXISTS (
            SELECT 1
            FROM detalle_ventas dv_med
            INNER JOIN doctores m ON dv_med.iddoctor = m.iddoctor
            WHERE dv_med.idventa = v.idventa AND m.nombre_doctor = $${paramCount}
          )
        `);
        queryParams.push(filtros.medico);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

      const querySQL = `
        WITH ventas_filtradas AS (
          SELECT DISTINCT v.idventa, v.total
          FROM ventas v
          ${whereClause}
        ),
        inversion AS (
          SELECT 
            dv.idventa,
            SUM(dv.cantidad * p.precio_compra) AS inversion_por_venta
          FROM detalle_ventas dv
          INNER JOIN productos p ON dv.idproducto = p.idproducto
          WHERE dv.idventa IN (SELECT idventa FROM ventas_filtradas)
          GROUP BY dv.idventa
        )
        SELECT 
          COALESCE(SUM(i.inversion_por_venta), 0) AS total_invertido,
          COALESCE(SUM(vf.total), 0) AS total_general
        FROM ventas_filtradas vf
        LEFT JOIN inversion i ON vf.idventa = i.idventa
      `;

      const result = await query(querySQL, queryParams);
      
      const totalInvertido = parseFloat(result.rows[0].total_invertido || 0);
      const totalGeneral = parseFloat(result.rows[0].total_general || 0);
      const gananciaReal = totalGeneral - totalInvertido;

      return {
        total_invertido: totalInvertido,
        total_ganado: gananciaReal
      };
    } catch (error) {
      console.error("Error en getTotalesInversionGanancia:", error);
      throw new Error("Error al obtener totales de inversión y ganancia: " + error.message);
    }
  },

  // ============================================
  // DELETE - ANULAR VENTA
  // ============================================
  anularVenta: async (idVenta, usuarioId, username) => {
    const idNum = parseInt(idVenta);
    if (isNaN(idNum)) {
      throw new Error("ID de venta inválido");
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const ventaResult = await client.query(
        `SELECT v.idventa, v.idusuario, v.metodo_pago, v.total, v.sub_total,
                v.descuento, v.fecha_hora, v.descripcion
         FROM ventas v WHERE v.idventa = $1`,
        [idNum]
      );

      if (ventaResult.rows.length === 0) {
        throw new Error("Venta no encontrada");
      }

      const venta = ventaResult.rows[0];
      const montoTotal = parseFloat(venta.total || 0);
      const esEfectivo = venta.metodo_pago === 'Efectivo';

      const detallesResult = await client.query(
        `SELECT dv.iddetalle_venta, dv.idproducto, dv.idlote, dv.cantidad,
                p.nombre as nombre_producto
         FROM detalle_ventas dv
         INNER JOIN productos p ON dv.idproducto = p.idproducto
         WHERE dv.idventa = $1`,
        [idNum]
      );

      const detalles = detallesResult.rows;

      for (const detalle of detalles) {
        if (detalle.idlote) {
          const loteResult = await client.query(
            `SELECT stock FROM lotes WHERE idlote = $1`,
            [detalle.idlote]
          );

          if (loteResult.rows.length > 0) {
            const stockActual = loteResult.rows[0].stock || 0;
            const nuevoStock = stockActual + detalle.cantidad;

            await client.query(
              `UPDATE lotes SET stock = $1 WHERE idlote = $2`,
              [nuevoStock, detalle.idlote]
            );
          }
        }
      }

      if (esEfectivo) {
        const cajaResult = await client.query(
          `SELECT idcaja, total FROM caja WHERE nombre_caja = 'Caja Principal'`
        );

        if (cajaResult.rows.length === 0) {
          throw new Error("No se encontró la caja principal");
        }

        const caja = cajaResult.rows[0];
        const idCaja = caja.idcaja;
        const totalActual = parseFloat(caja.total || 0);
        const nuevoTotal = totalActual - montoTotal;

        await client.query(
          `UPDATE caja SET total = $1 WHERE idcaja = $2`,
          [nuevoTotal, idCaja]
        );

        await client.query(
          `INSERT INTO transaccion_caja (
            idcaja, idusuario, monto_nuevo, monto_anterior, monto,
            tipo_movimiento, descripcion, fecha
          ) VALUES ($1, $2, $3, $4, $5, 'egreso', $6, TIMEZONE('America/La_Paz', NOW()))`,
          [idCaja, usuarioId, nuevoTotal, totalActual, montoTotal,
           `ANULACIÓN - Devolución efectivo Venta #${idNum}`]
        );

        await client.query(
          `UPDATE transaccion_caja SET idventa = NULL WHERE idventa = $1 AND tipo_movimiento = 'ingreso'`,
          [idNum]
        );
      }

      await client.query(`DELETE FROM detalle_ventas WHERE idventa = $1`, [idNum]);
      await client.query(`DELETE FROM ventas WHERE idventa = $1`, [idNum]);

      await client.query('COMMIT');

      return {
        success: true,
        message: `Venta #${idNum} anulada correctamente`,
        ventaId: idNum,
        montoDevuelto: montoTotal,
        metodoPago: venta.metodo_pago,
        productosDevueltos: detalles.length
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error("❌ Error en anularVenta service:", error);
      throw new Error(error.message || "Error al anular la venta");
    } finally {
      client.release();
    }
  }
};

module.exports = ventasService;