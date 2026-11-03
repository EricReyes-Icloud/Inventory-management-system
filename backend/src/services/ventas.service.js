// src/services/ventas.service.js
const ventasRepo = require("../repositories/ventas.repository");
const productosRepo = require("../repositories/productos.repository");
const catalogLoader = require("../catalog/loader");

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
 * Valida que el producto tenga un precio válido.
 * @param {object} prodSnap - Document snapshot de producto
 * @param {string} nombreProducto - Nombre del producto para el error
 * @returns {{valido: boolean, precio?: number, error?: object}}
 */
function validarPrecio(prodSnap, nombreProducto) {
  if (!prodSnap || !prodSnap.exists) {
    return {
      valido: false,
      error: {
        error: "producto_no_encontrado",
        detalle: nombreProducto,
      },
    };
  }

  const data = prodSnap.data();
  const priceField = data["Precio carton"];

  // Caso 1: Campo faltante o null/undefined
  if (priceField === undefined || priceField === null) {
    return {
      valido: false,
      error: {
        error: "producto_sin_precio",
        detalle: nombreProducto,
      },
    };
  }

  // Caso 2: No es número o es NaN
  const price = Number(priceField);
  if (isNaN(price)) {
    return {
      valido: false,
      error: {
        error: "precio_invalido",
        detalle: nombreProducto,
        campoValor: priceField,
        tipo: typeof priceField,
      },
    };
  }

  // Caso 3: Precio 0 o negativo (precio no definido)
  if (price <= 0) {
    return {
      valido: false,
      error: {
        error: "producto_sin_precio",
        detalle: nombreProducto,
      },
    };
  }

  return { valido: true, precio: price };
}

async function crearPedidoLibre({ cliente, mensaje, productosInterpretados: productosInterpretadosInput } = {}) {
  if (!cliente) {
    return { ok: false, status: 400, body: { error: "cliente_requerido" } };
  }
  if (!mensaje || typeof mensaje !== "string" || mensaje.trim() === "") {
    return { ok: false, status: 400, body: { error: "mensaje_requerido" } };
  }

  // ✅ Buscar cliente en Firestore (ignorando mayúsculas y tildes)
  const clienteNormalizado = normalizar(cliente);
  const clienteDoc = await ventasRepo.buscarClientePorNombre(clienteNormalizado);

  if (!clienteDoc) {
    return { ok: false, status: 404, body: { error: `cliente_no_encontrado: ${cliente}` } };
  }

  const clienteId = clienteDoc.id;

  // --------------------
  // 🧠 Interpretar pedido libre
  // --------------------
  let productosInterpretados = productosInterpretadosInput;
  if (!productosInterpretados) {
    // Lazy require to break circular dependency (brain/inturis <-> services/ventas.service)
    const { interpretarPedido } = require("../brain/inturis");
    productosInterpretados = await interpretarPedido(mensaje);
  }

  if (!productosInterpretados || productosInterpretados.length === 0) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "ningun_producto_identificado",
        sugerencias: Array.from(catalogLoader.getCatalog().keys()),
      },
    };
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
    return {
      ok: false,
      status: 400,
      body: {
        error: "ningun_producto_identificado",
        sugerencias: productosInterpretados.map((p) => p.producto),
      },
    };
  }

  console.log("🧩 Productos normalizados:", productosNormalizados);

  // --------------------
  // 🛒 Procesar productos con validación de precio
  // --------------------
  const items = [];
  let total = 0;

  for (const item of productosNormalizados) {
    const { productoId, subcoleccion, docId, cantidad } = item;
    if (!productoId || !subcoleccion || !docId) {
      return {
        ok: false,
        status: 400,
        body: {
          error: `datos_incompletos_para_producto: ${JSON.stringify(item)}`,
        },
      };
    }

    const prodSnap = await productosRepo.getProducto(subcoleccion, docId);
    console.log('[DEBUG] prodSnap:', prodSnap ? { exists: prodSnap.exists, data: () => prodSnap.data() } : null);
    console.log('[DEBUG] productosDocRef.collection:', require('../lib/firestore').default?._mock || 'no mock');
    if (!prodSnap || !prodSnap.exists) {
      return {
        ok: false,
        status: 400,
        body: {
          error: `producto_no_encontrado: ${productoId}/${subcoleccion}/${docId}`,
        },
      };
    }

    // Validar precio - NO continuar si el precio es inválido
    const validacion = validarPrecio(prodSnap, subcoleccion);
    if (!validacion.valido) {
      return {
        ok: false,
        status: 400,
        body: validacion.error,
      };
    }

    const unitPrice = validacion.precio;
    const qty = Number(cantidad || 1);
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

  // ⚠️ Si ningún producto fue procesado exitosamente
  if (items.length === 0) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "ningun_producto_validado",
        detalle: "Todos los productos identificados fallaron validacion de precio",
      },
    };
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
    numerosExistentes.length > 0 ? Math.max(...numerosExistentes) + 1 : 1;

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

  return {
    ok: true,
    status: 200,
    body: {
      pedidoId,
      clienteId,
      clienteNombre: cliente,
      descripcionPedido: `Pedido N°${nuevoNumero}: ${descripcionPedido}`,
      total,
      tipoPedido: "libre",
      estadoContable: "pendiente",
    },
  };
}

module.exports = { crearPedidoLibre };
