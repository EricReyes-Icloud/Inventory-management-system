// services/contabilidad.service.js
// Orquesta la lógica de negocio contable usando el repositorio.
// Toda la interacción con Firestore está delegada a contabilidad.repository.js

const contabilidadRepo = require("../repositories/contabilidad.repository");

/* ================= HISTÓRICO MENSUAL ================= */

async function generarHistoricoMensual(mesAnio) {
  const historicoSnap = await contabilidadRepo.getHistoricoMensual(mesAnio);
  if (historicoSnap) {
    throw new Error(`El histórico de ${mesAnio} ya fue generado`);
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

  // Guardar snapshot histórico
  await contabilidadRepo.setHistoricoMensual(mesAnio, {
    totalProductos,
    cartonesVendidos,
  });
}

/* ================= EXPORTS ================= */

module.exports = {
  generarHistoricoMensual,
  obtenerCategoria: contabilidadRepo.obtenerCategoria,
  buildOperacionesContables: contabilidadRepo.buildOperacionesContables,
};
