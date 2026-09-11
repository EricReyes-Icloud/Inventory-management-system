// repositories/ventas.repository.js
// Capa de acceso a datos para Ventas, Pedidos y Clientes
// Ventas/{clienteId} → Pedidos/{mesAnio}/pedidos/{pedidoId}
// Clientes/{clienteId}

const db = require("../lib/firestore");

// ═══════════════════════════════════════════
// CLIENTES
// ═══════════════════════════════════════════

/**
 * Busca un cliente por nombre (normalizado, sin tildes).
 * Recorre todos los clientes comparando nombre normalizado.
 * @param {string} nombreNormalizado — nombre ya normalizado (sin tildes, lower)
 * @returns {Promise<{id: string, data: object} | null>}
 */
async function buscarClientePorNombre(nombreNormalizado) {
  const normalizar = (texto) =>
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const clientesSnap = await db.collection("Clientes").get();
  let clienteDoc = null;

  clientesSnap.forEach((doc) => {
    const nombreBD = doc.data().Nombre || "";
    if (normalizar(nombreBD) === nombreNormalizado) {
      clienteDoc = doc;
    }
  });

  return clienteDoc;
}

// ═══════════════════════════════════════════
// VENTAS (documento principal del cliente)
// ═══════════════════════════════════════════

/**
 * Obtiene el documento de Venta para un cliente.
 * @param {string} clienteId
 * @returns {Promise<FirebaseFirestore.DocumentSnapshot | null>}
 */
async function getVenta(clienteId) {
  const ref = db.collection("Ventas").doc(clienteId);
  const snap = await ref.get();
  return snap.exists ? snap : null;
}

/**
 * Crea o actualiza (merge) el documento de Venta para un cliente.
 * @param {string} clienteId
 * @param {object} data
 * @returns {Promise<void>}
 */
async function setVenta(clienteId, data) {
  await db.collection("Ventas").doc(clienteId).set(data, { merge: true });
}

// ═══════════════════════════════════════════
// PEDIDOS — MESES
// ═══════════════════════════════════════════

/**
 * Obtiene todos los meses con pedidos para un cliente.
 * @param {string} clienteId
 * @returns {Promise<FirebaseFirestore.QuerySnapshot>}
 */
async function getMesesPedidos(clienteId) {
  return db.collection("Ventas").doc(clienteId).collection("Pedidos").get();
}

/**
 * Crea o actualiza (merge) el documento de un mes de pedidos.
 * @param {string} clienteId
 * @param {string} mesAnio — ej: "Enero 2026"
 * @param {object} data
 * @returns {Promise<void>}
 */
async function setPedidoMes(clienteId, mesAnio, data) {
  await db
    .collection("Ventas")
    .doc(clienteId)
    .collection("Pedidos")
    .doc(mesAnio)
    .set(data, { merge: true });
}

// ═══════════════════════════════════════════
// PEDIDOS — DOCUMENTOS INDIVIDUALES
// ═══════════════════════════════════════════

/**
 * Obtiene todos los pedidos de un cliente para un mes.
 * @param {string} clienteId
 * @param {string} mesAnio
 * @returns {Promise<FirebaseFirestore.QuerySnapshot>}
 */
async function getPedidos(clienteId, mesAnio) {
  return db
    .collection("Ventas")
    .doc(clienteId)
    .collection("Pedidos")
    .doc(mesAnio)
    .collection("pedidos")
    .get();
}

/**
 * Obtiene los pedidos pendientes de contabilizar para un cliente/mes.
 * @param {string} clienteId
 * @param {string} mesAnio
 * @returns {Promise<FirebaseFirestore.QuerySnapshot>}
 */
async function getPedidosPendientes(clienteId, mesAnio) {
  return db
    .collection("Ventas")
    .doc(clienteId)
    .collection("Pedidos")
    .doc(mesAnio)
    .collection("pedidos")
    .where("estadoContable", "==", "pendiente")
    .get();
}

/**
 * Crea un pedido dentro de la subcolección del mes correspondiente.
 * @param {string} clienteId
 * @param {string} mesAnio
 * @param {string} pedidoId — ej: "Pedido_Id1"
 * @param {object} data
 * @returns {Promise<void>}
 */
async function crearPedido(clienteId, mesAnio, pedidoId, data) {
  await db
    .collection("Ventas")
    .doc(clienteId)
    .collection("Pedidos")
    .doc(mesAnio)
    .collection("pedidos")
    .doc(pedidoId)
    .set(data);
}

// ═══════════════════════════════════════════
// LISTADO COMPLETO (JOB CONTABLE)
// ═══════════════════════════════════════════

/**
 * Obtiene todos los documentos de la colección Ventas.
 * @returns {Promise<FirebaseFirestore.QuerySnapshot>}
 */
async function getTodosClientesConVentas() {
  return db.collection("Ventas").get();
}

// ═══════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════

module.exports = {
  // Clientes
  buscarClientePorNombre,

  // Ventas
  getVenta,
  setVenta,

  // Pedidos — meses
  getMesesPedidos,
  setPedidoMes,

  // Pedidos — docs
  getPedidos,
  getPedidosPendientes,
  crearPedido,

  // Listado completo
  getTodosClientesConVentas,
};
