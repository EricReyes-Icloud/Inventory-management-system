//-------------------------------------- INTURIS BRAIN ---------------------------------------//
const { normalizarTexto } = require("../utils/normalizarTexto");
const catalogLoader = require("../catalog/loader");

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

function reemplazarNumerosPalabras(texto) {
  let palabras = texto.split(/\s+/);
  return palabras
    .map(p => (numerosPalabras[p.toLowerCase()] ? numerosPalabras[p.toLowerCase()] : p))
    .join(" ");
}

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

    let normalizado = normalizarTexto(textoProducto);
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
const axios = require("axios");

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

  // Enviar pedido a /pedido-libre (ventas.js)
  try {
    const response = await axios.post("http://localhost:4000/api/ventas/pedido-libre", {
      cliente,
      mensaje,
    });

    console.log("📦 Pedido registrado exitosamente:", response.data);
  } catch (error) {
    console.error("❌ Error enviando pedido a /api/ventas/pedido-libre:", error.response?.data || error.message);
  }

  // Retornar información útil (por si el webhook la usa)
  return { cliente, resultado };
}

// Exportamos ambas funciones
module.exports = { interpretarPedido, procesarMensajeTwilio, normalizarTexto };
