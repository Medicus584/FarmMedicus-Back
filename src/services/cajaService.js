// src/services/cajaService.js
const { query } = require("../../db");

exports.getTransaccionesCaja = async () => {
  const result = await query(
    `SELECT 
      tc.idtransaccion_caja as idtransaccion,
      tc.idcaja,
      tc.tipo_movimiento,
      tc.descripcion,
      tc.monto,
      tc.fecha,
      tc.idusuario,
      tc.idventa,
      u.nombres,
      u.apellidos,
      tc.monto_anterior,
      tc.monto_nuevo
     FROM transaccion_caja tc
     JOIN usuarios u ON tc.idusuario = u.idusuario
     ORDER BY tc.fecha DESC`
  );
  return result.rows;
};

exports.getTransaccionesCajaByFecha = async (fecha) => {
  const result = await query(
    `SELECT 
      tc.idtransaccion_caja as idtransaccion,
      tc.idcaja,
      tc.tipo_movimiento,
      tc.descripcion,
      tc.monto,
      tc.fecha,
      tc.idusuario,
      tc.idventa,
      u.nombres,
      u.apellidos,
      tc.monto_anterior,
      tc.monto_nuevo
     FROM transaccion_caja tc
     JOIN usuarios u ON tc.idusuario = u.idusuario
     WHERE DATE(tc.fecha) = $1
     ORDER BY tc.fecha DESC`,
    [fecha]
  );
  return result.rows;
};

exports.getTransaccionesCajaByRango = async (fechaInicio, fechaFin) => {
  const result = await query(
    `SELECT 
      tc.idtransaccion_caja as idtransaccion,
      tc.idcaja,
      tc.tipo_movimiento,
      tc.descripcion,
      tc.monto,
      tc.fecha,
      tc.idusuario,
      tc.idventa,
      u.nombres,
      u.apellidos,
      tc.monto_anterior,
      tc.monto_nuevo
     FROM transaccion_caja tc
     JOIN usuarios u ON tc.idusuario = u.idusuario
     WHERE DATE(tc.fecha) BETWEEN $1 AND $2
     ORDER BY tc.fecha DESC`,
    [fechaInicio, fechaFin]
  );
  return result.rows;
};

exports.getTransaccionesCajaByUsuario = async (idusuario) => {
  const result = await query(
    `SELECT 
      tc.idtransaccion_caja as idtransaccion,
      tc.idcaja,
      tc.tipo_movimiento,
      tc.descripcion,
      tc.monto,
      tc.fecha,
      tc.idusuario,
      tc.idventa,
      u.nombres,
      u.apellidos,
      tc.monto_anterior,
      tc.monto_nuevo
     FROM transaccion_caja tc
     JOIN usuarios u ON tc.idusuario = u.idusuario
     WHERE tc.idusuario = $1
     ORDER BY tc.fecha DESC`,
    [idusuario]
  );
  return result.rows;
};

exports.getTransaccionesCajaByUsuarioFecha = async (idusuario, fecha) => {
  const result = await query(
    `SELECT 
      tc.idtransaccion_caja as idtransaccion,
      tc.idcaja,
      tc.tipo_movimiento,
      tc.descripcion,
      tc.monto,
      tc.fecha,
      tc.idusuario,
      tc.idventa,
      u.nombres,
      u.apellidos,
      tc.monto_anterior,
      tc.monto_nuevo
     FROM transaccion_caja tc
     JOIN usuarios u ON tc.idusuario = u.idusuario
     WHERE tc.idusuario = $1 AND DATE(tc.fecha) = $2
     ORDER BY tc.fecha DESC`,
    [idusuario, fecha]
  );
  return result.rows;
};

exports.getTransaccionesCajaByUsuarioRango = async (idusuario, fechaInicio, fechaFin) => {
  const result = await query(
    `SELECT 
      tc.idtransaccion_caja as idtransaccion,
      tc.idcaja,
      tc.tipo_movimiento,
      tc.descripcion,
      tc.monto,
      tc.fecha,
      tc.idusuario,
      tc.idventa,
      u.nombres,
      u.apellidos,
      tc.monto_anterior,
      tc.monto_nuevo
     FROM transaccion_caja tc
     JOIN usuarios u ON tc.idusuario = u.idusuario
     WHERE tc.idusuario = $1 AND DATE(tc.fecha) BETWEEN $2 AND $3
     ORDER BY tc.fecha DESC`,
    [idusuario, fechaInicio, fechaFin]
  );
  return result.rows;
};

exports.getEstadoCajaActual = async () => {
  const result = await query(
    `SELECT 
      idcaja,
      nombre_caja,
      total as monto_final,
      estado
     FROM caja 
     ORDER BY idcaja DESC 
     LIMIT 1`
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return {
    idestado_caja: result.rows[0].idcaja,
    estado: result.rows[0].estado,
    monto_inicial: 0,
    monto_final: parseFloat(result.rows[0].monto_final),
    idusuario: null
  };
};

exports.getSaldoActual = async () => {
  try {
    const result = await query(
      `SELECT 
        estado,
        total as monto_final
       FROM caja 
       ORDER BY idcaja DESC 
       LIMIT 1`
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
    console.error("Error in getSaldoActual service:", error);
    return {
      estado: "cerrada",
      monto_final: "0.00"
    };
  }
};

exports.getUsuariosCaja = async () => {
  const result = await query(
    `SELECT DISTINCT 
      CONCAT(u.nombres, ' ', u.apellidos) as empleado_nombre
     FROM transaccion_caja tc
     JOIN usuarios u ON tc.idusuario = u.idusuario
     WHERE u.estado = 0
     ORDER BY empleado_nombre`
  );
  return result.rows.map(row => row.empleado_nombre);
};

exports.createTransaccionCaja = async (transaccionData) => {
  const { idcaja, tipo_movimiento, descripcion, monto, idusuario, idventa, monto_anterior, monto_nuevo } = transaccionData;
  
  const result = await query(
    `INSERT INTO transaccion_caja 
     (idcaja, tipo_movimiento, descripcion, monto, idusuario, idventa, monto_anterior, monto_nuevo, fecha)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
     RETURNING *`,
    [idcaja, tipo_movimiento, descripcion, monto, idusuario, idventa, monto_anterior, monto_nuevo]
  );
  
  const transaccionCompleta = await query(
    `SELECT 
      tc.idtransaccion_caja as idtransaccion,
      tc.idcaja,
      tc.tipo_movimiento,
      tc.descripcion,
      tc.monto,
      tc.fecha,
      tc.idusuario,
      tc.idventa,
      u.nombres,
      u.apellidos,
      tc.monto_anterior,
      tc.monto_nuevo
     FROM transaccion_caja tc
     JOIN usuarios u ON tc.idusuario = u.idusuario
     WHERE tc.idtransaccion_caja = $1`,
    [result.rows[0].idtransaccion_caja]
  );
  
  return transaccionCompleta.rows[0];
};