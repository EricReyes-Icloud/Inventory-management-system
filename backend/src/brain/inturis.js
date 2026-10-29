//-------------------------------------- INTURIS BRAIN ---------------------------------------//
const catalogLoader = require("../catalog/loader");

// Lazy requires para evitar problemas de cache en tests que manipulan Module._cache
function getNormalizarTexto() {
  return require("../utils/normalizarTexto").normalizarTexto;
}
function getNormalizarParaEquivalencias() {
  return require("../utils/normalizarTexto").normalizarParaEquivalencias;
}
function getReemplazarNumerosPalabras() {
  return require("../utils/normalizarTexto").reemplazarNumerosPalabras;
}

// ----------------------
// 2. Diccionario de palabras numéricas
// ----------------------
const numerosPalabras = {
  un: 1, uno: 1, una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10
};

// Función local que usa el lazy require para evitar problemas de cache
function reemplazarNumerosPalabras(texto) {
  return getReemplazarNumerosPalabras()(texto);
}

// Función local que usa el lazy require para evitar problemas de cache
function aplicarReglasNegocio(texto) {
  return require("../utils/normalizarTexto").aplicarReglasNegocio(texto);
}

// re-export para tests que lo importan directamente
module.exports.reemplazarNumerosPalabras = reemplazarNumerosPalabras;
module.exports.aplicarReglasNegocio = aplicarReglasNegocio;

// ----------------------
// 3. Productos originales — REMOVED: now loaded from Firestore via catalog-loader
// ----------------------

// ----------------------
// 4. Equivalencias — REMOVED: now built by catalog-loader from Firestore sinonimos
// ----------------------

// ----------------------
// 5. Fuzzy Search — REMOVED: now provided by catalog-loader's Fuse index
// ----------------------

// ----------------------
// 6. Interpretador del pedido
// ----------------------
async function interpretarPedido(pedido) {
  let textoProcesado = reemplazarNumerosPalabras(pedido);
  console.log("Texto procesado:", textoProcesado);

  let partes = textoProcesado.split(/,| y /i).map(p => p.trim());
  let resultados = [];

  const equivalencias = catalogLoader.getEquivalencias();
  const fuseIndex = catalogLoader.getFuseIndex();

  for (let parte of partes) {
    let cantidadMatch = parte.match(/\d+/);
    let cantidad = 1;
    let textoProducto = parte;

    if (cantidadMatch) {
      cantidad = parseInt(cantidadMatch[0]);
      textoProducto = parte.replace(cantidadMatch[0], "").trim();
    }

    if (isNaN(cantidad) || cantidad <= 0) cantidad = 1;

    let normalizado = getNormalizarParaEquivalencias()(textoProducto);
    console.log("Parte:", parte, "| Normalizado:", normalizado, "| Cantidad:", cantidad);

    if (equivalencias.has(normalizado)) {
      resultados.push({
        producto: equivalencias.get(normalizado),
        cantidad,
        confianza: 1,
        sugerencias: []
      });
      continue;
    }

    const busqueda = fuseIndex.search(normalizado);

    if (busqueda.length > 0 && busqueda[0].score < 0.8) {
      resultados.push({
        producto: busqueda[0].item.nombre,
        cantidad,
        confianza: Number((1 - busqueda[0].score).toFixed(2)),
        sugerencias: []
      });
      continue;
    } else {
      const sugerencias = busqueda.slice(0, 3).map(r => r.item.nombre);
      resultados.push({
        producto: "No identificado",
        cantidad,
        confianza: 0,
        sugerencias
      });
    }
  }

  return resultados;
}

// ----------------------
// 7. Procesador Twilio
// ----------------------
const { crearPedidoLibre } = require("../services/ventas.service");

async function procesarMensajeTwilio(body, from, clienteDetectado = null) {
  console.log("📩 Mensaje recibido desde Twilio:");
  console.log("De:", from);
  console.log("Texto:", body);

  // Interpretar el pedido
  const resultado = await interpretarPedido(body);
  console.log("🧠 Interpretación del mensaje:", JSON.stringify(resultado, null, 2));

  // Determinar el cliente
  const cliente = clienteDetectado || "Desconocido";
  const mensaje = body;

  // Registrar pedido directamente vía servicio (sin llamada HTTP)
  let pedidoRegistrado = false;
  try {
    const result = await crearPedidoLibre({ cliente, mensaje });
    if (result.ok) {
      console.log("📦 Pedido registrado exitosamente:", result.body);
      pedidoRegistrado = true;
    } else {
      console.error("❌ Error registrando pedido:", result.body);
      pedidoRegistrado = false;
    }
  } catch (error) {
    console.error("❌ Error registrando pedido:", error.message || error);
    pedidoRegistrado = false;
  }

  // Retornar información útil (por si el webhook la usa)
  return { cliente, resultado, pedidoRegistrado };
}

// Exportamos ambas funciones

// Función local para exportar normalizarParaEquivalencias via lazy require
function normalizarParaEquivalencias(texto) {
  return getNormalizarParaEquivalencias()(texto);
}

module.exports = { interpretarPedido, procesarMensajeTwilio, getNormalizarTexto, aplicarReglasNegocio, reemplazarNumerosPalabras, normalizarParaEquivalencias };
