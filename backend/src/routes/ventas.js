// src/routes/ventas.js
const express = require("express");
const db = require("../lib/firestore");
const router = express.Router();
const admin = require("firebase-admin");
const { interpretarPedido } = require("../brain/inturis");




/**
--------------------------👉 Endpoint para registrar pedido libre-----------------------
*/
router.post("/pedido-libre", async (req, res) => {
  try {
    const { cliente, mensaje } = req.body;

    if (!cliente) {
      return res.status(400).json({ error: "cliente_requerido" });
    }
    if (!mensaje || typeof mensaje !== "string" || mensaje.trim() === "") {
      return res.status(400).json({ error: "mensaje_requerido" });
    }

  // ✅ Buscar cliente en Firestore (ignorando mayúsculas y tildes)
  const normalizar = (texto) =>
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""); // quita tildes

      const clienteNormalizado = normalizar(cliente);

      const clientesSnap = await db.collection("Clientes").get();

      let clienteDoc = null;

      clientesSnap.forEach((doc) => {
        const nombreBD = doc.data().Nombre || "";
        if (normalizar(nombreBD) === clienteNormalizado) {
          clienteDoc = doc;
        }
      });

      if (!clienteDoc) {
        return res.status(404).json({ error: `cliente_no_encontrado: ${cliente}` });
      }

    const clienteId = clienteDoc.id;







    // --------------------
    // 🧠 Interpretar pedido libre
    // --------------------
    const productosInterpretados = await interpretarPedido(mensaje);

    if (!productosInterpretados || productosInterpretados.length === 0) {
      return res.status(400).json({
        error: "ningun_producto_identificado",
        sugerencias: Object.values(diccionarioCategorias).flat(),
      });
    }

    // 🧩 Buscar dinámicamente los docId dentro de Productos_ID
    const productosNormalizados = [];

    for (const p of productosInterpretados) {
      if (!p.producto || p.producto === "No identificado") continue;

      const nombreSubcoleccion = p.producto.trim();
      const cantidad = p.cantidad || 1;

      try {
        // Buscar el primer documento dentro de la subcolección del producto
        const subcolSnap = await db
          .collection("Productos")
          .doc("Productos_ID")                // 🔥 constante en tu estructura
          .collection(nombreSubcoleccion)
          .limit(1)
          .get();

        if (subcolSnap.empty) {
          console.warn(`⚠️ No se encontró la subcolección: ${nombreSubcoleccion}`);
          continue;
        }

        const subDoc = subcolSnap.docs[0]; // Ejemplo: Clavo_1

        productosNormalizados.push({
          productoId: "Productos_ID",        // ✅ constante
          subcoleccion: nombreSubcoleccion,  // Ej: "Clavo * 100"
          docId: subDoc.id,                  // Ej: "Clavo_1"
          cantidad,
        });
      } catch (error) {
        console.error("Error buscando producto:", nombreSubcoleccion, error);
      }
    }

    // ⚠️ Si ningún producto se encontró
    if (productosNormalizados.length === 0) {
      return res.status(400).json({
        error: "ningun_producto_identificado",
        sugerencias: productosInterpretados.map((p) => p.producto),
      });
    }

    console.log("🧩 Productos normalizados:", productosNormalizados);








    // --------------------
    // 🛒 Procesar productos
    // --------------------
    const items = [];
    let total = 0;

    for (const item of productosNormalizados) {
      const { productoId, subcoleccion, docId, cantidad } = item;
      if (!productoId || !subcoleccion || !docId) {
        return res.status(400).json({
          error: `datos_incompletos_para_producto: ${JSON.stringify(item)}`,
        });
      }

      const prodRef = db
        .collection("Productos")
        .doc(productoId)
        .collection(subcoleccion)
        .doc(docId);

      const prodSnap = await prodRef.get();
      if (!prodSnap.exists) {
        return res.status(400).json({
          error: `producto_no_encontrado: ${productoId}/${subcoleccion}/${docId}`,
        });
      }

      const p = prodSnap.data();
      const unitPrice = Number(p["Precio carton"] || 0);
      const qty = Number(cantidad || 0);
      const subtotal = unitPrice * qty;

      items.push({
        productoId,
        subcoleccion,
        docId,
        nombre: subcoleccion,
        precioUnitario: unitPrice,
        cantidad: qty,
        subtotal,
      });

      total += subtotal;
    }



    const clienteRef = db.collection("Ventas").doc(clienteId);

    await clienteRef.set(
      {
        clienteId,
        clienteNombre: cliente,
        actualizadoEn: new Date(),
      },
      { merge: true }
    );




    // --------------------
    // 📝 Crear pedido (Pedido_Id manual + estructura correcta)
    // --------------------

    const fecha = new Date();

    const mesAnio = fecha.toLocaleString("es-CO", {
      month: "long",
      year: "numeric",
    });

    const mesAnioKey =
      mesAnio.charAt(0).toUpperCase() + mesAnio.slice(1);

    // 🧾 Descripción del pedido
    const descripcionPedido = items
      .map((it) => `${it.cantidad} ${it.nombre}`)
      .join(", ");

    // 📍 Referencias Firestore 
    const pedidosMesRef = db
      .collection("Ventas")
      .doc(clienteId)
      .collection("Pedidos")
      .doc(mesAnioKey);

      await pedidosMesRef.set(
        {
          mes: mesAnioKey,
          clienteId,
          creadoEn: new Date(),
        },
        { merge: true }
      );      



    const pedidosCollectionRef = pedidosMesRef.collection("pedidos");

    // 🔢 Obtener pedidos existentes para calcular consecutivo
    const pedidosSnap = await pedidosCollectionRef.get();

    const numerosExistentes = pedidosSnap.docs
      .map((doc) => {
        const match = doc.id.match(/^Pedido_Id(\d+)$/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((n) => n !== null);

    const nuevoNumero =
      numerosExistentes.length > 0
        ? Math.max(...numerosExistentes) + 1
        : 1;

    const pedidoId = `Pedido_Id${nuevoNumero}`;

    // 🧾 Crear pedido con ID controlado

    await pedidosCollectionRef.doc(pedidoId).set({
      pedidoId,
      numeroPedido: nuevoNumero,
    
      descripcion: `Pedido N°${nuevoNumero}: ${descripcionPedido}`,
      fechaPedido: fecha,
    
      subtotal: total,
      detalle: items,
    
      clienteNombre: cliente,
      clienteId,
    
      tipoPedido: "libre",
      mensajeOriginal: mensaje,
    
      // 🔐 CONTROL DE PAGO
      pagado: false,                 // ← OBLIGATORIO
      fechaPago: null,               // ← Se llenará cuando pague
      pagadoPor: null,               // ← UID del admin que lo marque
    
      // 📊 CONTROL CONTABLE
      estadoContable: "pendiente",
      contabilidadAplicada: false,
    
      creadoEn: new Date(),
    });

    




  

    res.json({
        pedidoId,
        clienteId,
        clienteNombre: cliente,
        descripcionPedido: `Pedido N°${nuevoNumero}: ${descripcionPedido}`,
        total,
        tipoPedido: "libre",
        estadoContable: "pendiente",
      });
        
      } catch (err) {
        console.error("Error creando pedido libre:", err);
        res
          .status(500)
          .json({ error: "error_creando_pedido_libre", details: err.message });
      }
    });








/**
 * 👉 Endpoint para recalcular ganancias manualmente
 */
router.post("/calcular-ganancias", async (req, res) => {
  try {
    const resultado = await calcularGananciasInterno();
    if (!resultado) {
      return res.status(404).json({ error: "no_existen_totales" });
    }
    res.json(resultado);
  } catch (err) {
    console.error("Error calculando ganancias:", err);
    res.status(500).json({ error: "error_calculando_ganancias", details: err.message });
  }
});






module.exports = router;
