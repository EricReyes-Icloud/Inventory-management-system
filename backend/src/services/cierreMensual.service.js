// Importamos nuestra conexion a la base de datos
const db = require("../lib/firestore");

/**
 * 🔒 Cierra un mes contable
 * - Genera Historico_Mensual
 * - Solo debe llamarse desde un endpoint ADMIN
 */
async function cerrarMesContable(mesAnio) {
  if (!mesAnio) {
    throw new Error("mesAnio es obligatorio para cerrar el mes"); // Si no hay mes no continua
  }

  console.log(`Iniciando cierre contable del mes: ${mesAnio}`);

  // Creamos referencias a nuestros documentos
  const totalRef = db.collection("Total Productos").doc(mesAnio);
  const cartonesRef = db.collection("Cartones_vendidos").doc(mesAnio);
  const historicoRef = db.collection("Historico_Mensual").doc(mesAnio);


  // --------------------
  // Validar que NO esté cerrado
  // --------------------
  const historicoSnap = await historicoRef.get();
  if (historicoSnap.exists) { // Evitamos duplicados
    throw new Error(`El mes ${mesAnio} ya está cerrado`);
  }


  // --------------------
  // Leer acumuladores
  // --------------------
  const [totalSnap, cartonesSnap] = await Promise.all([ // Mejoramos el rendimiento de busqueda al usar Promise.all
    totalRef.get(), // Leemos ambos documentos al mismo tiempo
    cartonesRef.get(),
  ]);

  if (!totalSnap.exists && !cartonesSnap.exists) { // Si no hay datos en ninguno, no cierra el mes
    throw new Error(`No hay datos contables para ${mesAnio}`);
  }

  // Obtenemos los datos reales
  const totalProductos = totalSnap.exists ? totalSnap.data() : {};
  const cartonesVendidos = cartonesSnap.exists
    ? cartonesSnap.data() // .data nos devuelve el objeto JSON
    : {}; // Si no exite, usamos {} para evitar errores


  // --------------------
  // Crear histórico (snapshot)
  // --------------------
  await contabilidadRepo.setHistoricoMensual(mesAnio, {
    totalProductos,
    cartonesVendidos,           // Mantenemos inmutabilidad historica
    estado: "cerrado",
    generadoEn: new Date(),
  });

  console.log(`📦 Histórico mensual creado: ${mesAnio}`); // Confirmación de exito

  // Devolvemos información util
  return {
    mesAnio, // El mes y año que se cerro
    estado: "cerrado", // Estado de confirmación
    categorias: Object.keys(totalProductos), // Claves de nuestro objeto
  };
}

module.exports = {
  cerrarMesContable,
};
