// routes/admin.routes.js
const express = require("express");
const router = express.Router();

const {
  cerrarCategoria,
} = require("../services/admin.actions.service");

const { adminAuth } = require("../middlewares/adminAuth");
const { validateMesAnio } = require("../utils/fechas");
const { safeErrorMessage } = require("../lib/errorHandler");

// ------------------------------------
// 🔒 POST /admin/cerrar-categoria
// ------------------------------------
// adminAuth: token de Firebase + verificación de que el usuario es
// administrador. Sin esto cualquiera podía cerrar la contabilidad de una
// categoría.
router.post("/cerrar-categoria", adminAuth, async (req, res) => {
  try {
    const { mesAnio, categoria } = req.body;

    // Validate mesAnio format before calling service
    validateMesAnio(mesAnio);

    if (!categoria || typeof categoria !== "string" || !categoria.trim()) {
      return res.status(400).json({
        ok: false,
        message: "categoria es obligatoria",
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
    // Safe message for client; full detail goes to server log
    const { status, message } = safeErrorMessage(error);
    console.error("❌ Error en cierre de categoría:", error);

    return res.status(status).json({
      ok: false,
      message,
    });
  }
});

module.exports = router;
