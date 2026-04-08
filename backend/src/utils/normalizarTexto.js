
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

module.exports = {
  normalizarTexto
};