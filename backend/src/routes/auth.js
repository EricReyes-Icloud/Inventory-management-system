// src/routes/auth.js
// T2 / S2: POST /api/auth/login.
//
// Transport only: the Firebase ID token is validated by the service. This
// router validates the request shape, applies the login rate limiter and maps
// business errors to stable HTTP codes.

const express = require("express");
const { loginWithIdToken } = require("../services/auth.service");
const { createLoginRateLimiter } = require("../middlewares/rateLimit");
const { adminAuth } = require("../middlewares/adminAuth");

const router = express.Router();

const ERROR_STATUS = {
  invalid_request: 400,
  invalid_token: 401,
  admin_not_found: 403,
};

// Read-only session check used by the frontend route guard. Reuses adminAuth
// so a valid token from a non-admin is rejected with the same rules as the
// existing admin endpoints.
router.get("/me", adminAuth, (req, res) => {
  return res.status(200).json({ ok: true, admin: req.admin });
});

router.post("/login", createLoginRateLimiter(), async (req, res) => {
  const idToken = req.body && req.body.idToken;

  if (typeof idToken !== "string" || idToken.trim() === "") {
    return res.status(400).json({ error: "invalid_request" });
  }

  try {
    const result = await loginWithIdToken(idToken);
    return res.status(200).json(result);
  } catch (error) {
    const code = error && error.code;
    const status = ERROR_STATUS[code];
    if (status) {
      return res.status(status).json({ error: code });
    }
    return res.status(500).json({ error: "internal_error" });
  }
});

module.exports = router;
