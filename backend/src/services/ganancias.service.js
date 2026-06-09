// services/ganancias.service.js
// Uses repositories for all Firestore access — no direct db calls.
const contabilidadRepo = require("../repositories/contabilidad.repository");
const contableRepo = require("../repositories/contable.repository");

/**
 * Calculates and persists earnings for a category in a given month.
 * Reads from Historico_Mensual (single source of truth), validates
 * fixed and variable costs uniformly, writes Ganancias, saves a
 * historico_compras snapshot, and resets variable costs.
 *
 * @param {{ mesAnio: string, categoria: string }} params
 * @returns {Promise<object>} — the earnings payload that was saved
 */
async function cerrarGananciasPorCategoria({ mesAnio, categoria }) {
  if (!mesAnio || !categoria) {
    throw new Error("mesAnio y categoria son obligatorios");
  }

  console.log(`💰 Cerrando ganancias para ${categoria} (${mesAnio})`);

  // ────────────────────
  // 📦 HISTORICO MENSUAL
  // ────────────────────

  const historicoSnap = await contabilidadRepo.getHistoricoMensual(mesAnio);

  if (!historicoSnap) {
    throw new Error(`No existe histórico mensual para ${mesAnio}`);
  }

  const historico = historicoSnap.data();

  // ────────────────────
  // 📊 Ventas
  // ────────────────────

  const categoriaVentas = historico.totalProductos?.[categoria];

  if (!categoriaVentas || categoriaVentas.total <= 0) {
    throw new Error(`Ventas en cero para ${categoria}`);
  }

  const ventaTotal = categoriaVentas.total;

  // ────────────────────
  // 📦 Cartones
  // ────────────────────

  const cartonesTotal = historico.cartonesVendidos?.[categoria]?.total || 0;

  if (cartonesTotal <= 0) {
    throw new Error(`No hay cartones vendidos para ${categoria}`);
  }

  // ────────────────────
  // 💸 Costos fijos base
  // ────────────────────

  const costosFijosSnap = await contableRepo.getCostosFijos(categoria);

  if (!costosFijosSnap) {
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

  // ────────────────────────────────────────────────────────
  // 🐝 LOGICA ESPECIAL PARA MIEL vs LOGICA NORMAL
  // ────────────────────────────────────────────────────────

  let inversionTotal = 0;
  let costosVariablesUnit = 0;
  let costosVariablesData = {};

  if (categoria === "Miel") {
    const productos = categoriaVentas.productos || {};

    for (const [nombreProducto, dataProducto] of Object.entries(productos)) {
      const cartonesProducto = dataProducto.cartones || 0;

      if (cartonesProducto <= 0) continue;

      let costoUnitProducto = costosFijosUnit;

      // Validate variable costs per product uniformly — throw if missing
      if (["Frascos", "Botellas", "Copas"].includes(nombreProducto)) {
        const costosVarSnap = await contableRepo.getCostosVariablesPorProducto(
          "Miel",
          nombreProducto
        );

        if (!costosVarSnap) {
          throw new Error(
            `No existen costos variables para ${nombreProducto} en categoria Miel`
          );
        }

        const dataVar = costosVarSnap.data() || {};
        let sumaVar = 0;

        for (const v of Object.values(dataVar)) {
          if (typeof v === "number" && v > 0) {
            sumaVar += v;
          }
        }

        costoUnitProducto += sumaVar;
        costosVariablesUnit += sumaVar;
        costosVariablesData = { ...costosVariablesData, ...dataVar };
      }

      const inversionProducto = costoUnitProducto * cartonesProducto;
      inversionTotal += inversionProducto;
    }
  } else {
    // Non-Miel: aggregate costos_variables
    const costosVariablesSnap = await contableRepo.getCostosVariables(categoria);

    if (!costosVariablesSnap) {
      throw new Error(`No existen costos variables para ${categoria}`);
    }

    costosVariablesData = costosVariablesSnap.data() || {};

    for (const v of Object.values(costosVariablesData)) {
      if (typeof v !== "number" || v < 0) {
        throw new Error(`Costo variable inválido para ${categoria}`);
      }
      costosVariablesUnit += v;
    }

    const inversionUnit = costosFijosUnit + costosVariablesUnit;
    inversionTotal = inversionUnit * cartonesTotal;
  }

  // ────────────────────
  // 🧮 Calculos
  // ────────────────────

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

  // ────────────────────
  // ✅ Guardar ganancias
  // ────────────────────

  await contableRepo.setGanancias(mesAnio, { [categoria]: data });

  // ────────────────────
  // 🗂️ Historico de costos variables
  // ────────────────────

  await contableRepo.setHistoricoCompras(categoria, mesAnio, {
    ...costosVariablesData,
    fechaCierre: new Date(),
  });

  // ────────────────────
  // 🔄 Reiniciar costos variables
  // ────────────────────

  await contableRepo.resetCostosVariables(categoria);

  console.log(`✅ Ganancias cerradas (${categoria} - ${mesAnio})`);

  return data;
}

module.exports = { cerrarGananciasPorCategoria };
