
function normalizarTexto(texto) {
  return texto
    .toLowerCase() // Convierte a minusculas
    .normalize("NFD") // Normaliza acentos (solamente los separa)
    .replace(/[\u0300-\u036f]/g, "") // Elimina acentos que ya habiamos separado
    .replace(/[^\w\s]/g, "") // Elimina símbolos raros, todo lo que no sea letras (\w) o espacios (\s)
    .replace(/\bclavos\b/g, "clavo") 
    .replace(/\bajies\b/g, "aji")          // Convertimos plurares a singulares
    .replace(/\bmieles\b/g, "miel")
    .replace(/\bde\b/g, "*") // Convierte “de” en “*”
    .replace(/\s+/g, " ") // Limpia espacios duplicados
    .trim(); // Elimina espacios al inicio y al final
}

module.exports = {
  normalizarTexto
};