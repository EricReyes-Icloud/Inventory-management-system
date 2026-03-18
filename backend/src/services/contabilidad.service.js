// services/contabilidad.service.js
const db = require("../lib/firestore");
const { diccionarioCategorias } = require("../utils/diccionario.js");
const { obtenerMesAnio } = require("../utils/fechas.js");
const { FieldValue } = require("firebase-admin/firestore");

/* ================= UTILIDADES ================= */

function normalizarTexto(texto = "") {
  return texto
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[*]/g, " ")
    .replace(/\b(clavos)\b/g, "clavo")
    .replace(/\b(botellas)\b/g, "botella")
    .replace(/\s+/g, " ")
    .trim();
}

function obtenerCategoria(nombre) {
  const skuNormalizado = normalizarTexto(nombre);

  for (const categoria of Object.keys(diccionarioCategorias)) {
    const categoriaNormalizada = normalizarTexto(categoria);

    if (skuNormalizado.startsWith(categoriaNormalizada)) {
      return categoria;
    }
  }

  console.warn(`⚠️ SKU sin categoría definida: ${nombre}`);
  return null;
}

/* ================= CONTABILIDAD MENSUAL ================= */

async function procesarTotalesYCartones(items, fechaPedido) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Items inválidos para contabilidad");
  }

  if (!(fechaPedido instanceof Date)) {
    throw new Error("fechaPedido inválida");
  }

  const mesAnio = obtenerMesAnio(fechaPedido);

  const totalMesRef = db.collection("Total Productos").doc(mesAnio);
  const cartonesMesRef = db.collection("Cartones_vendidos").doc(mesAnio);

  const batch = db.batch();

  /* ==============================
     1️⃣ ASEGURAR DOCUMENTO PRINCIPAL
  =============================== */

  batch.set(
    totalMesRef,
    {
      mesAnio,
      totalGeneral: FieldValue.increment(0),
      estado: "abierto",
      creadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  batch.set(
    cartonesMesRef,
    {
      mesAnio,
      totalGeneral: FieldValue.increment(0),
      estado: "abierto",
      creadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  /* ==============================
     2️⃣ PROCESAR ITEMS
  =============================== */

  for (const it of items) {
    const categoria = obtenerCategoria(it.nombre);
    if (!categoria) continue;

    const sku = it.nombre.toString().trim();
    const subtotal = Number(it.subtotal || 0);
    const cantidad = Number(it.cantidad || 0);

    const productoTotalRef = totalMesRef
      .collection("productos")
      .doc(categoria);

    const skuTotalRef = productoTotalRef
      .collection("skus")
      .doc(sku);

    const productoCartonRef = cartonesMesRef
      .collection("productos")
      .doc(categoria);

    const skuCartonRef = productoCartonRef
      .collection("skus")
      .doc(sku);

    /* ===== 💰 DINERO ===== */

    batch.set(
      productoTotalRef,
      { total: FieldValue.increment(subtotal) },
      { merge: true }
    );

    batch.set(
      skuTotalRef,
      { total: FieldValue.increment(subtotal) },
      { merge: true }
    );

    batch.set(
      totalMesRef,
      {
        totalGeneral: FieldValue.increment(subtotal),
        actualizadoEn: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    /* ===== 📦 CANTIDAD ===== */

    batch.set(
      productoCartonRef,
      { total: FieldValue.increment(cantidad) },
      { merge: true }
    );

    batch.set(
      skuCartonRef,
      { total: FieldValue.increment(cantidad) },
      { merge: true }
    );

    batch.set(
      cartonesMesRef,
      {
        totalGeneral: FieldValue.increment(cantidad),
        actualizadoEn: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  await batch.commit();
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
  procesarTotalesYCartones,
  generarHistoricoMensual,
};
