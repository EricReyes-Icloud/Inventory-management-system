const contabilidadRepo = require("../repositories/contabilidad.repository");

/**
 * 🔒 Cierra un mes contable
 * - Genera Historico_Mensual
 * - Solo debe llamarse desde un endpoint ADMIN
 */
async function cerrarMesContable(mesAnio) {
  if (!mesAnio) {
    throw new Error("mesAnio es obligatorio para cerrar el mes");
  }

  console.log(`🔒 Iniciando cierre contable del mes: ${mesAnio}`);

  // --------------------
  // 🛑 Validar que NO esté cerrado
  // --------------------
  const historicoSnap = await contabilidadRepo.getHistoricoMensual(mesAnio);
  if (historicoSnap) {
    throw new Error(`El mes ${mesAnio} ya está cerrado`);
  }

  // --------------------
  // 📊 Leer acumuladores
  // --------------------
  const [totalSnap, cartonesSnap] = await Promise.all([
    contabilidadRepo.getTotalProductos(mesAnio),
    contabilidadRepo.getCartonesVendidos(mesAnio),
  ]);

  if (!totalSnap && !cartonesSnap) {
    throw new Error(`No hay datos contables para ${mesAnio}`);
  }

  const totalProductos = totalSnap ? totalSnap.data() : {};
  const cartonesVendidos = cartonesSnap ? cartonesSnap.data() : {};

  // --------------------
  // 🧾 Crear histórico (snapshot)
  // --------------------
  await contabilidadRepo.setHistoricoMensual(mesAnio, {
    totalProductos,
    cartonesVendidos,
  });

  console.log(`📦 Histórico mensual creado: ${mesAnio}`);

  return {
    mesAnio,
    estado: "cerrado",
    categorias: Object.keys(totalProductos),
  };
}

module.exports = {
  cerrarMesContable,
};
