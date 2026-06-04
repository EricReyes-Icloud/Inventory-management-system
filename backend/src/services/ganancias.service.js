// services/ganancias.service.js
const db = require("../lib/firestore");

/**
 * Calcula y guarda ganancias por categoría y mes
 * USA EL HISTÓRICO MENSUAL (NO los acumuladores vivos)
 */

async function cerrarGananciasPorCategoria({ mesAnio, categoria }) {
  if (!mesAnio || !categoria) {
    throw new Error("mesAnio y categoria son obligatorios");
  }

  console.log(`💰 Cerrando ganancias para ${categoria} (${mesAnio})`);


  // --------------------
  // 📦 HISTÓRICO MENSUAL
  // --------------------

  // Buscamos el documento del mes
  const historicoSnap = await db 
    .collection("Historico_Mensual")
    .doc(mesAnio)
    .get();

  // Si no existe  
  if (!historicoSnap.exists) {
    throw new Error(`No existe histórico mensual para ${mesAnio}`);
  }

  // Convertimos el documento en un objeto JS
  const historico = historicoSnap.data();

  // --------------------
  // 📊 Ventas
  // --------------------

  // Buscamos ventas de la categoria
  const categoriaVentas = historico.totalProductos?.[categoria];

  // Si no hay ventas no calcula
  if (!categoriaVentas || categoriaVentas.total <= 0) {
    throw new Error(`Ventas en cero para ${categoria}`);
  }

  // Total vendido
  const ventaTotal = categoriaVentas.total;

  // --------------------
  // 📦 Cartones
  // --------------------

  // Cuántos cartones se vendieron, y si no hay devolvemos 0
  const cartonesTotal = historico.cartonesVendidos?.[categoria]?.total || 0;

  if (cartonesTotal <= 0) {
    throw new Error(`No hay cartones vendidos para ${categoria}`); // Informamos que no hay cartones
  }

  // --------------------
  // 💸 Costos fijos base
  // --------------------

  // Dentro de nuestra coleccion Invertir buscamos costos_fijos para esa categoria
  const costosFijosSnap = await db
    .collection("Invertir")
    .doc(categoria)
    .collection("costos_fijos")
    .doc("costos_fijos")
    .get();

  // Si no existen costos_fijos  
  if (!costosFijosSnap.exists) {
    throw new Error(`No existen costos fijos para ${categoria}`);
  }

  // Inicializamos el acumulador
  const costosFijosData = costosFijosSnap.data() || {};
  let costosFijosUnit = 0;

  // Recorremos todos los costos
  for (const v of Object.values(costosFijosData)) {
    if (typeof v !== "number" || v < 0) { // Validamos que sean números validos
      throw new Error(`Costo fijo inválido para ${categoria}`);
    }
    costosFijosUnit += v; // Sumamos todos los costos
  }

  // =====================================================
  // 🐝 LÓGICA ESPECIAL PARA MIEL
  // =====================================================

  let inversionTotal = 0;
  let costosVariablesUnit = 0;

  if (categoria === "Miel") {
    const productos = categoriaVentas.productos || {}; // Obtenemos los productos de Miel

    // Recorremos cada producto
    for (const [nombreProducto, dataProducto] of Object.entries(productos)) {
      // Datos por producto
      const ventaProducto = dataProducto.total || 0;
      const cartonesProducto = dataProducto.cartones || 0;

      // Si no se vendio ignoramos
      if (cartonesProducto <= 0) continue;

      let costoUnitProducto = costosFijosUnit;

      //  Si es uno de los productos especiales (solo estos tienen costos variables extra)
      if (["Frascos", "Botellas", "Copas"].includes(nombreProducto)) {
        const costosVarSnap = await db
          .collection("Invertir")
          .doc("Miel")                       // Buscamos costos variables por producto
          .collection("costos_variables")
          .doc(nombreProducto)
          .get();

        // Si existen los sumamos  
        if (costosVarSnap.exists) {
          const dataVar = costosVarSnap.data();
          let sumaVar = 0;

          // Sumamos solo valores validos
          for (const v of Object.values(dataVar)) {
            if (typeof v === "number" && v > 0) {
              sumaVar += v;
            }
          }

          // Acumulamos costo unitario y total global
          costoUnitProducto += sumaVar;
          costosVariablesUnit += sumaVar;
        }
      }

      // Hacemos el calculo de inversion por producto
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

    // Si no existen costos variables  
    if (!costosVariablesSnap.exists) {
      throw new Error(`No existen costos variables para ${categoria}`);
    }

    const costosVariablesData = costosVariablesSnap.data() || {};

    // Recorremos los valores
    for (const v of Object.values(costosVariablesData)) {
      if (typeof v !== "number" || v < 0) { // Validamos formato
        throw new Error(`Costo variable inválido para ${categoria}`);
      }
      costosVariablesUnit += v; // Sumamos
    }

    // Calculamos segun la formula (inversión = (fijos + variables) * cantidad)
    const inversionUnit = costosFijosUnit + costosVariablesUnit;
    inversionTotal = inversionUnit * cartonesTotal;
  }

  // --------------------
  // 🧮 Cálculos
  // --------------------

  // Restamos el total de la venta menos la inversion total
  const gananciaNeta = ventaTotal - inversionTotal;

  // Objeto que vamos a guardar en DB
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

  // Guardamos por mes
  await db
    .collection("Ganancias")
    .doc(mesAnio)
    .set({ [categoria]: data }, { merge: true }); // No borra otras categorias


  // --------------------
  // 🗂️ Histórico de costos variables
  // --------------------

  // Guardamos un snapshot de costos variables del mes
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
  
  // Creamos un objeto con todo en 0
  const resetData = {};
  for (const key of Object.keys(costosVariablesData)) {
    resetData[key] = 0;
  }

  await costosVariablesRef.set(resetData, { merge: true });





  console.log(`✅ Ganancias cerradas (${categoria} - ${mesAnio})`);

  return data;
}

module.exports = { cerrarGananciasPorCategoria };
