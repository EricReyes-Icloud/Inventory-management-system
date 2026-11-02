// Maps expected domain/validation errors to safe HTTP responses.
// Unexpected infrastructure errors keep their details in server logs only.

const ALLOWED_ERROR_CODES = new Set([
  "NO_EXISTE_TOTAL_PRODUCTOS",
  "NO_EXISTE_CARTONES_VENDIDOS",
  "INVERSION_NO_REGISTRADA",
  "CATEGORIA_SIN_VENTAS",
  "CATEGORIA_SIN_CARTONES",
  "GANANCIA_NO_CALCULADA",
]);

const VALIDATION_MESSAGE_PREFIXES = [
  "mesAnio es obligatorio",
  "Formato de mesAnio inválido:",
  "Mes inválido:",
  "Año inválido:",
];

function safeErrorMessage(error) {
  if (error?.code && ALLOWED_ERROR_CODES.has(error.code)) {
    return { status: 400, message: error.message };
  }

  if (
    typeof error?.message === "string" &&
    VALIDATION_MESSAGE_PREFIXES.some((prefix) => error.message.startsWith(prefix))
  ) {
    return { status: 400, message: error.message };
  }

  return { status: 500, message: "Error interno del servidor" };
}

module.exports = { safeErrorMessage };
