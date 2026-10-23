// src/middlewares/rateLimit.js
// Rate limiters for the order-creation paths.
//
// The limiters are exposed as FACTORIES instead of module-level instances so
// that each router owns its own limiter, and therefore its own budget. A
// shared instance would leak one route's traffic into the other's.
//
// The budget lives in memory, per process: with more than one instance behind
// the load balancer the effective limit is multiplied by the number of
// instances.

const { rateLimit } = require("express-rate-limit");

/**
 * Reads the rate limit configuration from the config module.
 *
 * The require is done inside the function on purpose. The config module is
 * resolved once per process, so reading it lazily keeps the limiter in sync
 * with a reloaded config (tests, hot reload) instead of holding a stale copy
 * of the values that were current when this module was first loaded.
 *
 * @returns {{windowMs: number, max: number}}
 */
function currentConfig() {
  return require("../config").rateLimit;
}

/** Answers a rate-limited request with a 429 and a machine readable error. */
function tooManyRequests(req, res) {
  return res.status(429).json({ error: "too_many_requests" });
}

/**
 * Limiter for the Twilio webhook, keyed by the normalized sender number.
 *
 * It must be mounted AFTER `validateTwilioSignature` and
 * `authorizeAdminSender`: only authenticated traffic consumes the budget, so
 * an attacker cannot burn an administrator's quota with unsigned requests.
 *
 * Keying by sender number instead of by IP keeps administrators independent
 * from each other: one admin flooding the endpoint does not lock the others
 * out, and several admins behind the same NAT do not share a bucket.
 *
 * @returns {import("express").RequestHandler}
 */
function createWebhookRateLimiter() {
  const { windowMs, max } = currentConfig();

  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => req.adminSender?.telefono || "unknown-sender",
    handler: tooManyRequests,
  });
}

/**
 * Limiter for the internal order endpoint, keyed by client IP.
 *
 * It must be mounted AFTER the internal token check, for the same reason as
 * the webhook limiter: an unauthenticated caller must not be able to exhaust
 * the legitimate caller's budget.
 *
 * @returns {import("express").RequestHandler}
 */
function createPedidoLibreRateLimiter() {
  const { windowMs, max } = currentConfig();

  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: tooManyRequests,
  });
}

module.exports = { createWebhookRateLimiter, createPedidoLibreRateLimiter };
