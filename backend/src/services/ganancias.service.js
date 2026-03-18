// services/ganancias.service.js
const db = require("../lib/firestore");

/**
 * 💰 Calcula y guarda ganancias por categoría y mes
 * 📌 USA EL HISTÓRICO MENSUAL (NO los acumuladores vivos)
 */

async function cerrarGananciasPorCategoria({ mesAnio, categoria }) {
  if (!mesAnio || !categoria) {
    throw new Error("mesAnio y categoria son obligatorios");
  }

  console.log(`💰 Cerrando ganancias para ${categoria} (${mesAnio})`);


  // --------------------
  // 📦 HISTÓRICO MENSUAL
  // --------------------

  const historicoSnap = await db
    .collection("Historico_Mensual")
    .doc(mesAnio)
    .get();

  if (!historicoSnap.exists) {
    throw new Error(`No existe histórico mensual para ${mesAnio}`);
  }

  const historico = historicoSnap.data();

  // --------------------
  // 📊 Ventas
  // --------------------

  const categoriaVentas = historico.totalProductos?.[categoria];

  if (!categoriaVentas || categoriaVentas.total <= 0) {
    throw new Error(`Ventas en cero para ${categoria}`);
  }

  const ventaTotal = categoriaVentas.total;

  // --------------------
  // 📦 Cartones
  // --------------------

  const cartonesTotal =
    historico.cartonesVendidos?.[categoria]?.total || 0;

  if (cartonesTotal <= 0) {
    throw new Error(`No hay cartones vendidos para ${categoria}`);
  }

  // --------------------
  // 💸 Costos fijos base
  // --------------------

  const costosFijosSnap = await db
    .collection("Invertir")
    .doc(categoria)
    .collection("costos_fijos")
    .doc("costos_fijos")
    .get();

  if (!costosFijosSnap.exists) {
    throw new Error(`No existen costos fijos para ${categoria}`);
  }

  const costosFijosData = costosFijosSnap.data() || {};
  let costosFijosUnit = 0;

  for (const v of Object.values(costosFijosData)) {
    if (typeof v !== "number" || v < 0) {
      throw new Error(`Costo fijo inválido para ${categoria}`);
    }
    costosFijosUnit += v;
  }

  // =====================================================
  // 🐝 LÓGICA ESPECIAL PARA MIEL
  // =====================================================

  let inversionTotal = 0;
  let costosVariablesUnit = 0;

  if (categoria === "Miel") {
    const productos = categoriaVentas.productos || {};

    for (const [nombreProducto, dataProducto] of Object.entries(productos)) {
      const ventaProducto = dataProducto.total || 0;
      const cartonesProducto = dataProducto.cartones || 0;

      if (cartonesProducto <= 0) continue;

      let costoUnitProducto = costosFijosUnit;

      // 🔥 Si es uno de los productos especiales
      if (["Frascos", "Botellas", "Copas"].includes(nombreProducto)) {
        const costosVarSnap = await db
          .collection("Invertir")
          .doc("Miel")
          .collection("costos_variables")
          .doc(nombreProducto)
          .get();

        if (costosVarSnap.exists) {
          const dataVar = costosVarSnap.data();
          let sumaVar = 0;

          for (const v of Object.values(dataVar)) {
            if (typeof v === "number" && v > 0) {
              sumaVar += v;
            }
          }

          costoUnitProducto += sumaVar;
          costosVariablesUnit += sumaVar;
        }
      }

      const inversionProducto = costoUnitProducto * cartonesProducto;
      inversionTotal += inversionProducto;
    }
  } else {
    // =====================================================
    // 🔵 LÓGICA NORMAL (NO SE TOCA)
    // =====================================================
    const costosVariablesSnap = await db
      .collection("Invertir")
      .doc(categoria)
      .collection("costos_variables")
      .doc("costos_variables")
      .get();

    if (!costosVariablesSnap.exists) {
      throw new Error(`No existen costos variables para ${categoria}`);
    }

    const costosVariablesData = costosVariablesSnap.data() || {};

    for (const v of Object.values(costosVariablesData)) {
      if (typeof v !== "number" || v < 0) {
        throw new Error(`Costo variable inválido para ${categoria}`);
      }
      costosVariablesUnit += v;
    }

    const inversionUnit = costosFijosUnit + costosVariablesUnit;
    inversionTotal = inversionUnit * cartonesTotal;
  }

  // --------------------
  // 🧮 Cálculos
  // --------------------

  const gananciaNeta = ventaTotal - inversionTotal;

  const data = {
    categoria,
    mesAnio,
    ventaTotal,
    cartones: cartonesTotal,
    costosFijosUnit,
    costosVariablesUnit,
    inversionTotal,
    gananciaNeta,
    estado: "cerrado",
    fechaCierre: new Date(),
  };

  // --------------------
  // ✅ Guardar ganancias
  // --------------------

  await db
    .collection("Ganancias")
    .doc(mesAnio)
    .set({ [categoria]: data }, { merge: true });


  // --------------------
  // 🗂️ Histórico de costos variables
  // --------------------

  await db
    .collection("Invertir")
    .doc(categoria)
    .collection("historico_compras")
    .doc(mesAnio)
    .set(
      {
        ...costosVariablesData,
        fechaCierre: new Date(),
      },
      { merge: true }
    );


  // --------------------
  // 🔄 Reiniciar costos variables
  // --------------------
  
  const resetData = {};
  for (const key of Object.keys(costosVariablesData)) {
    resetData[key] = 0;
  }

  await costosVariablesRef.set(resetData, { merge: true });





  console.log(`✅ Ganancias cerradas (${categoria} - ${mesAnio})`);

  return data;
}

module.exports = { cerrarGananciasPorCategoria };
