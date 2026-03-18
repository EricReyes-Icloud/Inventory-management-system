// src/index.js

const dotenv = require("dotenv");
dotenv.config();


require("dotenv").config();
const express = require("express");
const cors = require("cors");

const db = require("./lib/firestore");
const { verifyFirebaseToken } = require("./lib/authMiddleware");

const productosRouter = require("./routes/productos");
const ventasRouter = require("./routes/ventas");

const whatsappRoutes = require("./whatsapp/index.js");

const adminRoutes = require("./routes/admin");

const adminButtonRoutes = require("./routes/admin.button.routes.js");



const app = express();
app.use(express.json());

// CORS - en dev permite todo, en producción restringe a tu dominio
app.use(cors({ origin: true }));

app.use("/api/productos", productosRouter);
app.use("/api/ventas", ventasRouter);

app.use("/", whatsappRoutes);

app.use("/api/admin", adminRoutes);

app.use("/admin", adminButtonRoutes);



// endpoint de prueba
app.get("/api/ping", (req, res) =>
  res.json({ ok: true, ts: new Date().toISOString() })
);

// src/index.js (fragmento relevante)
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server listening on:${PORT}`);
});

