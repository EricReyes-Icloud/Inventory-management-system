const express = require("express");
const router = express.Router();

const jobContableMensual = require("../jobs/jobContableMensual");

// 🔐 (opcional pero recomendado)
// middleware de autenticación admin

router.post("/job-contable", async (req, res) => {
  try {
    await jobContableMensual();
    res.json({ ok: true, mensaje: "Job contable ejecutado correctamente" });
  } catch (err) {
    console.error("Error ejecutando job contable:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
