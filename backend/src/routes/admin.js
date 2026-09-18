const express = require("express");
const router = express.Router();
const catalogLoader = require("../catalog/loader");

const jobContableMensual = require("../jobs/jobContableMensual");

// 🔐 Admin token middleware — Bearer token from ADMIN_TOKEN env var
function requireAdminToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.ADMIN_TOKEN;

  if (!expectedToken) {
    // Fail closed: without the env var the admin routes must never be open.
    return res.status(401).json({ error: "admin_token_not_configured" });
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "missing_authorization_header" });
  }

  const token = authHeader.slice(7); // Remove "Bearer "
  if (token !== expectedToken) {
    return res.status(401).json({ error: "invalid_token" });
  }

  next();
}

router.post("/job-contable", async (req, res) => {
  try {
    await jobContableMensual();
    res.json({ ok: true, mensaje: "Job contable ejecutado correctamente" });
  } catch (err) {
    console.error("Error ejecutando job contable:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 🔐 POST /recargar-catalogo — refresh catalog from Firestore at runtime
router.post("/recargar-catalogo", requireAdminToken, async (req, res) => {
  try {
    const result = await catalogLoader.refresh();
    res.json({ success: true, productos: result.productos });
  } catch (err) {
    console.error("Error recargando catálogo:", err.message || err);
    res.status(500).json({ success: false, error: err.message || "Error recargando catálogo" });
  }
});

module.exports = router;
