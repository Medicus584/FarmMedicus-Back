const { query } = require("../../db");
const bcrypt = require("bcrypt");

const getUsuarios = async () => {
  const result = await query(
    "SELECT idusuario, nombres, apellidos, telefono, usuario, rol, estado FROM usuarios WHERE estado IN (0, 1) ORDER BY idusuario"
  );
  return result.rows;
};

const createUsuario = async (usuarioData) => {
  const { nombres, apellidos, telefono, usuario, contraseña, rol } = usuarioData;

  // Verificar si el usuario ya existe
  const usuarioExistente = await query(
    "SELECT idusuario FROM usuarios WHERE usuario = $1 AND estado IN (0, 1)",
    [usuario]
  );

  if (usuarioExistente.rows.length > 0) {
    throw new Error("El nombre de usuario ya existe");
  }

  // Hash de la contraseña
  const hashedPassword = await bcrypt.hash(contraseña, 10);

  const result = await query(
    `INSERT INTO usuarios (nombres, apellidos, telefono, usuario, contraseña, rol, estado) 
     VALUES ($1, $2, $3, $4, $5, $6, 1) 
     RETURNING idusuario, nombres, apellidos, telefono, usuario, rol, estado`,
    [nombres, apellidos, telefono, usuario, hashedPassword, rol]
  );

  return result.rows[0];
};

const updateUsuario = async (id, usuarioData) => {
  const { nombres, apellidos, telefono, usuario, contraseña, rol } = usuarioData;

  // Verificar si el usuario existe
  const usuarioExistente = await query(
    "SELECT idusuario FROM usuarios WHERE idusuario = $1 AND estado IN (0, 1)",
    [id]
  );

  if (usuarioExistente.rows.length === 0) {
    throw new Error("Usuario no encontrado");
  }

  // Verificar si el nuevo username ya existe en otro usuario
  const usuarioDuplicado = await query(
    "SELECT idusuario FROM usuarios WHERE usuario = $1 AND idusuario != $2 AND estado IN (0, 1)",
    [usuario, id]
  );

  if (usuarioDuplicado.rows.length > 0) {
    throw new Error("El nombre de usuario ya está en uso");
  }

  let queryText = "";
  let queryParams = [];

  if (contraseña) {
    // Actualizar con contraseña
    const hashedPassword = await bcrypt.hash(contraseña, 10);
    queryText = `UPDATE usuarios 
                 SET nombres = $1, apellidos = $2, telefono = $3, usuario = $4, contraseña = $5, rol = $6 
                 WHERE idusuario = $7 
                 RETURNING idusuario, nombres, apellidos, telefono, usuario, rol, estado`;
    queryParams = [nombres, apellidos, telefono, usuario, hashedPassword, rol, id];
  } else {
    // Actualizar sin cambiar contraseña
    queryText = `UPDATE usuarios 
                 SET nombres = $1, apellidos = $2, telefono = $3, usuario = $4, rol = $5 
                 WHERE idusuario = $6 
                 RETURNING idusuario, nombres, apellidos, telefono, usuario, rol, estado`;
    queryParams = [nombres, apellidos, telefono, usuario, rol, id];
  }

  const result = await query(queryText, queryParams);
  return result.rows[0];
};

const deleteUsuario = async (id) => {
  // Cambiar estado a 2 (eliminado) en lugar de borrar físicamente
  const result = await query(
    "UPDATE usuarios SET estado = 2 WHERE idusuario = $1 RETURNING idusuario",
    [id]
  );

  if (result.rows.length === 0) {
    throw new Error("Usuario no encontrado");
  }
};

const toggleUsuarioStatus = async (id) => {
  const result = await query(
    `UPDATE usuarios 
     SET estado = CASE WHEN estado = 1 THEN 0 ELSE 1 END 
     WHERE idusuario = $1 AND estado IN (0, 1)
     RETURNING idusuario, nombres, apellidos, telefono, usuario, rol, estado`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new Error("Usuario no encontrado");
  }

  return result.rows[0];
};

// NUEVA FUNCIÓN: Cambiar contraseña del usuario logueado
const changePassword = async (userId, currentPassword, newPassword) => {
  try {
    // Obtener el usuario con su contraseña actual
    const result = await query(
      `SELECT idusuario, contraseña FROM usuarios WHERE idusuario = $1 AND estado IN (0, 1)`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error("Usuario no encontrado");
    }

    const user = result.rows[0];

    // Verificar que la contraseña actual sea correcta
    const isMatch = await bcrypt.compare(currentPassword, user.contraseña);

    if (!isMatch) {
      throw new Error("Contraseña actual incorrecta");
    }

    // Hash de la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar la contraseña
    await query(
      `UPDATE usuarios SET contraseña = $1 WHERE idusuario = $2`,
      [hashedPassword, userId]
    );

    return { success: true };
  } catch (error) {
    console.error("Error en usersService.changePassword:", error);
    throw error;
  }
};

module.exports = {
  getUsuarios,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  toggleUsuarioStatus,
  changePassword,
};