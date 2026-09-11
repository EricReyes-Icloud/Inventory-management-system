// repositories/contable.repository.js
// Data access layer for contable operations
// Invertir subcollections, Ganancias, Historico Compras

const db = require("../lib/firestore");

// ═══════════════════════════════════════════
// READ — INVERTIR
// ═══════════════════════════════════════════

/**
 * Retrieves the Invertir document for a category.
 * @param {string} categoria
 * @returns {Promise<FirebaseFirestore.DocumentSnapshot | null>}
 */
async function getInvertir(categoria) {
  const ref = db.collection("Invertir").doc(categoria);
  const snap = await ref.get();
  return snap.exists ? snap : null;
}

/**
 * Retrieves the costos_fijos document for a category.
 * @param {string} categoria
 * @returns {Promise<FirebaseFirestore.DocumentSnapshot | null>}
 */
async function getCostosFijos(categoria) {
  const ref = db
    .collection("Invertir")
    .doc(categoria)
    .collection("costos_fijos")
    .doc("costos_fijos");
  const snap = await ref.get();
  return snap.exists ? snap : null;
}

/**
 * Retrieves the aggregate costos_variables document for a category.
 * @param {string} categoria
 * @returns {Promise<FirebaseFirestore.DocumentSnapshot | null>}
 */
async function getCostosVariables(categoria) {
  const ref = db
    .collection("Invertir")
    .doc(categoria)
    .collection("costos_variables")
    .doc("costos_variables");
  const snap = await ref.get();
  return snap.exists ? snap : null;
}

/**
 * Retrieves the costos_variables document for a specific product.
 * @param {string} categoria
 * @param {string} producto
 * @returns {Promise<FirebaseFirestore.DocumentSnapshot | null>}
 */
async function getCostosVariablesPorProducto(categoria, producto) {
  const ref = db
    .collection("Invertir")
    .doc(categoria)
    .collection("costos_variables")
    .doc(producto);
  const snap = await ref.get();
  return snap.exists ? snap : null;
}

// ═══════════════════════════════════════════
// READ — GANANCIAS
// ═══════════════════════════════════════════

/**
 * Retrieves the Ganancias document for a month.
 * @param {string} mesAnio
 * @returns {Promise<FirebaseFirestore.DocumentSnapshot | null>}
 */
async function getGanancias(mesAnio) {
  const ref = db.collection("Ganancias").doc(mesAnio);
  const snap = await ref.get();
  return snap.exists ? snap : null;
}

// ═══════════════════════════════════════════
// WRITE — GANANCIAS
// ═══════════════════════════════════════════

/**
 * Sets the Ganancias document for a month (merge).
 * @param {string} mesAnio
 * @param {object} data
 * @returns {Promise<FirebaseFirestore.WriteResult>}
 */
async function setGanancias(mesAnio, data) {
  return db.collection("Ganancias").doc(mesAnio).set(data, { merge: true });
}

// ═══════════════════════════════════════════
// WRITE — HISTORICO COMPRAS
// ═══════════════════════════════════════════

/**
 * Sets the historico_compras document for a category/month (merge).
 * @param {string} categoria
 * @param {string} mesAnio
 * @param {object} data
 * @returns {Promise<FirebaseFirestore.WriteResult>}
 */
async function setHistoricoCompras(categoria, mesAnio, data) {
  return db
    .collection("Invertir")
    .doc(categoria)
    .collection("historico_compras")
    .doc(mesAnio)
    .set(data, { merge: true });
}

// ═══════════════════════════════════════════
// WRITE — RESET COSTOS VARIABLES
// ═══════════════════════════════════════════

/**
 * Resets all numeric fields in the aggregate costos_variables document to zero.
 * Reads the current document, extracts numeric keys, and writes a zero map.
 * If the document does not exist or has no numeric fields, this is a no-op.
 * @param {string} categoria
 * @returns {Promise<void>}
 */
async function resetCostosVariables(categoria) {
  const snap = await getCostosVariables(categoria);

  if (!snap || !snap.exists) {
    return;
  }

  const data = snap.data();
  const zeroMap = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "number") {
      zeroMap[key] = 0;
    }
  }

  if (Object.keys(zeroMap).length === 0) {
    return;
  }

  const ref = db
    .collection("Invertir")
    .doc(categoria)
    .collection("costos_variables")
    .doc("costos_variables");

  return ref.set(zeroMap, { merge: true });
}

// ═══════════════════════════════════════════
// WRITE — COSTOS VARIABLES POR PRODUCTO
// ═══════════════════════════════════════════

/**
 * Sets the costos_variables document for a specific product (merge).
 * @param {string} categoria
 * @param {string} producto
 * @param {object} data
 * @returns {Promise<FirebaseFirestore.WriteResult>}
 */
async function setCostosVariablePorProducto(categoria, producto, data) {
  return db
    .collection("Invertir")
    .doc(categoria)
    .collection("costos_variables")
    .doc(producto)
    .set(data, { merge: true });
}

// ═══════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════

module.exports = {
  getInvertir,
  getCostosFijos,
  getCostosVariables,
  getCostosVariablesPorProducto,
  getGanancias,
  setGanancias,
  setHistoricoCompras,
  resetCostosVariables,
  setCostosVariablePorProducto,
};
