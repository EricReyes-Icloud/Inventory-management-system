// repositories/contabilidad.repository.js
// Capa de acceso a datos para colecciones contables
// Total Productos, Cartones_vendidos, Historico_Mensual

const db = require("../lib/firestore");
const { FieldValue } = require("firebase-admin/firestore");
const { obtenerMesAnio } = require("../utils/fechas");
const { diccionarioCategorias } = require("../utils/diccionario");
const { normalizarTexto } = require("../utils/normalizarTexto");

// ═══════════════════════════════════════════
// PATH BUILDERS
// ═══════════════════════════════════════════

function pathTotalProductos(mesAnio) {
  return `Total Productos/${mesAnio}`;
}

function pathCartonesVendidos(mesAnio) {
  return `Cartones_vendidos/${mesAnio}`;
}

function pathHistoricoMensual(mesAnio) {
  return `Historico_Mensual/${mesAnio}`;
}

// ═══════════════════════════════════════════
// UTILIDADES — CATEGORIZACIÓN
// ═══════════════════════════════════════════

/**
 * Determina la categoría de un producto según su nombre.
 * Migrada desde contabilidad.service.js
 *
 * @param {string} nombre — nombre del SKU
 * @returns {string|null}
 */
function obtenerCategoria(nombre) {
  const skuNormalizado = normalizarTexto(nombre);

  const categoriasOrdenadas = Object.keys(diccionarioCategorias)
    .sort((a, b) => {
      const aNorm = normalizarTexto(a.replace(/_/g, " "));
      const bNorm = normalizarTexto(b.replace(/_/g, " "));
      return bNorm.length - aNorm.length;
    });

  for (const categoria of categoriasOrdenadas) {
    const categoriaNormalizada = normalizarTexto(
      categoria.replace(/_/g, " ")
    );

    if (skuNormalizado.includes(categoriaNormalizada)) {
      return categoria;
    }
  }

  console.warn(`⚠️ SKU sin categoría definida: ${nombre}`);
  return null;
}

// ═══════════════════════════════════════════
// LECTURAS
// ═══════════════════════════════════════════

/**
 * Obtiene el documento de Total Productos para un mes.
 * @param {string} mesAnio — ej: "Enero 2026"
 * @returns {Promise<FirebaseFirestore.DocumentSnapshot | null>}
 */
async function getTotalProductos(mesAnio) {
  const ref = db.doc(pathTotalProductos(mesAnio));
  const snap = await ref.get();
  return snap.exists ? snap : null;
}

/**
 * Obtiene el documento de Cartones Vendidos para un mes.
 * @param {string} mesAnio
 * @returns {Promise<FirebaseFirestore.DocumentSnapshot | null>}
 */
async function getCartonesVendidos(mesAnio) {
  const ref = db.doc(pathCartonesVendidos(mesAnio));
  const snap = await ref.get();
  return snap.exists ? snap : null;
}

/**
 * Obtiene el documento del Histórico Mensual para un mes.
 * @param {string} mesAnio
 * @returns {Promise<FirebaseFirestore.DocumentSnapshot | null>}
 */
async function getHistoricoMensual(mesAnio) {
  const ref = db.doc(pathHistoricoMensual(mesAnio));
  const snap = await ref.get();
  return snap.exists ? snap : null;
}

// ═══════════════════════════════════════════
// LECTURAS — SUBS
// ═══════════════════════════════════════════

/**
 * Obtiene todas las categorías (productos) de Total Productos para un mes.
 * @param {string} mesAnio
 * @returns {Promise<FirebaseFirestore.QuerySnapshot>}
 */
async function getCategoriasTotalProductos(mesAnio) {
  return db
    .doc(pathTotalProductos(mesAnio))
    .collection("productos")
    .get();
}

/**
 * Obtiene todos los SKUs de una categoría en Total Productos.
 * @param {string} mesAnio
 * @param {string} categoria
 * @returns {Promise<FirebaseFirestore.QuerySnapshot>}
 */
async function getSkusTotalProductos(mesAnio, categoria) {
  return db
    .doc(pathTotalProductos(mesAnio))
    .collection("productos")
    .doc(categoria)
    .collection("skus")
    .get();
}

/**
 * Obtiene todas las categorías de Cartones Vendidos para un mes.
 * @param {string} mesAnio
 * @returns {Promise<FirebaseFirestore.QuerySnapshot>}
 */
async function getCategoriasCartonesVendidos(mesAnio) {
  return db
    .doc(pathCartonesVendidos(mesAnio))
    .collection("productos")
    .get();
}

/**
 * Obtiene todos los SKUs de una categoría en Cartones Vendidos.
 * @param {string} mesAnio
 * @param {string} categoria
 * @returns {Promise<FirebaseFirestore.QuerySnapshot>}
 */
async function getSkusCartonesVendidos(mesAnio, categoria) {
  return db
    .doc(pathCartonesVendidos(mesAnio))
    .collection("productos")
    .doc(categoria)
    .collection("skus")
    .get();
}

// ═══════════════════════════════════════════
// ESCRITURA — DOCUMENTO PRINCIPAL
// ═══════════════════════════════════════════

/**
 * Asegura que existan los documentos principales (merge).
 * Idempotente: si ya existen, los deja intactos.
 */
function crearOperacionDocumentoPrincipal(mesAnio) {
  return {
    ref: pathTotalProductos(mesAnio),
    data: {
      mesAnio,
      totalGeneral: FieldValue.increment(0),
      estado: "abierto",
      creadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
    },
    options: { merge: true },
  };
}

function crearOperacionCartonesPrincipal(mesAnio) {
  return {
    ref: pathCartonesVendidos(mesAnio),
    data: {
      mesAnio,
      totalGeneral: FieldValue.increment(0),
      estado: "abierto",
      creadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
    },
    options: { merge: true },
  };
}

// ═══════════════════════════════════════════
// BATCH — CONSTRUCCIÓN DE OPERACIONES
// ═══════════════════════════════════════════

/**
 * Construye las operaciones atómicas para contabilizar un pedido.
 * Migrada desde contabilidad.service.js → calcularOperacionesTotalesYCartones()
 *
 * @param {Array} items — detalle del pedido
 * @param {Date} fechaPedido
 * @returns {Array<{ref: string, data: object, options?: object}>}
 */
function buildOperacionesContables(items, fechaPedido) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Items inválidos para contabilidad");
  }

  if (!(fechaPedido instanceof Date)) {
    throw new Error("fechaPedido inválida");
  }

  const operaciones = [];
  const mesAnio = obtenerMesAnio(fechaPedido);

  // 1. Documentos principales
  operaciones.push(crearOperacionDocumentoPrincipal(mesAnio));
  operaciones.push(crearOperacionCartonesPrincipal(mesAnio));

  // 2. Procesar items
  for (const it of items) {
    const categoria = obtenerCategoria(it.nombre);
    if (!categoria) continue;

    const sku = it.nombre.toString().trim();
    const subtotal = Number(it.subtotal || 0);
    const cantidad = Number(it.cantidad || 0);

    const productoTotalPath = `${pathTotalProductos(mesAnio)}/productos/${categoria}`;
    const skuTotalPath = `${productoTotalPath}/skus/${sku}`;

    const productoCartonPath = `${pathCartonesVendidos(mesAnio)}/productos/${categoria}`;
    const skuCartonPath = `${productoCartonPath}/skus/${sku}`;

    // 💰 Dinero — Total Productos
    operaciones.push({
      ref: productoTotalPath,
      data: { total: FieldValue.increment(subtotal) },
      options: { merge: true },
    });

    operaciones.push({
      ref: skuTotalPath,
      data: { total: FieldValue.increment(subtotal) },
      options: { merge: true },
    });

    operaciones.push({
      ref: pathTotalProductos(mesAnio),
      data: {
        totalGeneral: FieldValue.increment(subtotal),
        actualizadoEn: FieldValue.serverTimestamp(),
      },
      options: { merge: true },
    });

    // 📦 Cantidad — Cartones Vendidos
    operaciones.push({
      ref: productoCartonPath,
      data: { total: FieldValue.increment(cantidad) },
      options: { merge: true },
    });

    operaciones.push({
      ref: skuCartonPath,
      data: { total: FieldValue.increment(cantidad) },
      options: { merge: true },
    });

    operaciones.push({
      ref: pathCartonesVendidos(mesAnio),
      data: {
        totalGeneral: FieldValue.increment(cantidad),
        actualizadoEn: FieldValue.serverTimestamp(),
      },
      options: { merge: true },
    });
  }

  return operaciones;
}

// ═══════════════════════════════════════════
// BATCH — EJECUCIÓN
// ═══════════════════════════════════════════

/**
 * Ejecuta un batch de operaciones atómicamente.
 * @param {Array<{ref: string, data: object, options?: object}>} operaciones
 * @returns {Promise<FirebaseFirestore.WriteResult[]>}
 */
async function executeBatch(operaciones) {
  const batch = db.batch();

  for (const op of operaciones) {
    const ref = db.doc(op.ref);
    batch.set(ref, op.data, op.options);
  }

  return batch.commit();
}

/**
 * Ejecuta un batch incluyendo updates adicionales (ej: marcar pedido).
 * @param {Array<{ref: string, data: object, options?: object}>} sets — operaciones set
 * @param {Array<{ref: string, data: object}>} updates — operaciones update
 * @returns {Promise<FirebaseFirestore.WriteResult[]>}
 */
async function executeBatchWithUpdates(sets, updates) {
  const batch = db.batch();

  for (const op of sets) {
    batch.set(db.doc(op.ref), op.data, op.options);
  }

  for (const op of updates) {
    batch.update(db.doc(op.ref), op.data);
  }

  return batch.commit();
}

// ═══════════════════════════════════════════
// ESCRITURA — HISTÓRICO MENSUAL
// ═══════════════════════════════════════════

/**
 * Guarda un snapshot del histórico mensual.
 * @param {string} mesAnio
 * @param {object} data — { totalProductos, cartonesVendidos }
 * @returns {Promise<FirebaseFirestore.WriteResult>}
 */
async function setHistoricoMensual(mesAnio, data) {
  return db.doc(pathHistoricoMensual(mesAnio)).set({
    mesAnio,
    ...data,
    estado: "cerrado",
    generadoEn: new Date(),
  });
}

// ═══════════════════════════════════════════
// LECTURAS — CATEGORÍA ESPECÍFICA
// ═══════════════════════════════════════════

/**
 * Obtiene el documento de una categoría específica en Total Productos.
 * @param {string} mesAnio
 * @param {string} categoria
 * @returns {Promise<FirebaseFirestore.DocumentSnapshot | null>}
 */
async function getCategoriaTotal(mesAnio, categoria) {
  const snap = await db
    .doc(pathTotalProductos(mesAnio))
    .collection("productos")
    .doc(categoria)
    .get();
  return snap.exists ? snap : null;
}

/**
 * Obtiene el documento de una categoría específica en Cartones Vendidos.
 * @param {string} mesAnio
 * @param {string} categoria
 * @returns {Promise<FirebaseFirestore.DocumentSnapshot | null>}
 */
async function getCategoriaCartones(mesAnio, categoria) {
  const snap = await db
    .doc(pathCartonesVendidos(mesAnio))
    .collection("productos")
    .doc(categoria)
    .get();
  return snap.exists ? snap : null;
}

// ═══════════════════════════════════════════
// ESCRITURA — LIMPIEZA DE CATEGORÍA
// ═══════════════════════════════════════════

/**
 * Elimina todos los SKUs de una categoría en Total Productos y resetea su total a 0.
 * @param {string} mesAnio
 * @param {string} categoria
 * @returns {Promise<void>}
 */
async function limpiarCategoriaTotal(mesAnio, categoria) {
  const categoriaRef = db
    .doc(pathTotalProductos(mesAnio))
    .collection("productos")
    .doc(categoria);

  // Eliminar todos los SKUs
  const skusSnap = await categoriaRef.collection("skus").get();
  const batch = db.batch();
  skusSnap.docs.forEach((doc) => batch.delete(doc.ref));

  // Resetear total
  batch.set(categoriaRef, { total: 0, actualizadoEn: new Date() }, { merge: true });

  return batch.commit();
}

/**
 * Elimina todos los SKUs de una categoría en Cartones Vendidos y resetea su total a 0.
 * @param {string} mesAnio
 * @param {string} categoria
 * @returns {Promise<void>}
 */
async function limpiarCategoriaCartones(mesAnio, categoria) {
  const categoriaRef = db
    .doc(pathCartonesVendidos(mesAnio))
    .collection("productos")
    .doc(categoria);

  // Eliminar todos los SKUs
  const skusSnap = await categoriaRef.collection("skus").get();
  const batch = db.batch();
  skusSnap.docs.forEach((doc) => batch.delete(doc.ref));

  // Resetear total
  batch.set(categoriaRef, { total: 0, actualizadoEn: new Date() }, { merge: true });

  return batch.commit();
}

// ═══════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════

module.exports = {
  // Utilidades
  obtenerCategoria,

  // Path builders
  pathTotalProductos,
  pathCartonesVendidos,
  pathHistoricoMensual,

  // Lecturas — docs principales
  getTotalProductos,
  getCartonesVendidos,
  getHistoricoMensual,

  // Lecturas — subcolecciones
  getCategoriasTotalProductos,
  getSkusTotalProductos,
  getCategoriasCartonesVendidos,
  getSkusCartonesVendidos,

  // Batch — construcción
  buildOperacionesContables,
  crearOperacionDocumentoPrincipal,
  crearOperacionCartonesPrincipal,

  // Batch — ejecución
  executeBatch,
  executeBatchWithUpdates,

  // Lecturas — categoría específica
  getCategoriaTotal,
  getCategoriaCartones,

  // Limpieza de categoría y SKUs
  limpiarCategoriaTotal,
  limpiarCategoriaCartones,

  // Escritura — histórico
  setHistoricoMensual,
};
