//------------------------------------------ INTURIS BRAIN -------------------------------------------//
const Fuse = require("fuse.js");

// ----------------------
// 1. Normalizador de texto
// ----------------------
function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "") // quita símbolos raros
    .replace(/\bclavos\b/g, "clavo")
    .replace(/\bajies\b/g, "aji")
    .replace(/\bmieles\b/g, "miel")
    .replace(/\bde\b/g, "*") // 🔥 convierte “de” en “*”
    .replace(/\s+/g, " ") // limpia dobles espacios
    .trim();
}

// ----------------------
// 2. Diccionario de palabras numéricas
// ----------------------
const numerosPalabras = {
  uno: 1, una: 1,
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
// 3. Productos originales
// ----------------------
const productosOriginales = [
  "Aji * 100",
  "Aji * 50",
  "Ajo en polvo * 50",
  "Bicarbonato * 100",
  "Bicarbonato * 50",
  "Canela * 100 pequeña",
  "Canela * 50 grande",
  "Canela * 50 mediana",
  "Canela * 50 pequeña",
  "Canela molida * 50",
  "Canela molidad * 100",
  "Clavo * 100",
  "Clavo * 50",
  "Coco * 30",
  "Color * 50",
  "Comino * 50",
  "Copas de miel",
  "Frasco de miel",
  "Media botella miel",
  "Miel * 100",
  "Miel * 50",
  "Miel jumbo * 50",
  "Salsina * 50",
  "Uva * 30"
];

// ----------------------
// 4. Equivalencias
// ----------------------
const equivalencias = {
  // =====================
  // 🌶️ AJÍ
  // =====================
  [normalizarTexto("aji 100")]: "Aji * 100",
  [normalizarTexto("aji grande")]: "Aji * 100",
  [normalizarTexto("aji pequeño")]: "Aji * 50",
  [normalizarTexto("aji 50")]: "Aji * 50",
  [normalizarTexto("ajies")]: "Aji * 100",
  [normalizarTexto("ajies pequeños")]: "Aji * 50",
  [normalizarTexto("ajies grandes")]: "Aji * 100",

  // =====================
  // 🧄 AJO EN POLVO
  // =====================
  [normalizarTexto("ajo en polvo")]: "Ajo en polvo * 50",
  [normalizarTexto("ajo polvo")]: "Ajo en polvo * 50",
  [normalizarTexto("ajo molido")]: "Ajo en polvo * 50",

  // =====================
  // 🧂 BICARBONATO
  // =====================
  [normalizarTexto("bicarbonato 100")]: "Bicarbonato * 100",
  [normalizarTexto("bicarbonato grande")]: "Bicarbonato * 100",
  [normalizarTexto("bicarbonato 50")]: "Bicarbonato * 50",
  [normalizarTexto("bicarbonato pequeño")]: "Bicarbonato * 50",

  // =====================
  // 🌰 CANELA ENTERA
  // =====================
  [normalizarTexto("canela 100")]: "Canela * 100 pequeña",
  [normalizarTexto("canela grande")]: "Canela * 50 grande",
  [normalizarTexto("canela mediana")]: "Canela * 50 mediana",
  [normalizarTexto("canela pequeña")]: "Canela * 50 pequeña",
  [normalizarTexto("canela en rama")]: "Canela * 50 mediana",

  // =====================
  // 🌰 CANELA MOLIDA
  // =====================
  [normalizarTexto("canela molida 50")]: "Canela molida * 50",
  [normalizarTexto("canela molida 100")]: "Canela molidad * 100",
  [normalizarTexto("canela polvo")]: "Canela molida * 50",
  [normalizarTexto("canela molida")]: "Canela molida * 50",

  // =====================
  // 🌸 CLAVO
  // =====================
  [normalizarTexto("clavo")]: "Clavo * 100",
  [normalizarTexto("clavos")]: "Clavo * 100",
  [normalizarTexto("clavo 100")]: "Clavo * 100",
  [normalizarTexto("clavo grande")]: "Clavo * 100",
  [normalizarTexto("clavo 50")]: "Clavo * 50",
  [normalizarTexto("clavo pequeño")]: "Clavo * 50",
  [normalizarTexto("clavos de 100")]: "Clavo * 100",
  [normalizarTexto("clavos de 50")]: "Clavo * 50",

  // =====================
  // 🥥 COCO
  // =====================
  [normalizarTexto("coco")]: "Coco * 30",
  [normalizarTexto("coco pequeño")]: "Coco * 30",

  // =====================
  // 🎨 COLOR
  // =====================
  [normalizarTexto("color")]: "Color * 50",
  [normalizarTexto("color pequeño")]: "Color * 50",

  // =====================
  // 🌿 COMINO
  // =====================
  [normalizarTexto("comino")]: "Comino * 50",
  [normalizarTexto("comino pequeño")]: "Comino * 50",

  // =====================
  // 🍯 MIEL
  // =====================
  [normalizarTexto("miel")]: "Miel * 100",
  [normalizarTexto("miel grande")]: "Miel * 100",
  [normalizarTexto("miel pequeña")]: "Miel * 50",
  [normalizarTexto("miel mediana")]: "Miel * 50",
  [normalizarTexto("frasco de miel")]: "Frasco de miel",
  [normalizarTexto("frasco miel")]: "Frasco de miel",
  [normalizarTexto("frasco")]: "Frasco de miel",
  [normalizarTexto("copas de miel")]: "Copas de miel",
  [normalizarTexto("copa de miel")]: "Copas de miel",
  [normalizarTexto("media botella")]: "Media botella miel",
  [normalizarTexto("botella de miel")]: "Media botella miel",
  [normalizarTexto("miel jumbo")]: "Miel jumbo * 50",

  // =====================
  // 🧂 SALSINA
  // =====================
  [normalizarTexto("salsina")]: "Salsina * 50",
  [normalizarTexto("salsina pequeña")]: "Salsina * 50",

  // =====================
  // 🍇 UVA
  // =====================
  [normalizarTexto("uva")]: "Uva * 30",
  [normalizarTexto("uva pequeña")]: "Uva * 30"
};


// ----------------------
// 5. Fuzzy Search
// ----------------------
const fuse = new Fuse(
  productosOriginales.map(p => ({
    original: p,
    normalizado: normalizarTexto(p)
  })),
  {
    keys: ["normalizado"],
    threshold: 0.55 // más tolerante
  }
);

// ----------------------
// 6. Interpretador del pedido
// ----------------------
function interpretarPedido(pedido) {
  let textoProcesado = reemplazarNumerosPalabras(pedido);
  console.log("Texto procesado:", textoProcesado);

  let partes = textoProcesado.split(/,| y /i).map(p => p.trim());
  let resultados = [];

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

    if (equivalencias[normalizado]) {
      resultados.push({
        producto: equivalencias[normalizado],
        cantidad,
        confianza: 1,
        sugerencias: []
      });
      continue;
    }

    const busqueda = fuse.search(normalizado);

    if (busqueda.length > 0 && busqueda[0].score < 0.8) {
      resultados.push({
        producto: busqueda[0].item.original,
        cantidad,
        confianza: Number((1 - busqueda[0].score).toFixed(2)),
        sugerencias: []
      });
      continue;
    } else {
      const sugerencias = busqueda.slice(0, 3).map(r => r.item.original);
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

  // 1️⃣ Interpretar el pedido
  const resultado = interpretarPedido(body);
  console.log("🧠 Interpretación del mensaje:", JSON.stringify(resultado, null, 2));

  // 2️⃣ Determinar el cliente
  const cliente = clienteDetectado || "Desconocido";
  const mensaje = body;

  // 3️⃣ Enviar pedido a /pedido-libre (ventas.js)
  try {
    const response = await axios.post("http://localhost:4000/api/ventas/pedido-libre", {
      cliente,
      mensaje,
    });

    console.log("📦 Pedido registrado exitosamente:", response.data);
  } catch (error) {
    console.error("❌ Error enviando pedido a /api/ventas/pedido-libre:", error.response?.data || error.message);
  }

  // 4️⃣ Retornar información útil (por si el webhook la usa)
  return { cliente, resultado };
}

// Exportamos ambas funciones
module.exports = { interpretarPedido, procesarMensajeTwilio };
