// src/index.js 

// Importamos libreria dotenv y cargamos variables de .env (configuracion del proyecto)
const dotenv = require("dotenv");
dotenv.config(); //Carga las variables en process.env

// Importamos librerias express y cors
const express = require("express"); //Framework para crear el API
const cors = require("cors"); //cors permite conexiones externas


// Importamos nuestras rutas
const productosRouter = require("./routes/productos");
const ventasRouter = require("./routes/ventas");

const whatsappRoutes = require("./whatsapp/index.js");

const adminRoutes = require("./routes/admin");

const adminButtonRoutes = require("./routes/admin.button.routes.js");

const adminContabilidadRoutes = require("./routes/admin.contabilidad.routes.js")


// Creamos el servidor y permitimos que entienda json en el body
const app = express();

// El backend se despliega detrás de un proxy (Render/Railway). Sin esto,
// req.ip es la IP del proxy y el rate limiting por IP se convierte en un
// único bucket global para todo el sistema.
app.set("trust proxy", 1);

app.use(express.json());

// Cors - permitimos que otros dominios consuman nuestra API
app.use(cors({ origin: true }));


// Modularidad - separamos responsabilidad por modulos: mejor legibilidad, escalabilidad y testing
// Conectamos nuestros modulos al servidor 
app.use("/api/productos", productosRouter);
app.use("/api/ventas", ventasRouter);

app.use("/api/whatsapp", whatsappRoutes);

app.use("/api/admin", adminRoutes);

app.use("/admin", adminButtonRoutes);

app.use("/api/admin", adminContabilidadRoutes)


// Probamos el servidor
app.get("/api/ping", (req, res) =>
  res.json({ ok: true, ts: new Date().toISOString() })
);

// Definimos nuestro puerto principal
const { port: PORT } = require("./config");

// ── Boot: load catalog from Firestore before serving requests ──
const catalogLoader = require("./catalog/loader");

(async () => {
  try {
    await catalogLoader.init();
    console.log("[boot] Catalog loaded successfully");
  } catch (err) {
    console.error("[boot] FATAL: Failed to load catalog from Firestore:", err.message || err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server listening on:${PORT}`);
  });
})();

