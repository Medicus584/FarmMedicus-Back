const express = require("express");
const cors = require("cors");
const { connectDB } = require("./db");

const app = express();

// Rutas
//ejemplo :const authRoutes = require("./src/routes/authRoutes");
const authRoutes = require('./src/routes/authRoutes');
const ManagementSectionRoutes = require("./src/routes/ManagementSectionRoutes");
const productsRoutes = require('./src/routes/productsRoutes');
const formularioProductoRoutes = require("./src/routes/FormularioProductoRoutes");
const notesRoutes = require('./src/routes/notesRoutes');  
const usersRoutes = require('./src/routes/usersRoutes');
const ventasRoutes = require('./src/routes/ventasRoutes');
const inventoryRoutes = require('./src/routes/inventoryRoutes');
const alertsRoutes = require("./src/routes/alertsRoutes");
const salesRoutes = require("./src/routes/salesRoutes");
const reportesRoutes = require("./src/routes/reportesRoutes");
const cotizacionesRoutes = require('./src/routes/cotizacionesRoutes');
const homeRoutes = require('./src/routes/HomeRoutes');
const cajaRoutes = require('./src/routes/cajaRoutes');
const cashRoutes = require("./src/routes/cashRoutes");
const pagosRoutes = require('./src/routes/pagosRoutes');
const ecommerceRoutes = require('./src/routes/ecommerceRoutes');

// Lista de orígenes permitidos
const allowedOrigins = [
  "http://localhost:8080",
  "http://localhost:3000",
  "https://lumyra-farmacia.netlify.app",
  "https://farmmedicus-back.onrender.com",
];

// Opciones de configuración CORS
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // permite herramientas como Postman

    if (
      allowedOrigins.some((allowedOrigin) =>
        origin.includes(allowedOrigin.replace(/https?:\/\//, ""))
      )
    ) {
      return callback(null, true);
    }

    const msg = `El origen ${origin} no tiene permiso de acceso.`;
    return callback(new Error(msg), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // Asegura que PATCH está incluido
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Aplica CORS
app.use(cors(corsOptions));

// Maneja solicitudes preflight (OPTIONS)
app.options("*", cors(corsOptions));

// Middleware para parsear JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
//ejempl: app.use("/api/auth", authRoutes);
app.use('/api', authRoutes);
app.use("/api", ManagementSectionRoutes);
app.use('/api', productsRoutes);
app.use("/api", formularioProductoRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api', ventasRoutes);
app.use('/api', inventoryRoutes);
app.use("/api", alertsRoutes);
app.use("/api", salesRoutes);
app.use("/api", reportesRoutes);
app.use('/api', cotizacionesRoutes);
app.use('/api', homeRoutes);
app.use("/api", cajaRoutes);
app.use("/api", cashRoutes);
app.use('/api', pagosRoutes);
app.use('/api', ecommerceRoutes);

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Error interno del servidor",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Iniciar el servidor
const startServer = async () => {
  try {
    await connectDB();
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en el puerto ${PORT}`);
    });
  } catch (error) {
    console.error("Error al iniciar el servidor:", error);
    process.exit(1);
  }
};

startServer();
