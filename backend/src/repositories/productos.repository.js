// repositories/productos.repository.js
// Capa de acceso a datos para colección Productos
// Productos/Productos_ID/{subcoleccion}/{docId}

const db = require("../lib/firestore");

// ═══════════════════════════════════════════
// PATH BUILDERS
// ═══════════════════════════════════════════

const DOC_PRODUCTOS_ID = "Productos_ID";

function pathSubcoleccion(subcoleccion) {
  return `Productos/${DOC_PRODUCTOS_ID}/${subcoleccion}`;
}

function pathProducto(subcoleccion, docId) {
  return `Productos/${DOC_PRODUCTOS_ID}/${subcoleccion}/${docId}`;
}

// ═══════════════════════════════════════════
// LECTURAS
// ═══════════════════════════════════════════

/**
 * Obtiene un producto específico por subcolección y docId.
 * @param {string} subcoleccion — ej: "Clavo * 100"
 * @param {string} docId — ej: "Clavo_1"
 * @returns {Promise<FirebaseFirestore.DocumentSnapshot | null>}
 */
async function getProducto(subcoleccion, docId) {
  const ref = db
    .collection("Productos")
    .doc(DOC_PRODUCTOS_ID)
    .collection(subcoleccion)
    .doc(docId);

  const snap = await ref.get();
  return snap.exists ? snap : null;
}

/**
 * Obtiene todos los productos con sus subcolecciones.
 * Optimizado con lecturas paralelas (batch=10) para reducir tiempo de ejecución.
 * @returns {Promise<Array<{id: string, subcolecciones: object}>>}
 */
async function getAllProductos() {
  const productosSnap = await db.collection("Productos").get();
  const BATCH_SIZE = 10;
  const promises = [];

  for (const productoDoc of productosSnap.docs) {
    const itemPromise = (async () => {
      const subcolecciones = await productoDoc.ref.listCollections();
      const subcoleccionesData = {};

      const subcolPromises = subcolecciones.map(async (subcol) => {
        const subcolSnap = await subcol.get();
        subcoleccionesData[subcol.id] = subcolSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
      });

      await Promise.all(subcolPromises);
      return { id: productoDoc.id, subcolecciones: subcoleccionesData };
    })();

    promises.push(itemPromise);
  }

  return Promise.all(promises);
}

/**
 * Busca el primer documento de una subcolección por nombre.
 * @param {string} nombreSubcoleccion
 * @returns {Promise<FirebaseFirestore.DocumentSnapshot | null>}
 */
async function buscarSubcoleccion(nombreSubcoleccion) {
  const subcolSnap = await db
    .collection("Productos")
    .doc(DOC_PRODUCTOS_ID)
    .collection(nombreSubcoleccion)
    .limit(1)
    .get();

  if (subcolSnap.empty) return null;
  return subcolSnap.docs[0];
}

/**
 * Bulk read of all products including sinonimos and categoria fields.
 * Returns a flat array of product objects for catalog loading.
 * @returns {Promise<Array<{nombre: string, sinonimos: string[], categoria: string|null}>>}
 */
async function getCatalogo() {
  const productosSnap = await db.collection("Productos").get();
  const catalogo = [];

  for (const productoDoc of productosSnap.docs) {
    const subcollections = await productoDoc.ref.listCollections();
    for (const subcol of subcollections) {
      const subcolSnap = await subcol.get();
      if (subcolSnap.empty) continue;

      const firstDoc = subcolSnap.docs[0];
      const data = firstDoc.data();

      catalogo.push({
        nombre: data.nombreCanonico || subcol.id,
        sinonimos: Array.isArray(data.sinonimos) ? data.sinonimos : [],
        categoria: data.categoria || null,
      });
    }
  }

  return catalogo;
}

// ═══════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════

module.exports = {
  getProducto,
  getAllProductos,
  buscarSubcoleccion,
  getCatalogo,
};
