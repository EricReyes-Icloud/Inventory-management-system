// routes/admin.routes.js
const express = require("express");
const router = express.Router();

const { 
  cerrarCategoria,
} = require("../services/admin.actions.service");

const { adminAuth } = require("../middlewares/adminAuth");

// ------------------------------------
// 🔒 POST /admin/cerrar-categoria
// ------------------------------------
// adminAuth: token de Firebase + verificación de que el usuario es
// administrador. Sin esto cualquiera podía cerrar la contabilidad de una
// categoría.
router.post("/cerrar-categoria", adminAuth, async (req, res) => {
  try {
    const { mesAnio, categoria } = req.body;

    if (!mesAnio || !categoria) {
      return res.status(400).json({
        ok: false,
        message: "mesAnio y categoria son obligatorios",
      });
    }

    const resultado = await cerrarCategoria({
      mesAnio,
      categoria,
      // El nombre del administrador sale del token verificado, no del body:
      // si viniera del body, la auditoría registraría un nombre falsificado.
      adminUsuario: req.admin?.nombre,
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
