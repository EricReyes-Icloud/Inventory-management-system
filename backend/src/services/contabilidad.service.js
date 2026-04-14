// services/contabilidad.service.js
const db = require("../lib/firestore");
const { diccionarioCategorias } = require("../utils/diccionario.js");
const { obtenerMesAnio } = require("../utils/fechas.js");
const { FieldValue } = require("firebase-admin/firestore");
const { normalizarTexto } = require("../utils/normalizarTexto.js");


function obtenerCategoria(nombre) {
  const skuNormalizado = normalizarTexto(nombre);

  const categoriasOrdenadas = Object.keys(diccionarioCategorias)
    .sort((a, b) => {
      const aNorm = normalizarTexto(a.replace(/_/g, " "));
      const bNorm = normalizarTexto(b.replace(/_/g, " "));
      return bNorm.length - aNorm.length;
    });

  for (const categoria of categoriasOrdenadas) {
    const categoriaNormalizada = normalizarTexto(
      categoria.replace(/_/g, " ")
    );

    if (skuNormalizado.includes(categoriaNormalizada)) {
      return categoria;
    }
  }

  console.warn(`⚠️ SKU sin categoría definida: ${nombre}`);
  return null;
}


/* ================= CONTABILIDAD MENSUAL ================= */

function calcularOperacionesTotalesYCartones(items, fechaPedido) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Items inválidos para contabilidad");
  }

  if (!(fechaPedido instanceof Date)) {
    throw new Error("fechaPedido inválida");
  }

  const operaciones = [];
  const mesAnio = obtenerMesAnio(fechaPedido);

  const totalMesPath = `Total Productos/${mesAnio}`;
  const cartonesMesPath = `Cartones_vendidos/${mesAnio}`;

  /* ==============================
     1️⃣ ASEGURAR DOCUMENTO PRINCIPAL
  =============================== */

  operaciones.push({
    ref: totalMesPath,
    data: {
      mesAnio,
      totalGeneral: FieldValue.increment(0),
      estado: "abierto",
      creadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
    },
    options: { merge: true },
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

  for (const it of items) {
    const categoria = obtenerCategoria(it.nombre);
    if (!categoria) continue;

    const sku = it.nombre.toString().trim();
    const subtotal = Number(it.subtotal || 0);
    const cantidad = Number(it.cantidad || 0);

    const productoTotalPath = `${totalMesPath}/productos/${categoria}`;
    const skuTotalPath = `${productoTotalPath}/skus/${sku}`;

    const productoCartonPath = `${cartonesMesPath}/productos/${categoria}`;
    const skuCartonPath = `${productoCartonPath}/skus/${sku}`;

    /* ===== 💰 DINERO ===== */

    operaciones.push({
      ref: productoTotalPath,
      data: { total: FieldValue.increment(subtotal) },
      options: { merge: true },
    });

    operaciones.push({
      ref: skuTotalPath,
      data: { total: FieldValue.increment(subtotal) },
      options: { merge: true },
    });

    operaciones.push({
      ref: totalMesPath,
      data: {
        totalGeneral: FieldValue.increment(subtotal),
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

  const totalMesRef = db.collection("Total_Productos").doc(mesAnio);
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
