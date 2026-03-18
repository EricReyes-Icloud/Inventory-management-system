// src/utils/fechas.js

// Función auxiliar para obtener nombre del mes en español
const meses = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];
function obtenerMesAnio(fecha) {
  const mes = meses[fecha.getMonth()];
  const anio = fecha.getFullYear();
  return `${mes} ${anio}`; // Ej: "Septiembre 2025"
}

  
  module.exports = { obtenerMesAnio };
  