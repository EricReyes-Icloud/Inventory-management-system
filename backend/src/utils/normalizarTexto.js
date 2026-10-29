
function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .replace(/ñ/g, "\uE000")
    .replace(/Ñ/g, "\uE001")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\uE000/g, "ñ")
    .replace(/\uE001/g, "ñ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Reglas de negocio: plurales y "de" → "*" (aplicadas ANTES de normalizar)
// Exportadas para que tanto el loader (buildEquivalencias) como el intérprete
// usen el MISMO pipeline y las claves coincidan.
function aplicarReglasNegocio(texto) {
  return texto
    .replace(/\bclavos\b/g, "clavo")
    .replace(/\bajies\b/g, "aji")
    .replace(/\bmieles\b/g, "miel")
    .replace(/\bde\b/g, "*");
}

// Pipeline completo para claves de equivalencias: reglas de negocio + normalización Unicode.
// Usar en buildEquivalencias (loader) y en interpretarPedido (inturis).
function normalizarParaEquivalencias(texto) {
  return normalizarTexto(aplicarReglasNegocio(texto));
}

// Convierte números en palabras a dígitos (ej: "un" → 1, "dos" → 2)
function reemplazarNumerosPalabras(texto) {
  let palabras = texto.split(/\s+/);
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
  return palabras
    .map(p => (numerosPalabras[p.toLowerCase()] ? numerosPalabras[p.toLowerCase()] : p))
    .join(" ");
}

module.exports = {
  normalizarTexto,
  aplicarReglasNegocio,
  normalizarParaEquivalencias,
  reemplazarNumerosPalabras
};