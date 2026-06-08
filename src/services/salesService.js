const { query, pool } = require("../../db");

const searchProducts = async (searchQuery, withoutStock = true) => {
  if (!searchQuery || searchQuery.trim() === "") {
    return [];
  }

  // Consulta principal con productos similares
  const productsSql = `
    SELECT 
      p.idproducto,
      p.nombre,
      p.descripcion,
      p.estado,
      p.idubicacion,
      u.nombre as nombre_ubicacion,
      p.imagen,
      p.precio_venta,
      p.stock,
      COALESCE(
        (SELECT json_agg(
          json_build_object(
            'idproducto', ps.idproducto_similar,
            'nombre', ps2.nombre
          )
        )
        FROM productos_similares ps
        JOIN productos ps2 ON ps.idproducto_similar = ps2.idproducto
        WHERE ps.idproducto = p.idproducto AND ps2.estado = 0
        ), '[]'::json
      ) as productos_similares
    FROM productos p
    LEFT JOIN ubicaciones u ON p.idubicacion = u.idubicacion
    WHERE p.estado = 0 
      AND (p.nombre ILIKE $1 OR p.descripcion ILIKE $1 OR p.codigo_barras ILIKE $1)
      ${withoutStock ? "AND p.stock > 0" : ""}
    ORDER BY p.nombre
    LIMIT 10;
  `;

  const searchTerm = `%${searchQuery}%`;
  try {
    const productsResult = await query(productsSql, [searchTerm]);
    return productsResult.rows;
  } catch (error) {
    console.error("Error in searchProducts SQL query:", error);
    throw error;
  }
};

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

    for (const item of saleData.items) {
      const stockCheck = await client.query(
        "SELECT stock FROM productos WHERE idproducto = $1 AND estado = 0",
        [item.idproducto],
      );

      if (stockCheck.rows.length === 0) {
        throw new Error(
          `El producto ${item.idproducto} no existe o está inactivo`,
        );
      }

      if (stockCheck.rows[0].stock < item.cantidad) {
        const productInfo = await client.query(
          "SELECT nombre FROM productos WHERE idproducto = $1",
          [item.idproducto],
        );
        const productName = productInfo.rows[0]?.nombre || "Producto";
        throw new Error(
          `Stock insuficiente para ${productName}. Stock disponible: ${stockCheck.rows[0].stock}`,
        );
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
        `INSERT INTO detalle_ventas (idventa, idproducto, cantidad, precio_unitario, subtotal_linea) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          saleId,
          item.idproducto,
          item.cantidad,
          item.precio_unitario,
          item.subtotal_linea,
        ],
      );

      await client.query(
        "UPDATE productos SET stock = stock - $1 WHERE idproducto = $2",
        [item.cantidad, item.idproducto],
      );
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

module.exports = {
  searchProducts,
  getCurrentCashStatus,
  processSale,
};
