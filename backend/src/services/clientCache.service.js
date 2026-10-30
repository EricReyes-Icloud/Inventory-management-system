// clientCache.service.js
// Cache en memoria de nombres de clientes desde Firestore.
// Evita una lectura a Firestore por cada webhook de WhatsApp.
//
// Uso:
//   const { getNombresClients, invalidateCache } = require("./clientCache.service");
//   const nombres = await getNombresClients(); // siempre devuelve un array
//   invalidateCache(); // fuerza nueva lectura la próxima vez
//
// La caché se renueva automáticamente después de CLIENT_TTL_MS (5 minutos).

const db = require("../lib/firestore");

const CLIENT_TTL_MS = parseInt(process.env.CLIENT_CACHE_TTL_MS, 10) || 300000; // 5 min

// Estado interno
let cachedNames = /** @type {string[]} */ ([]);
let lastFetchTime = 0;

/**
 * Normaliza un nombre de cliente: lower + sin tildes.
 * @param {string} nombre
 * @returns {string}
 */
function normalizarNombre(nome) {
  if (!nome) return "";
  return String(nome)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Carga todos los nombres de clientes desde Firestore.
 * Devuelve un array vacío en caso de error o colección vacía.
 * @returns {Promise<string[]>}
 */
async function fetchFromFirestore() {
  try {
    const snap = await db.collection("Clients").get();
    if (snap.empty) return [];
    const names = snap.docs.map((doc) => {
      const raw = doc.data().Name || doc.data().Nombre || doc.id;
      return normalizarNombre(raw);
    });
    // Orden descendente por longitud: "juan carlos" se prueba antes que "juan"
    names.sort((a, b) => b.length - a.length);
    return names;
  } catch (err) {
    console.error("[clientCache] Error fetching client names from Firestore:", err.message);
    return [];
  }
}

/**
 * Retorna los nombres de clientes (cacheados si están frescos).
 * @returns {Promise<string[]>}
 */
async function getNombresClients() {
  const now = Date.now();
  if (cachedNames.length === 0 || now - lastFetchTime >= CLIENT_TTL_MS) {
    cachedNames = await fetchFromFirestore();
    lastFetchTime = now;
  }
  return cachedNames;
}

/**
 * Invalida la caché explícitamente.
 * La próxima llamada a getNombresClients() forzará una nueva lectura.
 */
function invalidateCache() {
  cachedNames = [];
  lastFetchTime = 0;
}

module.exports = {
  getNombresClients,
  invalidateCache,
  CLIENT_TTL_MS,
};