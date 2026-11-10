// services/auditClosedMonths.service.js
// Read-only audit: detects post-close contabilizations.
// A category present in Ganancias for a month is closed, and the close
// zeroes its live totals in Total Productos / Cartones_vendidos on purpose.
// A non-zero live total for such a category is therefore the exact footprint
// of a write that landed after the close.
//
// This service NEVER writes.

const contabilidadRepo = require("../repositories/contabilidad.repository");
const contableRepo = require("../repositories/contable.repository");

/**
 * @typedef {{ mesAnio: string, categoria: string, totalLive: number, cartonesLive: number }} ClosedMonthFinding
 */

/**
 * Scans every closed month (a Ganancias document) and reports closed
 * categories whose live totals were incremented after the close.
 *
 * @returns {Promise<ClosedMonthFinding[]>}
 */
async function auditClosedMonths() {
  const gananciasSnap = await contableRepo.getTodasGanancias();
  const hallazgos = [];

  for (const gananciasDoc of gananciasSnap.docs) {
    const mesAnio = gananciasDoc.id;
    const categoriasCerradas = Object.keys(gananciasDoc.data() || {});

    for (const categoria of categoriasCerradas) {
      const [totalSnap, cartonesSnap] = await Promise.all([
        contabilidadRepo.getCategoriaTotal(mesAnio, categoria),
        contabilidadRepo.getCategoriaCartones(mesAnio, categoria),
      ]);

      const totalLive = totalSnap ? Number(totalSnap.data().total || 0) : 0;
      const cartonesLive = cartonesSnap
        ? Number(cartonesSnap.data().total || 0)
        : 0;

      if (totalLive !== 0 || cartonesLive !== 0) {
        hallazgos.push({ mesAnio, categoria, totalLive, cartonesLive });
      }
    }
  }

  return hallazgos;
}

module.exports = { auditClosedMonths };
