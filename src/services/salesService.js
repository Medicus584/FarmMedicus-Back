const { query, pool } = require("../../db");

const getCurrentCashStatus = async () => {
  const sql = `
    SELECT 
      c.idcaja,
      c.nombre_caja,
      c.total as monto_final,
      c.estado,
      COALESCE(
        (SELECT u.idusuario 
         FROM transaccion_caja tc 
         JOIN usuarios u ON tc.idusuario = u.idusuario 
         WHERE tc.idcaja = c.idcaja 
           AND tc.tipo_movimiento = 'apertura'
         ORDER BY tc.idtransaccion_caja ASC 
         LIMIT 1),
        0
      ) as idusuario,
      COALESCE(
        (SELECT u.usuario 
         FROM transaccion_caja tc 
         JOIN usuarios u ON tc.idusuario = u.idusuario 
         WHERE tc.idcaja = c.idcaja 
           AND tc.tipo_movimiento = 'apertura'
         ORDER BY tc.idtransaccion_caja ASC 
         LIMIT 1),
        'Sistema'
      ) as usuario
    FROM caja c
    ORDER BY c.idcaja DESC
    LIMIT 1
  `;

  const result = await query(sql);

  if (result.rows.length === 0) {
    // Si no hay caja, devolver un estado por defecto
    return {
      idcaja: 0,
      nombre_caja: "Caja Principal",
      monto_final: "0.00",
      estado: "cerrada",
      idusuario: 0,
      usuario: "Sistema"
    };
  }

  return result.rows[0];
};

const processSale = async (saleData, userId) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verificar si la caja está abierta para pagos en efectivo
    if (saleData.metodo_pago === "Efectivo") {
      const cashStatusCheck = await client.query(
        `SELECT idcaja, estado, total 
         FROM caja 
         ORDER BY idcaja DESC 
         LIMIT 1`
      );

      if (
        cashStatusCheck.rows.length === 0 ||
        cashStatusCheck.rows[0].estado === "cerrada"
      ) {
        throw new Error(
          "La caja está cerrada. No se puede procesar la venta en efectivo."
        );
      }
    }

    // Verificar usuario
    const userCheck = await client.query(
      "SELECT idusuario FROM usuarios WHERE idusuario = $1 AND estado = 0",
      [userId]
    );

    if (userCheck.rows.length === 0) {
      throw new Error("Usuario no válido o inactivo");
    }

    // Verificar doctor si se proporcionó
    if (saleData.doctorId) {
      const doctorCheck = await client.query(
        "SELECT iddoctor FROM doctores WHERE iddoctor = $1 AND estado = 0",
        [saleData.doctorId]
      );

      if (doctorCheck.rows.length === 0) {
        throw new Error("Doctor no válido o inactivo");
      }
    }

    // Obtener IDs de productos y lotes
    const productIds = saleData.items.map((item) => item.idproducto);
    const loteIds = saleData.items.flatMap((item) =>
      item.lotes.map((lote) => lote.idlote)
    );

    // Verificar productos
    const productsResult = await client.query(
      `
        SELECT idproducto, nombre
        FROM productos
        WHERE idproducto = ANY($1::int[])
          AND estado = 0
      `,
      [productIds]
    );

    // Verificar lotes
    const lotesResult = await client.query(
      `
        SELECT idlote, idproducto, stock
        FROM lotes
        WHERE idlote = ANY($1::int[])
          AND estado = 0
      `,
      [loteIds]
    );

    const productsMap = new Map(
      productsResult.rows.map((producto) => [
        producto.idproducto,
        producto,
      ])
    );

    const lotesMap = new Map(
      lotesResult.rows.map((lote) => [
        lote.idlote,
        lote,
      ])
    );

    // Validar productos y lotes
    for (const item of saleData.items) {
      const product = productsMap.get(item.idproducto);

      if (!product) {
        throw new Error(
          `El producto ${item.idproducto} no existe o está inactivo`
        );
      }

      const cantidadLotes = item.lotes.reduce(
        (total, lote) => total + lote.cantidad,
        0
      );

      if (cantidadLotes !== item.cantidad) {
        throw new Error(
          `La cantidad de lotes seleccionados para ${product.nombre} ` +
          `(${cantidadLotes}) no coincide con la cantidad solicitada (${item.cantidad})`
        );
      }

      for (const loteSeleccionado of item.lotes) {
        const lote = lotesMap.get(loteSeleccionado.idlote);

        if (!lote) {
          throw new Error(
            `El lote ${loteSeleccionado.idlote} no existe o está inactivo`
          );
        }

        if (lote.idproducto !== item.idproducto) {
          throw new Error(
            `El lote ${lote.idlote} no pertenece al producto ${product.nombre}`
          );
        }

        if (lote.stock < loteSeleccionado.cantidad) {
          throw new Error(
            `Stock insuficiente para ${product.nombre} en el lote ${lote.idlote}. ` +
            `Stock disponible: ${lote.stock}`
          );
        }
      }
    }

    // Insertar venta
    const saleResult = await client.query(
      `INSERT INTO ventas (fecha_hora, idusuario, descripcion, sub_total, descuento, total, metodo_pago, descripcion_descuento) 
       VALUES (TIMEZONE('America/La_Paz', NOW()), $1, $2, $3, $4, $5, $6, $7) 
       RETURNING idventa`,
      [
        userId,
        saleData.descripcion,
        saleData.sub_total,
        saleData.descuento,
        saleData.total,
        saleData.metodo_pago,
        saleData.descripcion_descuento || null,
      ]
    );

    const saleId = saleResult.rows[0].idventa;

    // ============================================
    // INSERTAR DETALLES DE VENTA CON idlote
    // CADA LOTE = UN REGISTRO EN detalle_ventas
    // ============================================
    for (const item of saleData.items) {
      // Calcular descuento total del producto
      let descuentoMontoTotal = 0;
      
      if (item.descuento_producto && item.descuento_producto > 0) {
        const subtotalLinea = item.precio_unitario * item.cantidad;
        descuentoMontoTotal = (subtotalLinea * item.descuento_producto) / 100;
      } else if (item.descuento_monto) {
        descuentoMontoTotal = item.descuento_monto;
      }

      // Para CADA LOTE, insertar un registro en detalle_ventas
      for (const lote of item.lotes) {
        // Calcular subtotal para este lote específico
        const subtotalLote = item.precio_unitario * lote.cantidad;
        
        // Proporcionar el descuento proporcional a este lote
        const descuentoLote = (descuentoMontoTotal * lote.cantidad) / item.cantidad;

        await client.query(
          `INSERT INTO detalle_ventas (
            idventa, 
            idproducto, 
            idlote,      -- ✅ GUARDAMOS EL LOTE
            cantidad, 
            precio_unitario, 
            subtotal_linea, 
            descuento_monto, 
            iddoctor
          ) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            saleId,
            item.idproducto,
            lote.idlote,        // ✅ ID DEL LOTE
            lote.cantidad,      // ✅ CANTIDAD DE ESTE LOTE (ej: 10 o 18)
            item.precio_unitario,
            subtotalLote,       // ✅ SUBTOTAL DE ESTE LOTE
            descuentoLote,      // ✅ DESCUENTO PROPORCIONAL
            saleData.doctorId || null,
          ]
        );

        // Actualizar stock del lote
        const result = await client.query(
          `
            UPDATE lotes
            SET stock = stock - $1
            WHERE idlote = $2
              AND stock >= $1
              AND estado = 0
          `,
          [lote.cantidad, lote.idlote]
        );

        if (result.rowCount === 0) {
          throw new Error(
            `No hay stock suficiente en el lote ${lote.idlote}`
          );
        }

        console.log(`✅ Producto ${item.idproducto}: ${lote.cantidad} unidades del lote ${lote.idlote}`);
      }
    }

    // Registrar transacción de caja para pagos en efectivo
    if (saleData.metodo_pago === "Efectivo") {
      const cajaResult = await client.query(
        `SELECT idcaja, total 
         FROM caja 
         WHERE estado = 'abierta'
         ORDER BY idcaja DESC 
         LIMIT 1`
      );

      if (cajaResult.rows.length === 0) {
        throw new Error("No hay una caja abierta para registrar el ingreso");
      }

      const idcaja = cajaResult.rows[0].idcaja;
      const montoAnterior = parseFloat(cajaResult.rows[0].total);
      const montoNuevo = montoAnterior + parseFloat(saleData.total);

      await client.query(
        `UPDATE caja 
         SET total = $1 
         WHERE idcaja = $2`,
        [montoNuevo, idcaja]
      );

      await client.query(
        `INSERT INTO transaccion_caja (
          idcaja, 
          tipo_movimiento, 
          descripcion, 
          monto, 
          fecha, 
          idusuario, 
          monto_anterior, 
          monto_nuevo,
          idventa
        ) 
        VALUES (
          $1, 
          'ingreso', 
          $2, 
          $3, 
          TIMEZONE('America/La_Paz', NOW()), 
          $4, 
          $5, 
          $6,
          $7
        )`,
        [
          idcaja,
          `Venta N° ${saleId}: ${saleData.descripcion || 'Venta en efectivo'}`,
          saleData.total,
          userId,
          montoAnterior,
          montoNuevo,
          saleId,
        ]
      );
    }

    await client.query("COMMIT");

    return { idventa: saleId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const getDoctores = async () => {
  try {
    const result = await query(
      "SELECT iddoctor as id, nombre_doctor as nombre FROM doctores WHERE estado = 0 ORDER BY nombre_doctor"
    );
    return result.rows;
  } catch (error) {
    throw error;
  }
};

const createDoctor = async (nombre) => {
  try {
    const result = await query(
      "INSERT INTO doctores (nombre_doctor) VALUES ($1) RETURNING iddoctor as id, nombre_doctor as nombre",
      [nombre]
    );
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const updateDoctor = async (nombre, id) => {
  try {
    const result = await query(
      "UPDATE doctores SET nombre_doctor = $1 WHERE iddoctor = $2 AND estado = 0 RETURNING iddoctor as id, nombre_doctor as nombre",
      [nombre, id]
    );
    if (result.rows.length === 0) {
      throw new Error("Doctor no encontrado");
    }
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

const deleteDoctor = async (id) => {
  try {
    const result = await query(
      "UPDATE doctores SET estado = 1 WHERE iddoctor = $1 AND estado = 0 RETURNING iddoctor as id, nombre_doctor as nombre",
      [id]
    );
    if (result.rows.length === 0) {
      throw new Error("Doctor no encontrado");
    }
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getCurrentCashStatus,
  processSale,
  getDoctores,
  createDoctor,
  updateDoctor,
  deleteDoctor,
};