const express = require("express");
const router = express.Router();
const { adminAuth } = require("../middlewares/adminAuth");
const orchestrator = require("../services/monthlyClosing.orchestrator");

/**
 * POST /admin/contabilidad/cerrar-mes
 * Body:
 * {
 *   "mesAnio": "Febrero de 2026"
 * }
 */
router.post(
  "/cerrar-mes",
  adminAuth,
  async (req, res) => {
    try {
      const { mesAnio } = req.body;

      if (!mesAnio) {
        return res.status(400).json({
          ok: false,
          message: "mesAnio es obligatorio",
        });
      }

      const resultado = await orchestrator.cerrarMes(mesAnio, req.admin);

      return res.status(200).json({
        ok: true,
        message: `Mes ${mesAnio} cerrado correctamente`,
        data: resultado,
      });

    } catch (error) {
      console.error("❌ Error cierre mensual:", error.message);

      return res.status(400).json({
        ok: false,
        message: error.message,
      });
    }
  }
);

module.exports = router;
