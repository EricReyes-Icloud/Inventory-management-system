// src/config.js
// Configuración centralizada del backend.
//
// La lectura de variables de entorno vive acá: ningún otro módulo debería
// leer process.env.PORT directamente. La idea es que un valor mal configurado
// falle al arrancar, con un mensaje claro, en vez de fallar en silencio más
// adelante (o peor:_BINDEAR un named pipe).

const DEFAULT_PORT = 4000;
const MAX_PORT = 65535;

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

module.exports = { port, resolvePort, DEFAULT_PORT, MAX_PORT };
