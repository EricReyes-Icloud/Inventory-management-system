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

      // Obtenemos todas las subcolecciones dinamicamente
      const subcollections = await productoDoc.ref.listCollections();
      for (const subcol of subcollections) {
        const subcolSnap = await subcol.get(); // Traermos todos los documentos de esa coleccion
        productoData.subcolecciones[subcol.id] = subcolSnap.docs.map((d) => ({
          id: d.id,                        // Con .map transformamos los documentos en objetos planos
          ...d.data(), // Expandemos los campos
        }));
      }

      productos.push(productoData); // Vamos construyendo el resultado final
    }

    res.json(productos);
    
  } catch (err) {
    console.error("Error obteniendo productos:", err);
    res.status(500).json({ error: "error_listando_productos" });
  }
});

module.exports = router;
