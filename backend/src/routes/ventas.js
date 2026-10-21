// src/routes/ventas.js
const express = require("express");
const router = express.Router();
const { crearPedidoLibre } = require("../services/ventas.service");
const { createPedidoLibreRateLimiter } = require("../middlewares/rateLimit");

// El limitador va DESPUÉS del chequeo del token interno: solo el tráfico
// autenticado consume presupuesto.
const pedidoLibreRateLimiter = createPedidoLibreRateLimiter();

/**
 * Exige el token interno del sistema. Los pedidos solo pueden entrar por
 * Twilio o por el propio sistema, nunca por una llamada arbitraria.
 */
function requireInternalToken(req, res, next) {
  const internalToken = req.headers["x-internal-token"];
  const expectedToken = process.env.INTERNAL_API_TOKEN;

  if (!expectedToken || internalToken !== expectedToken) {
    return res.status(403).json({ error: "forbidden" });
  }

  return next();
}

/**
 * --------------------------👉 Endpoint para registrar pedido libre-----------------------
 */
router.post(
  "/pedido-libre",
  requireInternalToken,
  pedidoLibreRateLimiter,
  async (req, res) => {
    try {
      const { cliente, mensaje } = req.body;
      const result = await crearPedidoLibre({ cliente, mensaje });

      if (!result.ok) {
        return res.status(result.status).json(result.body);
      }

      return res.json(result.body);
    } catch (err) {
      console.error("Error creando pedido libre:", err);
      res
        .status(500)
        .json({ error: "error_creando_pedido_libre", details: err.message });
    }
  }
);

module.exports = router;
