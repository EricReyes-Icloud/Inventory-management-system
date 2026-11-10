#!/usr/bin/env node
// Read-only audit of post-close contabilizations.
// Run explicitly: node scripts/audit-closed-months.js
// Never invoked automatically by the app or the monthly closing pipeline.

const {
  auditClosedMonths,
} = require("../src/services/auditClosedMonths.service");

(async () => {
  try {
    const hallazgos = await auditClosedMonths();

    if (hallazgos.length === 0) {
      console.log(
        "✅ No se encontraron contabilizaciones posteriores al cierre."
      );
      return;
    }

    console.log(
      `⚠️  ${hallazgos.length} categoría(s) cerrada(s) con totales vivos:`
    );
    for (const h of hallazgos) {
      console.log(
        `- ${h.mesAnio} / ${h.categoria}: Total Productos = ${h.totalLive}, Cartones = ${h.cartonesLive}`
      );
    }
    process.exitCode = 1;
  } catch (error) {
    console.error(`❌ Auditoría falló: ${error.message}`);
    process.exitCode = 2;
  }
})();
