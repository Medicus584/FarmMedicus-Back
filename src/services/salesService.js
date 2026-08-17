const { query, pool } = require("../../db");

const getCurrentCashStatus = async () => {
  const sql = `
    SELECT ec.*, u.usuario
    FROM estado_caja ec
    INNER JOIN usuarios u ON ec.idusuario = u.idusuario
    ORDER BY ec.idestado_caja DESC
    LIMIT 1
  `;

  const result = await query(sql);

  if (result.rows.length === 0) {
    throw new Error("No hay registro de caja");
  }

  return result.rows[0];
};

const processSale = async (saleData, userId) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (saleData.metodo_pago === "Efectivo") {
      const cashStatusCheck = await client.query(
        "SELECT * FROM estado_caja ORDER BY idestado_caja DESC LIMIT 1",
      );

      if (
        cashStatusCheck.rows.length === 0 ||
        cashStatusCheck.rows[0].estado === "cerrada"
      ) {
        throw new Error(
          "La caja está cerrada. No se puede procesar la venta en efectivo.",
        );
      }
    }

    const userCheck = await client.query(
      "SELECT idusuario FROM usuarios WHERE idusuario = $1 AND estado = 0",
      [userId],
    );

    if (userCheck.rows.length === 0) {
      throw new Error("Usuario no válido o inactivo");
    }

    if (saleData.doctorId) {
      const doctorCheck = await client.query(
        "SELECT iddoctor FROM doctores WHERE iddoctor = $1 AND estado = 0",
        [saleData.doctorId],
      );
  
      if (doctorCheck.rows.length === 0) {
        throw new Error("Doctor no válido o inactivo");
      }
    }

    const productIds = saleData.items.map((item) => item.idproducto);

    const loteIds = saleData.items.flatMap((item) =>
      item.lotes.map((lote) => lote.idlote),
    );

    const productsResult = await client.query(
      `
        SELECT idproducto, nombre
        FROM productos
        WHERE idproducto = ANY($1::int[])
          AND estado = 0
      `,
      [productIds],
    );

    const lotesResult = await client.query(
      `
        SELECT idlote, idproducto, stock
        FROM lotes
        WHERE idlote = ANY($1::int[])
          AND estado = 0
      `,
      [loteIds],
    );

    const productsMap = new Map(
      productsResult.rows.map((producto) => [
        producto.idproducto,
        producto,
      ]),
    );

    const lotesMap = new Map(
      lotesResult.rows.map((lote) => [
        lote.idlote,
        lote,
      ]),
    );

    for (const item of saleData.items) {
      const product = productsMap.get(item.idproducto);

      if (!product) {
        throw new Error(
          `El producto ${item.idproducto} no existe o está inactivo`,
        );
      }

      const cantidadLotes = item.lotes.reduce(
        (total, lote) => total + lote.cantidad,
        0,
      );

      if (cantidadLotes !== item.cantidad) {
        throw new Error(
          `La cantidad de lotes seleccionados para ${product.nombre} ` +
          `(${cantidadLotes}) no coincide con la cantidad solicitada (${item.cantidad})`,
        );
      }

      for (const loteSeleccionado of item.lotes) {
        const lote = lotesMap.get(loteSeleccionado.idlote);

        if (!lote) {
          throw new Error(
            `El lote ${loteSeleccionado.idlote} no existe o está inactivo`,
          );
        }

        // Verificar que el lote pertenezca al producto
        if (lote.idproducto !== item.idproducto) {
          throw new Error(
            `El lote ${lote.idlote} no pertenece al producto ${product.nombre}`,
          );
        }

        // Verificar stock
        if (lote.stock < loteSeleccionado.cantidad) {
          throw new Error(
            `Stock insuficiente para ${product.nombre} en el lote ${lote.idlote}. ` +
            `Stock disponible: ${lote.stock}`,
          );
        }
      }
    }

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
        saleData.descripcion_descuento,
      ],
    );

    const saleId = saleResult.rows[0].idventa;

    for (const item of saleData.items) {
      await client.query(
        `INSERT INTO detalle_ventas (idventa, idproducto, cantidad, precio_unitario, subtotal_linea, iddoctor) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          saleId,
          item.idproducto,
          item.cantidad,
          item.precio_unitario,
          item.subtotal_linea,
          saleData.doctorId ?? null,
        ],
      );

      for (const lote of item.lotes) {
        const result = await client.query(
          `
            UPDATE lotes
            SET stock = stock - $1
            WHERE idlote = $2
              AND stock >= $1
              AND estado = 0
          `,
          [lote.cantidad, lote.idlote],
        );

        if (result.rowCount === 0) {
          throw new Error(
            `No hay stock suficiente en el lote ${lote.idlote}`,
          );
        }
      }
    }

    if (saleData.metodo_pago === "Efectivo") {
      const lastMontoFinalResult = await client.query(
        "SELECT monto_final FROM estado_caja ORDER BY idestado_caja DESC LIMIT 1",
      );
      const lastMontoFinal = lastMontoFinalResult.rows[0]?.monto_final || 0;

      const nuevoMontoFinal =
        parseFloat(lastMontoFinal) + parseFloat(saleData.total);

      const newCashStatusResult = await client.query(
        `INSERT INTO estado_caja (estado, monto_inicial, monto_final, idusuario) 
         VALUES ('abierta', $1, $2, $3) 
         RETURNING idestado_caja`,
        [lastMontoFinal, nuevoMontoFinal, userId],
      );

      const newCashStatusId = newCashStatusResult.rows[0].idestado_caja;

      await client.query(
        `INSERT INTO transacciones_caja (idestado_caja, tipo_movimiento, descripcion, monto, fecha, idusuario, idventa) 
         VALUES ($1, 'Ingreso', $2, $3, TIMEZONE('America/La_Paz', NOW()), $4, $5)`,
        [
          newCashStatusId,
          `Venta: ${saleData.descripcion}`,
          saleData.total,
          userId,
          saleId,
        ],
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
      "SELECT iddoctor as id, nombre_doctor as nombre FROM doctores WHERE estado = 0 ORDER BY nombre_doctor",
    );
    return result.rows;
  } catch (error) {
    throw error;
  }
}

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
}

const updateDoctor = async (nombre, id) => {
  try {
    const result = await query(
      "UPDATE doctores SET nombre_doctor = $1 WHERE iddoctor = $2 RETURNING iddoctor as id, nombre_doctor as nombre",
      [nombre, id]
    );
    if (result.rows.length === 0) {
      throw new Error("Doctor no encontrado");
    }
    return result.rows[0];
  } catch (error) {
    throw error;
  }
}

const deleteDoctor = async (id) => {
  try {
    const result = await query(
      "UPDATE doctores SET estado = 1 WHERE iddoctor = $1 RETURNING iddoctor as id, nombre_doctor as nombre",
      [id]
    );
    if (result.rows.length === 0) {
      throw new Error("Doctor no encontrado");
    }
  } catch (error) {
    throw error;
  }
}

module.exports = {
  getCurrentCashStatus,
  processSale,
  getDoctores,
  createDoctor,
  updateDoctor,
  deleteDoctor,
};
