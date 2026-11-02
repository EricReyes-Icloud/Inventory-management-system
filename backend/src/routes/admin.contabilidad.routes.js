const express = require("express");
const router = express.Router();
const { adminAuth } = require("../middlewares/adminAuth");
const orchestrator = require("../services/monthlyClosing.orchestrator");
const { validateMesAnio } = require("../utils/fechas");
const { safeErrorMessage } = require("../lib/errorHandler");

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

      // Validate mesAnio format before calling service
      validateMesAnio(mesAnio);

      const resultado = await orchestrator.cerrarMes(mesAnio, req.admin);

      return res.status(200).json({
        ok: true,
        message: `Mes ${mesAnio} cerrado correctamente`,
        data: resultado,
      });

    } catch (error) {
      // Safe message for client; full detail goes to server log
      const { status, message } = safeErrorMessage(error);
      console.error("❌ Error cierre mensual:", error);

      return res.status(status).json({
        ok: false,
        message,
      });
    }
  }
);

module.exports = router;
