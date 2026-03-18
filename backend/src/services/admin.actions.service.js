// services/admin.actions.service.js
const db = require("../lib/firestore");
const { cerrarGananciasPorCategoria } = require("./ganancias.service");

/**
 * 🔒 CIERRE ADMINISTRATIVO POR CATEGORÍA
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
  // 1️⃣ REFERENCIAS
  // ======================

  const totalMesRef = db.collection("Total Productos").doc(mesAnio);
  const cartonesMesRef = db.collection("Cartones_vendidos").doc(mesAnio);

  const categoriaTotalRef = totalMesRef
    .collection("productos")
    .doc(categoria);

  const categoriaCartonesRef = cartonesMesRef
    .collection("productos")
    .doc(categoria);

  const invertirRef = db.collection("Invertir").doc(categoria);

  const [
    totalMesSnap,
    cartonesMesSnap,
    categoriaTotalSnap,
    categoriaCartonesSnap,
    invertirSnap,
  ] = await Promise.all([
    totalMesRef.get(),
    cartonesMesRef.get(),
    categoriaTotalRef.get(),
    categoriaCartonesRef.get(),
    invertirRef.get(),
  ]);

  // ======================
  // 2️⃣ VALIDACIONES
  // ======================

  if (!totalMesSnap.exists) {
    throw new Error(`No existe Total Productos para ${mesAnio}`);
  }

  if (!cartonesMesSnap.exists) {
    throw new Error(`No existe Cartones_vendidos para ${mesAnio}`);
  }

  if (!invertirSnap.exists) {
    throw new Error(`No existe inversión registrada para ${categoria}`);
  }

  if (!categoriaTotalSnap.exists) {
    throw new Error(`La categoría ${categoria} no tiene ventas registradas`);
  }

  if (!categoriaCartonesSnap.exists) {
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

  await db
    .collection("Cierres_contables")
    .doc(mesAnio)
    .set(
      {
        [categoria]: {
          ...gananciaCategoria,
          categoria,
          mesAnio,
          ejecutadoPor: adminUsuario,
          fechaCierre: new Date(),
        },
      },
      { merge: true }
    );

  // ======================
  // 5️⃣ LIMPIAR SKUS
  // ======================

  const skusTotalSnap = await categoriaTotalRef.collection("skus").get();

  for (const doc of skusTotalSnap.docs) {
    await doc.ref.delete();
  }

  const skusCartonesSnap =
    await categoriaCartonesRef.collection("skus").get();

  for (const doc of skusCartonesSnap.docs) {
    await doc.ref.delete();
  }

  // ======================
  // 6️⃣ RESETEAR TOTALES
  // ======================

  await categoriaTotalRef.set(
    {
      total: 0,
      actualizadoEn: new Date(),
    },
    { merge: true }
  );

  await categoriaCartonesRef.set(
    {
      total: 0,
      actualizadoEn: new Date(),
    },
    { merge: true }
  );

  // ======================
  // 7️⃣ AUDITORÍA ADMIN
  // ======================

  await db
    .collection("AdminActions")
    .doc(mesAnio)
    .set(
      {
        [categoria]: {
          accion: "cierre_categoria",
          categoria,
          mesAnio,
          usuario: adminUsuario,
          fecha: new Date(),
        },
      },
      { merge: true }
    );

  console.log(`✅ Cierre completado para ${categoria} (${mesAnio})`);

  return {
    ok: true,
    categoria,
    mesAnio,
    cierreId: mesAnio,
    gananciaCategoria,
  };
}

module.exports = {
  cerrarCategoria,
};