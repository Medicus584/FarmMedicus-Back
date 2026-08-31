// src/services/cashService.js
const { query, pool } = require("../../db");

exports.getCashStatus = async () => {
  try {
    const result = await query(
      `
      SELECT 
        c.estado,
        c.total as monto_final
      FROM caja c
      ORDER BY c.idcaja DESC
      LIMIT 1
      `
    );

    if (result.rows.length === 0) {
      return {
        estado: "cerrada",
        monto_final: "0.00"
      };
    }

    return {
      estado: result.rows[0].estado,
      monto_final: parseFloat(result.rows[0].monto_final).toFixed(2)
    };
  } catch (error) {
    console.error("Error in getCashStatus service:", error);
    return {
      estado: "cerrada",
      monto_final: "0.00"
    };
  }
};

exports.getUserTransactions = async (userId) => {
  try {
    const result = await query(
      `
      SELECT 
        tc.idtransaccion_caja as idtransaccion,
        tc.tipo_movimiento,
        tc.descripcion,
        tc.monto,
        tc.fecha,
        tc.idusuario,
        CONCAT(u.nombres, ' ', u.apellidos) as nombre_usuario,
        tc.monto_anterior,
        tc.monto_nuevo
      FROM transaccion_caja tc
      INNER JOIN usuarios u ON tc.idusuario = u.idusuario
      WHERE tc.idusuario = $1
        AND DATE(tc.fecha) = CURRENT_DATE
      ORDER BY tc.fecha DESC
      LIMIT 50
      `,
      [userId]
    );
    
    return result.rows;
  } catch (error) {
    console.error("Error in getUserTransactions service:", error);
    return [];
  }
};

exports.createTransaction = async ({ tipoMovimiento, descripcion, monto, userId }) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Obtener la caja actual (la última)
    const cajaQuery = `
      SELECT idcaja, estado, total
      FROM caja 
      ORDER BY idcaja DESC 
      LIMIT 1
    `;
    
    const cajaResult = await client.query(cajaQuery);
    
    if (cajaResult.rows.length === 0) {
      throw new Error("No se encontró caja");
    }
    
    const cajaActual = cajaResult.rows[0];
    
    if (cajaActual.estado !== 'abierta') {
      throw new Error("La caja no está abierta para realizar transacciones");
    }
    
    const idcaja = cajaActual.idcaja;
    const montoAnterior = parseFloat(cajaActual.total);
    let montoNuevo = montoAnterior;
    
    // 2. Calcular nuevo monto
    if (tipoMovimiento === 'Ingreso' || tipoMovimiento === 'Apertura') {
      montoNuevo = montoAnterior + monto;
    } else if (tipoMovimiento === 'Egreso') {
      if (montoAnterior < monto) {
        throw new Error("Saldo insuficiente en caja");
      }
      montoNuevo = montoAnterior - monto;
    } else if (tipoMovimiento === 'Cierre') {
      montoNuevo = montoAnterior;
    }

    // 3. Insertar transacción
    const result = await client.query(
      `
      INSERT INTO transaccion_caja (
        idcaja, 
        tipo_movimiento, 
        descripcion, 
        monto, 
        fecha, 
        idusuario, 
        monto_anterior, 
        monto_nuevo
      )
      VALUES ($1, $2, $3, $4, TIMEZONE('America/La_Paz', NOW()), $5, $6, $7)
      RETURNING *
      `,
      [idcaja, tipoMovimiento.toLowerCase(), descripcion, monto, userId, montoAnterior, montoNuevo]
    );

    // 4. Actualizar total en caja (solo si no es Cierre)
    if (tipoMovimiento !== 'Cierre') {
      await client.query(
        `UPDATE caja SET total = $1 WHERE idcaja = $2`,
        [montoNuevo, idcaja]
      );
    }

    // 5. Obtener información completa de la transacción
    const transactionResult = await client.query(
      `
      SELECT 
        tc.idtransaccion_caja as idtransaccion,
        tc.tipo_movimiento,
        tc.descripcion,
        tc.monto,
        tc.fecha,
        tc.idusuario,
        CONCAT(u.nombres, ' ', u.apellidos) as nombre_usuario,
        tc.monto_anterior,
        tc.monto_nuevo
      FROM transaccion_caja tc
      INNER JOIN usuarios u ON tc.idusuario = u.idusuario
      WHERE tc.idtransaccion_caja = $1
      `,
      [result.rows[0].idtransaccion_caja]
    );

    await client.query('COMMIT');
    return transactionResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error in createTransaction service:", error);
    throw error;
  } finally {
    client.release();
  }
};

exports.openCash = async ({ montoInicial, userId }) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Verificar si ya existe una caja abierta
    const cajaActualQuery = `
      SELECT idcaja, estado, total FROM caja 
      ORDER BY idcaja DESC 
      LIMIT 1
    `;
    
    const cajaActualResult = await client.query(cajaActualQuery);
    
    if (cajaActualResult.rows.length > 0 && cajaActualResult.rows[0].estado === 'abierta') {
      throw new Error("La caja ya está abierta");
    }
    
    let idcaja;
    let montoAnterior = 0;
    
    if (cajaActualResult.rows.length > 0) {
      // Si existe una caja cerrada, actualizarla
      idcaja = cajaActualResult.rows[0].idcaja;
      montoAnterior = parseFloat(cajaActualResult.rows[0].total) || 0;
      
      await client.query(
        `
        UPDATE caja 
        SET estado = 'abierta', total = $1
        WHERE idcaja = $2
        `,
        [montoInicial, idcaja]
      );
    } else {
      // Si no existe ninguna caja, crear una nueva
      const cajaResult = await client.query(
        `
        INSERT INTO caja (nombre_caja, total, estado)
        VALUES ('Caja Principal', $1, 'abierta')
        RETURNING idcaja
        `,
        [montoInicial]
      );
      idcaja = cajaResult.rows[0].idcaja;
    }
    
    // Crear transacción de apertura
    await client.query(
      `
      INSERT INTO transaccion_caja (
        idcaja, 
        tipo_movimiento, 
        descripcion, 
        monto, 
        fecha, 
        idusuario, 
        monto_anterior, 
        monto_nuevo
      )
      VALUES ($1, 'apertura', 'Apertura de caja', $2, TIMEZONE('America/La_Paz', NOW()), $3, $4, $2)
      `,
      [idcaja, montoInicial, userId, montoAnterior]
    );
    
    await client.query('COMMIT');
    return { success: true, message: "Caja abierta correctamente" };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error in openCash service:", error);
    throw error;
  } finally {
    client.release();
  }
};

exports.closeCash = async ({ userId }) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Obtener la caja abierta
    const cajaQuery = `
      SELECT idcaja, total, estado
      FROM caja 
      WHERE estado = 'abierta'
      ORDER BY idcaja DESC 
      LIMIT 1
    `;
    
    const cajaResult = await client.query(cajaQuery);
    
    if (cajaResult.rows.length === 0) {
      throw new Error("No hay una caja abierta para cerrar");
    }
    
    const cajaActual = cajaResult.rows[0];
    const idcaja = cajaActual.idcaja;
    const montoCierre = parseFloat(cajaActual.total);
    
    // Actualizar estado de caja
    await client.query(
      `
      UPDATE caja 
      SET estado = 'cerrada'
      WHERE idcaja = $1
      `,
      [idcaja]
    );
    
    // Crear transacción de cierre
    await client.query(
      `
      INSERT INTO transaccion_caja (
        idcaja, 
        tipo_movimiento, 
        descripcion, 
        monto, 
        fecha, 
        idusuario, 
        monto_anterior, 
        monto_nuevo
      )
      VALUES ($1, 'cierre', 'Cierre de caja', $2, TIMEZONE('America/La_Paz', NOW()), $3, $2, $2)
      `,
      [idcaja, montoCierre, userId]
    );
    
    await client.query('COMMIT');
    return { success: true, message: "Caja cerrada correctamente" };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error in closeCash service:", error);
    throw error;
  } finally {
    client.release();
  }
};