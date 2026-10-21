// src/routes/ventas.js
const express = require("express");
const router = express.Router();
const { crearPedidoLibre } = require("../services/ventas.service");

/**
 * --------------------------👉 Endpoint para registrar pedido libre-----------------------
 */
router.post("/pedido-libre", async (req, res) => {
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
});

module.exports = router;
