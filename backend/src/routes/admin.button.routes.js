// routes/admin.routes.js
const express = require("express");
const router = express.Router();

const { 
  cerrarCategoria,
} = require("../services/admin.actions.service");

// ------------------------------------
// 🔒 POST /admin/cerrar-categoria
// ------------------------------------
router.post("/cerrar-categoria", async (req, res) => {
  try {
    const { mesAnio, categoria, adminUsuario } = req.body;

    if (!mesAnio || !categoria) {
      return res.status(400).json({
        ok: false,
        message: "mesAnio y categoria son obligatorios",
      });
    }

    const resultado = await cerrarCategoria({
      mesAnio,
      categoria,
      adminUsuario,
    });

    return res.status(200).json({
      ok: true,
      message: "Cierre de categoría ejecutado correctamente",
      data: resultado,
    });
  } catch (error) {
    console.error("❌ Error en cierre de categoría:", error.message);

    return res.status(500).json({
      ok: false,
      message: error.message,
    });
  }
});

module.exports = router;
