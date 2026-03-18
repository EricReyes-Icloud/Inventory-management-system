// src/routes/productos.js
const express = require("express");
const db = require("../lib/firestore");
const router = express.Router();

// GET /api/productos -> lista productos con sus subcolecciones
router.get("/", async (req, res) => {
  try {
    const productosSnap = await db.collection("Productos").get();
    const productos = [];

    for (const productoDoc of productosSnap.docs) {
      const productoData = { id: productoDoc.id, subcolecciones: {} };

      // Obtener todas las subcolecciones dinámicamente
      const subcollections = await productoDoc.ref.listCollections();
      for (const subcol of subcollections) {
        const subcolSnap = await subcol.get();
        productoData.subcolecciones[subcol.id] = subcolSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
      }

      productos.push(productoData);
    }

    res.json(productos);
  } catch (err) {
    console.error("Error obteniendo productos:", err);
    res.status(500).json({ error: "error_listando_productos" });
  }
});

module.exports = router;
