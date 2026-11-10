// services/contabilidad.service.js
// Orquesta la lógica de negocio contable usando el repositorio.
// Toda la interacción con Firestore está delegada a contabilidad.repository.js

const contabilidadRepo = require("../repositories/contabilidad.repository");
const ventasRepo = require("../repositories/ventas.repository");
const catalogLoader = require("../catalog/loader");
const { obtenerMesAnio } = require("../utils/fechas");

/* ================= HISTÓRICO MENSUAL ================= */

/**
 * Generates a monthly historical snapshot from Total Productos and Cartones_vendidos.
 * Idempotent: overwrites on re-run (no existence guard).
 *
 * @param {string} mesAnio — e.g. "Enero 2026"
 * @param {object} admin — { uid, nombre } of the admin who triggered the close
 * @returns {Promise<object>} — the generated snapshot
 */
async function generarHistoricoMensual(mesAnio, admin) {
  // ── Validation guards ──────────────────────────────────────────
  if (!admin || !admin.uid) {
    throw new Error("admin.uid es obligatorio");
  }
  if (!admin || !admin.nombre) {
    throw new Error("admin.nombre es obligatorio");
  }

  const existente = await contabilidadRepo.getHistoricoMensual(mesAnio);
  if (existente) {
    throw new Error(`El histórico para ${mesAnio} ya fue generado`);
  }

  const totalProductos = {};
  const cartonesVendidos = {};

  // Leer categorías y SKUs de Total Productos
  const productosSnap = await contabilidadRepo.getCategoriasTotalProductos(mesAnio);

  for (const productoDoc of productosSnap.docs) {
    const categoria = productoDoc.id;

    totalProductos[categoria] = {
      total: productoDoc.data().total || 0,
      skus: {}
    };

    const skusSnap = await contabilidadRepo.getSkusTotalProductos(mesAnio, categoria);

    for (const skuDoc of skusSnap.docs) {
      totalProductos[categoria].skus[skuDoc.id] =
        skuDoc.data().total || 0;
    }
  }

  // Leer categorías y SKUs de Cartones Vendidos
  const productosCartonesSnap =
    await contabilidadRepo.getCategoriasCartonesVendidos(mesAnio);

  for (const productoDoc of productosCartonesSnap.docs) {
    const categoria = productoDoc.id;

    cartonesVendidos[categoria] = {
      total: productoDoc.data().total || 0,
      skus: {}
    };

    const skusSnap = await contabilidadRepo.getSkusCartonesVendidos(mesAnio, categoria);

    for (const skuDoc of skusSnap.docs) {
      cartonesVendidos[categoria].skus[skuDoc.id] =
        skuDoc.data().total || 0;
    }
  }

  // Guardar snapshot histórico with metadata
  await contabilidadRepo.setHistoricoMensual(mesAnio, {
    totalProductos,
    cartonesVendidos,
    estado: "cerrado",
    generadoEn: new Date(),
    generadoPor: admin.uid,
    usuario: admin.nombre,
  });

  return { totalProductos, cartonesVendidos };
}

/* ================= CLOSE PRECHECKS ================= */

/**
 * Fails fast when the month is already closed.
 * The freeze point is the existence of Historico_Mensual/{mesAnio}.
 *
 * @param {string} mesAnio — canonical "Mes AAAA" label
 * @throws {Error} with code "MES_YA_CERRADO"
 */
async function assertMesNoCerrado(mesAnio) {
  const cerrado = await contabilidadRepo.isMesCerrado(mesAnio);
  if (cerrado) {
    const error = new Error(`El histórico para ${mesAnio} ya fue generado`);
    error.code = "MES_YA_CERRADO";
    throw error;
  }
}

/**
 * Fails fast when paid orders for the month are still pending accounting.
 * Grouping MUST use obtenerMesAnio(fechaPedido), never the Pedidos path key.
 *
 * @param {string} mesAnio — canonical "Mes AAAA" label
 * @throws {Error} with code "PEDIDOS_PENDIENTES"
 */
async function assertSinPedidosPendientes(mesAnio) {
  const pendientesSnap = await ventasRepo.getTodosPedidosPendientesGlobal();

  const pendientesDelMes = pendientesSnap.docs.filter((doc) => {
    const pedido = doc.data();
    const fechaPedido =
      pedido.fechaPedido?.toDate?.() ?? pedido.fechaPedido;
    return (
      fechaPedido instanceof Date &&
      obtenerMesAnio(fechaPedido) === mesAnio
    );
  });

  if (pendientesDelMes.length > 0) {
    const error = new Error(
      `Quedan ${pendientesDelMes.length} pedidos pendientes en ${mesAnio}`
    );
    error.code = "PEDIDOS_PENDIENTES";
    throw error;
  }
}

/* ================= EXPORTS ================= */

module.exports = {
  generarHistoricoMensual,
  assertMesNoCerrado,
  assertSinPedidosPendientes,
  obtenerCategoria: catalogLoader.getCategoria,
  buildOperacionesContables: contabilidadRepo.buildOperacionesContables,
};
