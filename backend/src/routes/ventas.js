// src/routes/ventas.js
const express = require("express");
const router = express.Router();
const { interpretarPedido } = require("../brain/inturis");
const ventasRepo = require("../repositories/ventas.repository");
const productosRepo = require("../repositories/productos.repository");

/**
 * Normaliza texto: lower case + quita tildes.
 */
function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * --------------------------👉 Endpoint para registrar pedido libre-----------------------
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
    const clienteNormalizado = normalizar(cliente);
    const clienteDoc = await ventasRepo.buscarClientePorNombre(clienteNormalizado);

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
        sugerencias: Object.values(require("../utils/diccionario").diccionarioCategorias).flat(),
      });
    }

    // 🧩 Buscar dinámicamente los docId dentro de Productos_ID
    const productosNormalizados = [];

    for (const p of productosInterpretados) {
      if (!p.producto || p.producto === "No identificado") continue;

      const nombreSubcoleccion = p.producto.trim();
      const cantidad = p.cantidad || 1;

      try {
        const subDoc = await productosRepo.buscarSubcoleccion(nombreSubcoleccion);

        if (!subDoc) {
          console.warn(`⚠️ No se encontró la subcolección: ${nombreSubcoleccion}`);
          continue;
        }

        productosNormalizados.push({
          productoId: "Productos_ID",
          subcoleccion: nombreSubcoleccion,
          docId: subDoc.id,
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

      const prodSnap = await productosRepo.getProducto(subcoleccion, docId);
      if (!prodSnap) {
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

    // 📝 Crear/actualizar documento Venta del cliente
    await ventasRepo.setVenta(clienteId, {
      clienteId,
      clienteNombre: cliente,
      actualizadoEn: new Date(),
    });

    // --------------------
    // 📝 Crear pedido (Pedido_Id manual + estructura correcta)
    // --------------------
    const fecha = new Date();
    const mesAnio = fecha.toLocaleString("es-CO", {
      month: "long",
      year: "numeric",
    });
    const mesAnioKey = mesAnio.charAt(0).toUpperCase() + mesAnio.slice(1);

    // 🧾 Descripción del pedido
    const descripcionPedido = items
      .map((it) => `${it.cantidad} ${it.nombre}`)
      .join(", ");

    // 📍 Crear documento del mes de pedidos
    await ventasRepo.setPedidoMes(clienteId, mesAnioKey, {
      mes: mesAnioKey,
      clienteId,
      creadoEn: new Date(),
    });

    // 🔢 Obtener pedidos existentes para calcular consecutivo
    const pedidosSnap = await ventasRepo.getPedidos(clienteId, mesAnioKey);

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
    await ventasRepo.crearPedido(clienteId, mesAnioKey, pedidoId, {
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
      pagado: false,
      fechaPago: null,
      pagadoPor: null,
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

module.exports = router;
