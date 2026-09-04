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

      if (filtros.fechaEspecifica) {
        paramCount++;
        whereConditions.push(`DATE(v.fecha_hora AT TIME ZONE 'America/La_Paz') = $${paramCount}`);
        queryParams.push(filtros.fechaEspecifica);
      }

      if (filtros.fechaInicio && filtros.fechaFin) {
        paramCount++;
        whereConditions.push(`DATE(v.fecha_hora AT TIME ZONE 'America/La_Paz') >= $${paramCount}`);
        queryParams.push(filtros.fechaInicio);
        
        paramCount++;
        whereConditions.push(`DATE(v.fecha_hora AT TIME ZONE 'America/La_Paz') <= $${paramCount}`);
        queryParams.push(filtros.fechaFin);
      }

      if (!filtros.fechaEspecifica && !filtros.fechaInicio) {
        whereConditions.push(`DATE(v.fecha_hora AT TIME ZONE 'America/La_Paz') = CURRENT_DATE`);
      }

      if (filtros.medico && filtros.medico !== "Todos") {
        paramCount++;
        whereConditions.push(`m.nombre_doctor = $${paramCount}`);
        queryParams.push(filtros.medico);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

      // CORREGIDO: Convertir fecha_hora a zona horaria Bolivia al leer
      const ventasQuery = `
        SELECT 
          v.idventa,
          (v.fecha_hora AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz') as fecha_hora,
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
        LEFT JOIN detalle_ventas dv_medico ON dv_medico.idventa = v.idventa
        LEFT JOIN doctores m ON dv_medico.iddoctor = m.iddoctor
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

      if (filtros.fechaEspecifica) {
        paramCount++;
        whereConditions.push(`DATE(v.fecha_hora AT TIME ZONE 'America/La_Paz') = $${paramCount}`);
        queryParams.push(filtros.fechaEspecifica);
      }

      if (filtros.fechaInicio && filtros.fechaFin) {
        paramCount++;
        whereConditions.push(`DATE(v.fecha_hora AT TIME ZONE 'America/La_Paz') >= $${paramCount}`);
        queryParams.push(filtros.fechaInicio);
        
        paramCount++;
        whereConditions.push(`DATE(v.fecha_hora AT TIME ZONE 'America/La_Paz') <= $${paramCount}`);
        queryParams.push(filtros.fechaFin);
      }

      if (!filtros.fechaEspecifica && !filtros.fechaInicio) {
        whereConditions.push(`DATE(v.fecha_hora AT TIME ZONE 'America/La_Paz') = CURRENT_DATE`);
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
      // CORREGIDO: Convertir fecha_hora a zona horaria Bolivia al leer
      const ventasQuery = `
        SELECT 
          v.idventa,
          (v.fecha_hora AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz') as fecha_hora,
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

      // Filtro por empleado
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

      // Si no hay filtro de fecha, usar fecha actual
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
            INNER JOIN doctores m ON dv.iddoctor = m.iddoctor
            WHERE dv.idventa = v.idventa AND m.nombre_doctor = $${paramCount}
          )
        `);
        queryParams.push(filtros.medico);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

      // Query para calcular inversión y ganancia
      const querySQL = `
        SELECT 
          COALESCE(SUM(dv.cantidad * p.precio_compra), 0) AS total_invertido,
          COALESCE(SUM(dv.cantidad * p.precio_venta), 0) AS total_ganado
        FROM detalle_ventas dv
        INNER JOIN ventas v ON dv.idventa = v.idventa
        INNER JOIN usuarios u ON v.idusuario = u.idusuario
        INNER JOIN productos p ON dv.idproducto = p.idproducto
        ${whereClause}
      `;

      const result = await query(querySQL, queryParams);
      return result.rows[0];
    } catch (error) {
      throw new Error("Error al obtener totales de inversión y ganancia: " + error.message);
    }
  },

  // ============================================
  // DELETE - ANULAR VENTA (CON EGRESO DE CAJA CORRECTO)
  // ============================================
  anularVenta: async (idVenta, usuarioId, username) => {
    console.log("🔍 anularVenta service - id:", idVenta, "usuarioId:", usuarioId);

    const idNum = parseInt(idVenta);
    if (isNaN(idNum)) {
      throw new Error("ID de venta inválido");
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // ============================================
      // 1. VERIFICAR QUE LA VENTA EXISTA
      // ============================================
      const ventaResult = await client.query(
        `
        SELECT 
          v.idventa,
          v.idusuario,
          v.metodo_pago,
          v.total,
          v.sub_total,
          v.descuento,
          v.fecha_hora,
          v.descripcion
        FROM ventas v
        WHERE v.idventa = $1
        `,
        [idNum]
      );

      if (ventaResult.rows.length === 0) {
        throw new Error("Venta no encontrada");
      }

      const venta = ventaResult.rows[0];
      const montoTotal = parseFloat(venta.total || 0);
      const esEfectivo = venta.metodo_pago === 'Efectivo';

      console.log(`💰 Venta ${idNum} - Método: ${venta.metodo_pago}, Total: ${montoTotal} Bs`);

      // ============================================
      // 2. OBTENER DETALLES DE LA VENTA (CON LOTE ORIGINAL)
      // ============================================
      const detallesResult = await client.query(
        `
        SELECT 
          dv.iddetalle_venta,
          dv.idproducto,
          dv.idlote,
          dv.cantidad,
          p.nombre as nombre_producto
        FROM detalle_ventas dv
        INNER JOIN productos p ON dv.idproducto = p.idproducto
        WHERE dv.idventa = $1
        `,
        [idNum]
      );

      const detalles = detallesResult.rows;
      console.log(`📦 ${detalles.length} productos a devolver al stock`);

      // ============================================
      // 3. REPONER STOCK AL LOTE ORIGINAL
      // ============================================
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

            console.log(`✅ Producto ${detalle.nombre_producto}: +${detalle.cantidad} unidades (lote ${detalle.idlote})`);
          }
        } else {
          console.warn(`⚠️ Producto ${detalle.nombre_producto} no tiene lote asignado`);
        }
      }

      // ============================================
      // 4. SI ES EFECTIVO: REGISTRAR EGRESO EN CAJA
      // ============================================
      if (esEfectivo) {
        // Obtener la caja principal
        const cajaResult = await client.query(
          `SELECT idcaja, total FROM caja WHERE nombre_caja = 'Caja Principal'`
        );

        if (cajaResult.rows.length === 0) {
          throw new Error("No se encontró la caja principal");
        }

        const caja = cajaResult.rows[0];
        const idCaja = caja.idcaja;
        const totalActual = parseFloat(caja.total || 0);
        
        // ✅ RESTAMOS el monto (EGRESO) - PERMITIMOS SALDO NEGATIVO
        const nuevoTotal = totalActual - montoTotal;

        console.log(`💰 Caja: total actual ${totalActual} Bs, restando ${montoTotal} Bs = ${nuevoTotal} Bs`);

        // 4a. ACTUALIZAR TOTAL DE CAJA (RESTANDO, PERMITIENDO NEGATIVOS)
        await client.query(
          `UPDATE caja SET total = $1 WHERE idcaja = $2`,
          [nuevoTotal, idCaja]
        );

        // 4b. REGISTRAR EGRESO EN TRANSACCION_CAJA (SIN idventa)
        await client.query(
          `
          INSERT INTO transaccion_caja (
            idcaja,
            idusuario,
            monto_nuevo,
            monto_anterior,
            monto,
            tipo_movimiento,
            descripcion,
            fecha
          )
          VALUES (
            $1, $2, $3, $4, $5, 'egreso', $6, TIMEZONE('America/La_Paz', NOW())
          )
          `,
          [
            idCaja,
            usuarioId,
            nuevoTotal,
            totalActual,
            montoTotal,
            `ANULACIÓN - Devolución efectivo Venta #${idNum}`
          ]
        );

        console.log(`✅ Registrado egreso de ${montoTotal} Bs por anulación`);
        
        // 4c. Desvincular transacción de ingreso de la venta (se mantiene para historial)
        await client.query(
          `UPDATE transaccion_caja SET idventa = NULL WHERE idventa = $1 AND tipo_movimiento = 'ingreso'`,
          [idNum]
        );
        console.log(`✅ Desvinculada transacción de ingreso de la venta (se mantiene para historial)`);
      }

      // ============================================
      // 5. ELIMINAR DETALLES DE LA VENTA
      // ============================================
      await client.query(
        `DELETE FROM detalle_ventas WHERE idventa = $1`,
        [idNum]
      );
      console.log(`✅ Eliminados detalles de venta`);

      // ============================================
      // 6. ELIMINAR LA VENTA
      // ============================================
      await client.query(
        `DELETE FROM ventas WHERE idventa = $1`,
        [idNum]
      );
      console.log(`✅ Venta ${idNum} eliminada`);

      await client.query('COMMIT');

      console.log(`✅ Venta #${idNum} anulada correctamente por ${username}`);
      console.log(`💰 Monto devuelto: ${montoTotal} Bs (${venta.metodo_pago})`);

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