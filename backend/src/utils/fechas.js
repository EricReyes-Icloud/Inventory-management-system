// src/utils/fechas.js

// Función auxiliar para obtener nombre del mes en español
const meses = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];
function obtenerMesAnio(fecha) {
  const mes = meses[fecha.getMonth()]; // Obtiene el número del mes (0-11)
  const anio = fecha.getFullYear(); // Obtiene el año de la fecha 
  return `${mes} ${anio}`; // Ej: "Septiembre 2025"
}

/**
 * Valida que un string tenga formato de mes-año: "Enero 2026"
 * @param {string} mesAnio
 * @returns {{ ok: true }} o lanza Error con mensaje específico
 */
function validateMesAnio(mesAnio) {
  if (typeof mesAnio !== "string" || !mesAnio.trim()) {
    throw new Error("mesAnio es obligatorio");
  }

  const partes = mesAnio.trim().split(/\s+|-/);
  if (partes.length !== 2) {
    throw new Error(
      `Formato de mesAnio inválido: "${mesAnio}". Esperado: "Mes AAAA"`
    );
  }

  const [mes, anioStr] = partes;
  if (!meses.includes(mes)) {
    throw new Error(
      `Mes inválido: "${mes}". Debe ser uno de: ${meses.join(", ")}`
    );
  }

  const anio = Number(anioStr);
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    throw new Error(
      `Año inválido: "${anioStr}". Debe ser un número de 4 dígitos (2000-2100)`
    );
  }

  return { ok: true };
}

module.exports = { obtenerMesAnio, validateMesAnio };
  