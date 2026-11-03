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
// COLLECTION GROUP QUERY (JOB CONTABLE OPTIMIZADO)
// ═══════════════════════════════════════════

/**
 * Obtiene TODOS los pedidos pendientes y pagados globalmente.
 * Usa Collection Group Query — UNA sola lectura escalable.
 * Requiere índice compuesto en colección pedidos:
 *   estadoContable (ASC), pagado (ASC), fechaPedido (ASC)
 * @returns {Promise<FirebaseFirestore.QuerySnapshot>}
 */
async function getTodosPedidosPendientesGlobal() {
  return db
    .collectionGroup("pedidos")
    .where("estadoContable", "==", "pendiente")
    .where("pagado", "==", true)
    .orderBy("fechaPedido")
    .get();
}

// ═══════════════════════════════════════════
// PEDIDO CON CONSECUTIVO ATÓMICO (ANTI-RACE)
// ═══════════════════════════════════════════

/**
 * Crea un pedido con número secuencial atómico usando transacción.
 * Evita colisiones cuando dos pedidos se crean simultáneamente.
 * Usa un documento contador: Ventas/{clienteId}/Pedidos/{mesAnio}/contador
 * @param {string} clienteId - ID del cliente
 * @param {string} mesAnio - Mes-Año del pedido (ej: "Enero 2026")
 * @param {object} data - Datos completos del pedido
 * @returns {Promise<{pedidoId: string, numeroPedido: number}>}
 */
async function crearPedidoConConsecutivo(clienteId, mesAnio, data) {
  const contadorRef = db
    .collection("Ventas")
    .doc(clienteId)
    .collection("Pedidos")
    .doc(mesAnio)
    .collection("contador");

  const pedidoCollectionRef = contadorRef.collection("pedidos");

  // Verificar si existe el contador
  const contadorSnap = await contadorRef.get();

  if (!contadorSnap.exists) {
    // Primer pedido del mes - crear contador y primer pedido
    await db.runTransaction(async (transaction) => {
      const newNumero = 1;
      const pedidoId = `Pedido_Id${newNumero}`;

      // Crear documento del contador
      transaction.set(contadorRef, {
        nextNumero: 2,
        ultimaActualizacion: new Date(),
      });

      // Crear el primer pedido
      transaction.set(pedidoCollectionRef.doc(pedidoId), {
        ...data,
        pedidoId,
        numeroPedido: newNumero,
        creadoEn: new Date(),
      });
    });

    return { pedidoId: "Pedido_Id1", numeroPedido: 1 };
  }

  // Usar transacción para incremento seguro
  const result = await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(contadorRef);
    const nextNumero = snap.data().nextNumero;
    const pedidoId = `Pedido_Id${nextNumero}`;

    // Incrementar contador
    transaction.update(contadorRef, {
      nextNumero: nextNumero + 1,
      ultimaActualizacion: new Date(),
    });

    // Crear el pedido
    transaction.set(pedidoCollectionRef.doc(pedidoId), {
      ...data,
      pedidoId,
      numeroPedido: nextNumero,
      creadoEn: new Date(),
    });

    return { pedidoId, numeroPedido: nextNumero };
  });

  return result;
}

/**
 * Obtiene el siguiente número de pedido para un cliente/mes sin crear.
 * @param {string} clienteId
 * @param {string} mesAnio
 * @returns {Promise<number>}
 */
async function obtenerProximoNumeroPedido(clienteId, mesAnio) {
  const contadorRef = db
    .collection("Ventas")
    .doc(clienteId)
    .collection("Pedidos")
    .doc(mesAnio)
    .collection("contador");

  try {
    const snap = await contadorRef.get();
    return snap.exists ? snap.data().nextNumero : 1;
  } catch (error) {
    console.error("Error obteniendo numero de pedido:", error);
    return 1;
  }
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

  // Pedido con consecutivo atómico (anti-race)
  crearPedidoConConsecutivo,
  obtenerProximoNumeroPedido,

  // Listado completo
  getTodosClientesConVentas,

  // Collection Group (job contable optimizado)
  getTodosPedidosPendientesGlobal,
};
