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
const PORT = process.env.PORT || 4000;

// Iniciamos el servidor
app.listen(PORT, () => {
  console.log(`Server listening on:${PORT}`);
});

