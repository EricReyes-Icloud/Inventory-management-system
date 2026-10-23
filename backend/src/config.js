// src/config.js
// Configuración centralizada del backend.
//
// La lectura de variables de entorno vive acá: ningún otro módulo debería
// leer process.env.PORT directamente. La idea es que un valor mal configurado
// falle al arrancar, con un mensaje claro, en vez de fallar en silencio más
// adelante (o peor:_BINDEAR un named pipe).

const DEFAULT_PORT = 4000;
const MAX_PORT = 65535;

// Ventana y tope por defecto del rate limiting de los endpoints de creación
// de pedidos: 15 minutos / 60 requests.
const DEFAULT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_RATE_LIMIT_MAX = 60;

/**
 * Resuelve el puerto desde un valor crudo de entorno.
 *
 * Acepta: undefined, null o string vacío → DEFAULT_PORT.
 * Acepta: string con dígitos únicamente, entre 0 y 65535.
 * Lanza:  cualquier otro valor (no entero, fuera de rango, hex, decimal...).
 *
 * El caso "4a00" es el que importa: net.Server.listen("4a00") no abre un
 * puerto TCP, bindea un named pipe Unix. Sin esta validación el proceso
 * levanta "correctamente" y queda escuchando donde nadie lo espera.
 *
 * @param {string|number|undefined|null} raw
 * @returns {number} puerto válido
 */
function resolvePort(raw) {
  if (raw === undefined || raw === null) {
    return DEFAULT_PORT;
  }

  const value = String(raw).trim();
  if (value === "") {
    return DEFAULT_PORT;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error(
      `Invalid PORT "${raw}": expected an integer between 0 and ${MAX_PORT}`
    );
  }

  const port = Number(value);
  if (port > MAX_PORT) {
    throw new Error(
      `Invalid PORT "${raw}": expected an integer between 0 and ${MAX_PORT}`
    );
  }

  return port;
}

// Puerto de escucha del servidor, resuelto una vez por proceso.
const port = resolvePort(process.env.PORT);

/**
 * Resuelve un entero positivo desde un valor crudo de entorno.
 *
 * Acepta: undefined, null o string vacío → fallback.
 * Acepta: string con dígitos únicamente y mayor que 0.
 * Lanza:  cualquier otro valor (cero, negativo, decimal, notación científica).
 *
 * El caso "0" es el que importa: un rate limit de 0 desactiva la protección
 * en silencio, así que se trata como configuración inválida y falla al
 * arrancar, igual que un PORT inválido.
 *
 * @param {string|number|undefined|null} raw
 * @param {number} fallback valor por defecto
 * @param {string} label nombre de la variable, para el mensaje de error
 * @returns {number} entero positivo
 */
function resolvePositiveInt(raw, fallback, label) {
  if (raw === undefined || raw === null) {
    return fallback;
  }

  const value = String(raw).trim();
  if (value === "") {
    return fallback;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error(
      `Invalid ${label} "${raw}": expected a positive integer`
    );
  }

  const parsed = Number(value);
  if (parsed <= 0) {
    throw new Error(
      `Invalid ${label} "${raw}": expected a positive integer`
    );
  }

  return parsed;
}

/**
 * Normaliza un origen de CORS.
 *
 * Un origin de browser es "esquema://host[:puerto]", sin path ni barra final.
 * La comparación tiene que ser exacta: "https://app.com" y "https://app.com/"
 * son el mismo origen, y "https://app.com.evil.com" es otro distinto.
 *
 * @param {string|undefined|null} value
 * @returns {string} origen normalizado, "" si no hay valor, "*" si es el comodín
 */
function normalizeOrigin(value) {
  const trimmed = String(value ?? "").trim();

  if (trimmed === "") return "";
  if (trimmed === "*") return "*";

  try {
    // URL normaliza esquema y host a minúsculas y descarta el puerto por
    // defecto y el path.
    return new URL(trimmed).origin;
  } catch {
    // Origen inválido: se conserva tal cual (sin barra final) para que el
    // error sea visible en la comparación y no se acepte por accidente.
    return trimmed.replace(/\/+$/, "");
  }
}

/**
 * Parsea la lista de orígenes permitidos de CORS.
 *
 * Acepta: undefined, null o string vacío → lista vacía (fail closed).
 * Acepta: lista separada por comas; cada entrada se recorta y se normaliza.
 *
 * @param {string|undefined|null} raw
 * @returns {string[]} lista de orígenes normalizados
 */
function parseAllowedOrigins(raw) {
  if (raw === undefined || raw === null) return [];

  const value = String(raw).trim();
  if (value === "") return [];

  return value
    .split(",")
    .map(normalizeOrigin)
    .filter((origin) => origin !== "");
}

/**
 * Parsea la lista de números de administradores autorizados de WhatsApp.
 *
 * Acepta: undefined, null o string vacío → lista vacía (fail closed).
 * Acepta: lista separada por comas; cada entrada se recorta y las entradas
 * vacías se descartan. No valida el formato del teléfono: la normalización a
 * E.164 es responsabilidad del módulo de WhatsApp.
 *
 * @param {string|undefined|null} raw
 * @returns {string[]} lista de números tal como vienen configurados
 */
function parseAdminAllowedNumbers(raw) {
  if (raw === undefined || raw === null) return [];

  const value = String(raw).trim();
  if (value === "") return [];

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}

// Rate limiting de los endpoints de creación de pedidos, resuelto una vez por
// proceso igual que el puerto.
const rateLimit = {
  windowMs: resolvePositiveInt(
    process.env.RATE_LIMIT_WINDOW_MS,
    DEFAULT_RATE_LIMIT_WINDOW_MS,
    "RATE_LIMIT_WINDOW_MS"
  ),
  max: resolvePositiveInt(
    process.env.RATE_LIMIT_MAX,
    DEFAULT_RATE_LIMIT_MAX,
    "RATE_LIMIT_MAX"
  ),
};

// Orígenes permitidos para CORS (S5), resueltos una vez por proceso.
//
// Fail closed: sin CORS_ALLOWED_ORIGINS la lista queda vacía y el backend
// rechaza TODOS los orígenes de navegador. El tráfico servidor a servidor
// (Twilio, curl, cron) no manda la cabecera Origin y sigue entrando normal.
const cors = {
  allowedOrigins: parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS),
};

// Números autorizados a crear pedidos por WhatsApp (S2), resueltos una vez
// por proceso.
//
// Fail closed: sin ADMIN_ALLOWED_NUMBERS la lista queda vacía y el webhook
// rechaza con 403 a TODOS los remitentes. La lista de Firestore sigue siendo
// la segunda verificación (el número además tiene que existir como admin).
const admin = {
  allowedNumbers: parseAdminAllowedNumbers(process.env.ADMIN_ALLOWED_NUMBERS),
};

module.exports = {
  port,
  resolvePort,
  DEFAULT_PORT,
  MAX_PORT,
  rateLimit,
  resolvePositiveInt,
  DEFAULT_RATE_LIMIT_WINDOW_MS,
  DEFAULT_RATE_LIMIT_MAX,
  cors,
  parseAllowedOrigins,
  normalizeOrigin,
  admin,
  parseAdminAllowedNumbers,
};
