const usersService = require("../services/usersService");

const getUsuarios = async (req, res) => {
  try {
    const usuarios = await usersService.getUsuarios();
    res.json(usuarios);
  } catch (error) {
    console.error("Error en getUsuarios:", error);
    res.status(500).json({ error: error.message });
  }
};

const createUsuario = async (req, res) => {
  try {
    const { nombres, apellidos, telefono, usuario, contraseña, rol } = req.body;
    
    // Validaciones básicas
    if (!nombres || !apellidos || !telefono || !usuario || !rol) {
      return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }

    if (!contraseña) {
      return res.status(400).json({ error: "La contraseña es obligatoria" });
    }

    if (telefono.length !== 8) {
      return res.status(400).json({ error: "El teléfono debe tener 8 dígitos" });
    }

    const nuevoUsuario = await usersService.createUsuario({
      nombres,
      apellidos,
      telefono,
      usuario,
      contraseña,
      rol,
    });

    res.status(201).json(nuevoUsuario);
  } catch (error) {
    console.error("Error en createUsuario:", error);
    res.status(500).json({ error: error.message });
  }
};

const updateUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombres, apellidos, telefono, usuario, contraseña, rol } = req.body;

    if (!nombres || !apellidos || !telefono || !usuario || !rol) {
      return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }

    if (telefono.length !== 8) {
      return res.status(400).json({ error: "El teléfono debe tener 8 dígitos" });
    }

    const usuarioActualizado = await usersService.updateUsuario(parseInt(id), {
      nombres,
      apellidos,
      telefono,
      usuario,
      contraseña,
      rol,
    });

    res.json(usuarioActualizado);
  } catch (error) {
    console.error("Error en updateUsuario:", error);
    res.status(500).json({ error: error.message });
  }
};

const deleteUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    await usersService.deleteUsuario(parseInt(id));
    res.status(204).send();
  } catch (error) {
    console.error("Error en deleteUsuario:", error);
    res.status(500).json({ error: error.message });
  }
};

const toggleUsuarioStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await usersService.toggleUsuarioStatus(parseInt(id));
    res.json(usuario);
  } catch (error) {
    console.error("Error en toggleUsuarioStatus:", error);
    res.status(500).json({ error: error.message });
  }
};

// NUEVO CONTROLADOR: Cambiar contraseña del usuario logueado
const changePassword = async (req, res) => {
  try {
    // Obtener el userId del usuario autenticado (del middleware)
    const userId = req.user?.idusuario;
    
    console.log("Usuario autenticado:", req.user);
    console.log("UserId:", userId);
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Usuario no autenticado"
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Contraseña actual y nueva son requeridas"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: "La nueva contraseña debe tener al menos 6 caracteres"
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        error: "La nueva contraseña debe ser diferente a la actual"
      });
    }

    await usersService.changePassword(userId, currentPassword, newPassword);

    res.json({
      success: true,
      message: "Contraseña actualizada exitosamente"
    });

  } catch (error) {
    console.error("Error en changePassword:", error);
    
    if (error.message === "Usuario no encontrado") {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    if (error.message === "Contraseña actual incorrecta") {
      return res.status(401).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || "Error al cambiar la contraseña"
    });
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