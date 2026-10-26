
function normalizarTexto(texto) {
  return texto
    .toLowerCase() // Convierte a minusculas
    // Preservar ñ ANTES de NFD: NFD descompone ñ (U+00F1) en n + tilde
    // combinable (U+0303), y el replace de diacríticos luego borra esa tilde,
    // dejando una "n" simple (caña -> cana). Marcadores privados (Private Use
    // Area) que no aparecen en texto real y sobreviven a NFD.
    .replace(/ñ/g, "\uE000")
    .replace(/Ñ/g, "\uE001")
    .normalize("NFD") // Normaliza acentos (solamente los separa)
    .replace(/[\u0300-\u036f]/g, "") // Elimina acentos que ya habiamos separado
    .replace(/\uE000/g, "ñ") // Restaura ñ
    .replace(/\uE001/g, "ñ") // Restaura Ñ (ya en minusculas)
    .replace(/[^\p{L}\p{N}\s]/gu, "") // Elimina símbolos raros, todo lo que no sea letras (\w) o espacios (\s)
    .replace(/\bclavos\b/g, "clavo") 
    .replace(/\bajies\b/g, "aji")          // Convertimos plurares a singulares
    .replace(/\bmieles\b/g, "miel")
    .replace(/\bde\b/g, "*") // Convierte "de" en "*"
    .replace(/\s+/g, " ") // Limpia espacios duplicados
    .trim(); // Elimina espacios al inicio y al final
}

module.exports = {
  normalizarTexto
};