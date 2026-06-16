// services/admin.actions.service.js
const contabilidadRepo = require("../repositories/contabilidad.repository");
const adminRepo = require("../repositories/admin.repository");
const { cerrarGananciasPorCategoria } = require("./ganancias.service");

/**
 * CIERRE ADMINISTRATIVO POR CATEGORÍA
 * 1. Calcula ganancias de la categoría
 * 2. Guarda histórico del cierre
 * 3. Resetea totales y cartones
 * 4. Elimina SKUs del mes
 * 5. Registra auditoría
 */

async function cerrarCategoria({
  mesAnio,
  categoria,
  adminUsuario = "admin",
}) {
  if (!mesAnio || !categoria) {
    throw new Error("mesAnio y categoria son obligatorios");
  }

  console.log(`🔒 Iniciando cierre administrativo: ${categoria} (${mesAnio})`);

  // ======================
  // 1️⃣ LECTURA EN PARALELO
  // ======================

  const [
    totalMesSnap,
    cartonesMesSnap,
    categoriaTotalSnap,
    categoriaCartonesSnap,
    invertirSnap,
  ] = await Promise.all([
    contabilidadRepo.getTotalProductos(mesAnio),
    contabilidadRepo.getCartonesVendidos(mesAnio),
    contabilidadRepo.getCategoriaTotal(mesAnio, categoria),
    contabilidadRepo.getCategoriaCartones(mesAnio, categoria),
    adminRepo.getInversion(categoria),
  ]);

  // ======================
  // 2️⃣ VALIDACIONES
  // ======================

  if (!totalMesSnap) {
    throw new Error(`No existe Total Productos para ${mesAnio}`);
  }

  if (!cartonesMesSnap) {
    throw new Error(`No existe Cartones_vendidos para ${mesAnio}`);
  }

  if (!invertirSnap) {
    throw new Error(`No existe inversión registrada para ${categoria}`);
  }

  if (!categoriaTotalSnap) {
    throw new Error(`La categoría ${categoria} no tiene ventas registradas`);
  }

  if (!categoriaCartonesSnap) {
    throw new Error(`La categoría ${categoria} no tiene cartones vendidos`);
  }

  const categoriaTotal = categoriaTotalSnap.data();
  const categoriaCartones = categoriaCartonesSnap.data();

  if (!categoriaTotal.total || categoriaTotal.total <= 0) {
    throw new Error(
      `La categoría ${categoria} no tiene ventas para cerrar`
    );
  }

  if (!categoriaCartones.total || categoriaCartones.total <= 0) {
    throw new Error(
      `La categoría ${categoria} no tiene cartones vendidos`
    );
  }

  // ======================
  // 3️⃣ CALCULAR GANANCIAS
  // ======================

  const gananciaCategoria = await cerrarGananciasPorCategoria({
    mesAnio,
    categoria,
  });

  if (!gananciaCategoria || gananciaCategoria.gananciaNeta === undefined) {
    throw new Error(
      `No se pudo calcular ganancia para la categoría ${categoria}`
    );
  }

  // ======================
  // 4️⃣ GUARDAR CIERRE HISTÓRICO
  // ======================

  await adminRepo.setCierreContable(mesAnio, categoria, {
    ...gananciaCategoria,
    categoria,
    mesAnio,
    ejecutadoPor: adminUsuario,
    fechaCierre: new Date(),
  });

  // ======================
  // 5️⃣ LIMPIAR SKUS Y RESETEAR TOTALES
  // ======================

  await Promise.all([
    contabilidadRepo.limpiarCategoriaTotal(mesAnio, categoria),
    contabilidadRepo.limpiarCategoriaCartones(mesAnio, categoria),
  ]);

  // ======================
  // 6️⃣ AUDITORÍA ADMIN
  // ======================

  await adminRepo.setAdminAction(mesAnio, categoria, {
    accion: "cierre_categoria",
    categoria,
    mesAnio,
    usuario: adminUsuario,
    fecha: new Date(),
  });

  console.log(`✅ Cierre completado para ${categoria} (${mesAnio})`);

  return {
    ok: true,
    categoria,
    mesAnio,
    cierreId: mesAnio,
    gananciaCategoria,
  };
}

/**
 * Consolidated audit write for monthly closing.
 * Records a summary in Cierres_contables and an admin action in AdminActions.
 * Both writes use merge for idempotency.
 *
 * @param {string} mesAnio — e.g. "Enero 2026"
 * @param {object} admin — { uid, nombre } of the admin who triggered the close
 * @param {object} snapshot — the Historico_Mensual snapshot (totalProductos, cartonesVendidos)
 * @param {Array} ganancias — array of per-category earnings results
 * @returns {Promise<void>}
 */
async function registrarCierre(mesAnio, admin, snapshot, ganancias) {
  const categorias = snapshot
    ? Object.keys(snapshot.totalProductos || {})
    : [];

  // Consolidated write to Cierres_contables/{mesAnio}
  await adminRepo.setCierreContable(mesAnio, "consolidado", {
    mesAnio,
    ejecutadoPor: admin.uid,
    usuario: admin.nombre,
    fechaCierre: new Date(),
    resumen: {
      categorias,
      totalCategorias: categorias.length,
    },
    ganancias,
  });

  // Consolidated write to AdminActions/{mesAnio}
  await adminRepo.setAdminAction(mesAnio, "cierre_mensual", {
    accion: "cierre_mensual",
    mesAnio,
    usuario: admin.nombre || admin.uid,
    fecha: new Date(),
    resumen: {
      categorias,
      totalGanancias: ganancias ? ganancias.length : 0,
    },
  });

  console.log(`📝 Cierre registrado: ${mesAnio} por ${admin.nombre || admin.uid}`);
}

module.exports = {
  cerrarCategoria,
  registrarCierre,
};
