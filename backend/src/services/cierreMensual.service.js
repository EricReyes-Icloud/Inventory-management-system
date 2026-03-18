const db = require("../lib/firestore");

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

  const totalRef = db.collection("Total Productos").doc(mesAnio);
  const cartonesRef = db.collection("Cartones_vendidos").doc(mesAnio);
  const historicoRef = db.collection("Historico_Mensual").doc(mesAnio);

  // --------------------
  // 🛑 Validar que NO esté cerrado
  // --------------------
  const historicoSnap = await historicoRef.get();
  if (historicoSnap.exists) {
    throw new Error(`El mes ${mesAnio} ya está cerrado`);
  }

  // --------------------
  // 📊 Leer acumuladores
  // --------------------
  const [totalSnap, cartonesSnap] = await Promise.all([
    totalRef.get(),
    cartonesRef.get(),
  ]);

  if (!totalSnap.exists && !cartonesSnap.exists) {
    throw new Error(`No hay datos contables para ${mesAnio}`);
  }

  const totalProductos = totalSnap.exists ? totalSnap.data() : {};
  const cartonesVendidos = cartonesSnap.exists
    ? cartonesSnap.data()
    : {};

  // --------------------
  // 🧾 Crear histórico (snapshot)
  // --------------------
  await historicoRef.set({
    mesAnio,
    totalProductos,
    cartonesVendidos,
    estado: "cerrado",
    generadoEn: new Date(),
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
