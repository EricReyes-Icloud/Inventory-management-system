// src/routes/productos.js
const express = require("express");
const router = express.Router();
const productosRepo = require("../repositories/productos.repository");

// GET /api/productos -> lista productos con sus subcolecciones
router.get("/", async (req, res) => {
  try {
    const productos = await productosRepo.getAllProductos();
    res.json(productos);
  } catch (err) {
    console.error("Error obteniendo productos:", err);
    res.status(500).json({ error: "error_listando_productos" });
  }
});

module.exports = router;
