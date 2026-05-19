// services/contabilidad.service.js
const db = require("../lib/firestore"); // Solo la usamos en el Historico Mensual
const { diccionarioCategorias } = require("../utils/diccionario.js");
const { obtenerMesAnio } = require("../utils/fechas.js");
const { FieldValue } = require("firebase-admin/firestore");// Para operaciones especiales como increment() y serverTimestamp()
const { normalizarTexto } = require("../utils/normalizarTexto.js");


function obtenerCategoria(nombre) {
  const skuNormalizado = normalizarTexto(nombre); // Limpiamos el nombre del producto

  const categoriasOrdenadas = Object.keys(diccionarioCategorias) // Obtenemos todas las categorias
    .sort((a, b) => { // Las ordenamos 
      const aNorm = normalizarTexto(a.replace(/_/g, " ")); // Limpiamos nombres de categorias
      const bNorm = normalizarTexto(b.replace(/_/g, " "));
      return bNorm.length - aNorm.length; // Devolvemos de mayor a menor
    });

  for (const categoria of categoriasOrdenadas) { // Iteramos cada categoria
    const categoriaNormalizada = normalizarTexto( // Limpiamos la categoria
      categoria.replace(/_/g, " ")
    );

    if (skuNormalizado.includes(categoriaNormalizada)) { // Validamos si el producto contiene la categoria
      return categoria; // Devolvemos la categoria encontrada
    }
  }

  console.warn(`⚠️ SKU sin categoría definida: ${nombre}`);
  return null; // Si no la encuentra, lanzamos un warning y devolvemos null
}


/* ================= CONTABILIDAD MENSUAL ================= */

function calcularOperacionesTotalesYCartones(items, fechaPedido) {
  if (!Array.isArray(items) || items.length === 0) { // Evitamos items invalidos
    throw new Error("Items inválidos para contabilidad");
  }

  if (!(fechaPedido instanceof Date)) { // Evitamos errores silenciosos
    throw new Error("fechaPedido inválida"); 
  }

  const operaciones = []; // Vamos acumulando todo
  const mesAnio = obtenerMesAnio(fechaPedido); // Agrupamos por mes y año

  const totalMesPath = `Total Productos/${mesAnio}`; // Almacenamos en Paths para desacoplamiento
  const cartonesMesPath = `Cartones_vendidos/${mesAnio}`;

  /* ==============================
     1️⃣ ASEGURAR DOCUMENTO PRINCIPAL
  =============================== */

  // Esto no ejecuta nada, solo describe

  operaciones.push({ // Hacemos un set en el documento
    ref: totalMesPath,
    data: {
      mesAnio,
      totalGeneral: FieldValue.increment(0), // Inicializamos sin modificar
      estado: "abierto",
      creadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
    },
    options: { merge: true }, // No sobreescribimos, mezclamos
  });

  operaciones.push({
    ref: cartonesMesPath,
    data: {
      mesAnio,
      totalGeneral: FieldValue.increment(0),
      estado: "abierto",
      creadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
    },
    options: { merge: true },
  });

  /* ==============================
     2️⃣ PROCESAR ITEMS
  =============================== */

  for (const it of items) { // Iteramos cada item
    const categoria = obtenerCategoria(it.nombre);
    if (!categoria) continue; // Si no hay categoria ignoramos

    const sku = it.nombre.toString().trim(); // Nombre del producto
    const subtotal = Number(it.subtotal || 0); // Proteccion contra datos malos
    const cantidad = Number(it.cantidad || 0);

    // Creamos los Paths
    const productoTotalPath = `${totalMesPath}/productos/${categoria}`;
    const skuTotalPath = `${productoTotalPath}/skus/${sku}`;

    const productoCartonPath = `${cartonesMesPath}/productos/${categoria}`;
    const skuCartonPath = `${productoCartonPath}/skus/${sku}`;

    /* ===== 💰 DINERO ===== */

    operaciones.push({
      ref: productoTotalPath,
      data: { total: FieldValue.increment(subtotal) }, // Sumamos dinero por categoria
      options: { merge: true },
    });

    operaciones.push({
      ref: skuTotalPath,
      data: { total: FieldValue.increment(subtotal) }, // Sumamos por Sku
      options: { merge: true },
    });

    operaciones.push({
      ref: totalMesPath,
      data: {
        totalGeneral: FieldValue.increment(subtotal), // Generamos el total global
        actualizadoEn: FieldValue.serverTimestamp(),
      },
      options: { merge: true },
    });

    /* ===== 📦 CANTIDAD ===== */

    operaciones.push({
      ref: productoCartonPath,
      data: { total: FieldValue.increment(cantidad) },
      options: { merge: true },
    });

    operaciones.push({
      ref: skuCartonPath,
      data: { total: FieldValue.increment(cantidad) },
      options: { merge: true },
    });

    operaciones.push({
      ref: cartonesMesPath,
      data: {
        totalGeneral: FieldValue.increment(cantidad),
        actualizadoEn: FieldValue.serverTimestamp(),
      },
      options: { merge: true },
    });
  }

  return operaciones;
}

/* ================= HISTÓRICO MENSUAL ================= */

async function generarHistoricoMensual(mesAnio) {

  const totalMesRef = db.collection("Total Productos").doc(mesAnio);
  const cartonesMesRef = db.collection("Cartones_vendidos").doc(mesAnio);
  const historicoRef = db.collection("Historico_Mensual").doc(mesAnio);

  const historicoSnap = await historicoRef.get();
  if (historicoSnap.exists) {
    throw new Error(`El histórico de ${mesAnio} ya fue generado`);
  }

  const totalProductos = {};
  const cartonesVendidos = {};

  const productosSnap = await totalMesRef.collection("productos").get();

  for (const productoDoc of productosSnap.docs) {
    const categoria = productoDoc.id;

    totalProductos[categoria] = {
      total: productoDoc.data().total || 0,
      skus: {}
    };

    const skusSnap = await productoDoc.ref.collection("skus").get();

    for (const skuDoc of skusSnap.docs) {
      totalProductos[categoria].skus[skuDoc.id] =
        skuDoc.data().total || 0;
    }
  }

  const productosCartonesSnap =
    await cartonesMesRef.collection("productos").get();

  for (const productoDoc of productosCartonesSnap.docs) {
    const categoria = productoDoc.id;

    cartonesVendidos[categoria] = {
      total: productoDoc.data().total || 0,
      skus: {}
    };

    const skusSnap = await productoDoc.ref.collection("skus").get();

    for (const skuDoc of skusSnap.docs) {
      cartonesVendidos[categoria].skus[skuDoc.id] =
        skuDoc.data().total || 0;
    }
  }

  await historicoRef.set({
    mesAnio,
    totalProductos,
    cartonesVendidos,
    generadoEn: new Date(),
    estado: "cerrado",
  });
}

/* ================= EXPORTS ================= */

module.exports = {
  calcularOperacionesTotalesYCartones,
  generarHistoricoMensual,
  obtenerCategoria
};
