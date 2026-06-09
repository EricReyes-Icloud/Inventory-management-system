// services/monthlyClosing.orchestrator.js
// 4-stage pipeline for monthly closing: pending orders → snapshot → earnings → audit

const { processPendingOrders } = require("../jobs/jobContableMensual");
const contabilidadService = require("./contabilidad.service");
const gananciasService = require("./ganancias.service");
const adminActionsService = require("./admin.actions.service");

/**
 * Orchestrates the full monthly closing pipeline.
 *
 * Stages (strict order):
 *   1. processPendingOrders() — process any unaccounted orders
 *   2. contabilidadService.generarHistoricoMensual() — snapshot
 *   3. For each category: gananciasService.cerrarGananciasPorCategoria()
 *   4. adminActionsService.registrarCierre() — consolidated audit
 *
 * Idempotent: all downstream writes use merge semantics, so re-running
 * for the same mesAnio overwrites data safely.
 *
 * @param {string} mesAnio — e.g. "Enero 2026"
 * @param {string} adminUid — Firebase Auth UID of the admin triggering the close
 * @returns {Promise<{ mesAnio: string, snapshot: object, ganancias: object[], audit: void }>}
 */
async function cerrarMes(mesAnio, adminUid) {
  if (!mesAnio) {
    throw new Error("mesAnio es obligatorio");
  }

  console.log(`🏁 Iniciando cierre mensual: ${mesAnio} por ${adminUid}`);

  // ──────────────────────────────────────────────────
  // Stage 1: Process pending orders
  // ──────────────────────────────────────────────────
  try {
    console.log("📋 Stage 1/4: Procesando pedidos pendientes...");
    await processPendingOrders();
    console.log("✅ Stage 1/4: Pedidos pendientes procesados");
  } catch (error) {
    console.error(`❌ Stage 1/4 (processPendingOrders) falló: ${error.message}`);
    throw new Error(`Error en etapa 1 (procesar pedidos): ${error.message}`);
  }

  // ──────────────────────────────────────────────────
  // Stage 2: Generate monthly snapshot
  // ──────────────────────────────────────────────────
  let snapshot;
  try {
    console.log("📸 Stage 2/4: Generando histórico mensual...");
    snapshot = await contabilidadService.generarHistoricoMensual(mesAnio, adminUid);
    console.log("✅ Stage 2/4: Histórico mensual generado");
  } catch (error) {
    console.error(`❌ Stage 2/4 (generarHistoricoMensual) falló: ${error.message}`);
    throw new Error(`Error en etapa 2 (generar histórico): ${error.message}`);
  }

  // ──────────────────────────────────────────────────
  // Stage 3: Calculate earnings per category
  // ──────────────────────────────────────────────────
  let ganancias = [];
  try {
    console.log("💰 Stage 3/4: Calculando ganancias por categoría...");
    const categorias = Object.keys(snapshot.totalProductos || {});

    for (const categoria of categorias) {
      const resultado = await gananciasService.cerrarGananciasPorCategoria({
        mesAnio,
        categoria,
      });
      ganancias.push(resultado);
    }
    console.log(`✅ Stage 3/4: Ganancias calculadas para ${categorias.length} categorías`);
  } catch (error) {
    console.error(`❌ Stage 3/4 (cerrarGananciasPorCategoria) falló: ${error.message}`);
    throw new Error(`Error en etapa 3 (calcular ganancias): ${error.message}`);
  }

  // ──────────────────────────────────────────────────
  // Stage 4: Register audit trail
  // ──────────────────────────────────────────────────
  try {
    console.log("📝 Stage 4/4: Registrando cierre...");
    await adminActionsService.registrarCierre(mesAnio, adminUid, snapshot, ganancias);
    console.log("✅ Stage 4/4: Cierre registrado");
  } catch (error) {
    console.error(`❌ Stage 4/4 (registrarCierre) falló: ${error.message}`);
    throw new Error(`Error en etapa 4 (registrar cierre): ${error.message}`);
  }

  console.log(`🏁 Cierre mensual completado: ${mesAnio}`);

  return {
    mesAnio,
    snapshot,
    ganancias,
  };
}

module.exports = { cerrarMes };
