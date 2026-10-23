// src/middlewares/cors.js
// CORS con allowlist de orígenes (S5).
//
// Antes: `cors({ origin: true })` — reflejaba CUALQUIER origen, así que
// cualquier sitio podía leer las respuestas de la API desde el navegador de un
// usuario con sesión iniciada.
//
// Ahora hay dos capas:
//   1. `createCorsHeaders()` — la librería cors, pero la.origin solo se
//      concede si el origen está en la allowlist.
//   2. `createCorsGuard()` — corta la request con 403 cuando el origen no
//      está permitido. Sin esta capa la request igual llegaba al handler: el
//      navegador la bloqueaba al leer la respuesta, pero el efecto del lado
//      del servidor ya había ocurrido.
//
// Una request SIN cabecera Origin no viene de un browser (Twilio, curl, un
// cron): CORS no aplica ahí y se deja pasar. La protección de ese tráfico la
// dan los tokens, no el navegador.

const cors = require("cors");

/**
 * Lee la configuración de CORS del módulo de config.
 *
 * El require es interno a propósito: config.js se resuelve una vez por
 * proceso, así que leerlo de forma lazy mantiene el middleware sincronizado
 * con un config recargado en vez de quedar con una copia vieja.
 *
 * @returns {{allowedOrigins: string[]}}
 */
function currentConfig() {
  return require("../config").cors;
}

/**
 * Decide si un origen está permitido.
 *
 * @param {string|undefined|null} origin origen de la cabecera Origin
 * @param {string[]} allowedOrigins allowlist configurada
 * @returns {boolean}
 */
function isOriginAllowed(origin, allowedOrigins) {
  // Sin cabecera Origin no hay browser detrás: la regla no aplica.
  if (!origin) return true;

  if (!Array.isArray(allowedOrigins)) return false;

  // Comodín explícito: se permite todo. Es una decisión del operador.
  if (allowedOrigins.includes("*")) return true;

  const { normalizeOrigin } = require("../config");

  return allowedOrigins.includes(normalizeOrigin(origin));
}

/**
 * Middleware que agrega las cabeceras CORS de los orígenes permitidos.
 *
 * @returns {import("express").RequestHandler}
 */
function createCorsHeaders() {
  return cors({
    origin(origin, callback) {
      const { allowedOrigins } = currentConfig();

      if (isOriginAllowed(origin, allowedOrigins)) {
        return callback(null, true);
      }

      // false => la librería no escribe ninguna cabecera CORS, así que el
      // browser bloquea la respuesta.
      return callback(null, false);
    },
  });
}

/**
 * Middleware que rechaza con 403 los orígenes que no están en la allowlist.
 *
 * @returns {import("express").RequestHandler}
 */
function createCorsGuard() {
  return function corsGuard(req, res, next) {
    const origin = req.headers.origin;

    if (!origin) return next();

    const { allowedOrigins } = currentConfig();

    if (isOriginAllowed(origin, allowedOrigins)) {
      return next();
    }

    return res.status(403).json({ error: "origin_not_allowed" });
  };
}

module.exports = { createCorsHeaders, createCorsGuard, isOriginAllowed };
