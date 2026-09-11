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
 * @returns {Promise<Array<{id: string, subcolecciones: object}>>}
 */
async function getAllProductos() {
  const productosSnap = await db.collection("Productos").get();
  const productos = [];

  for (const productoDoc of productosSnap.docs) {
    const productoData = { id: productoDoc.id, subcolecciones: {} };

    const subcollections = await productoDoc.ref.listCollections();
    for (const subcol of subcollections) {
      const subcolSnap = await subcol.get();
      productoData.subcolecciones[subcol.id] = subcolSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
    }

    productos.push(productoData);
  }

  return productos;
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

// ═══════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════

module.exports = {
  getProducto,
  getAllProductos,
  buscarSubcoleccion,
};
