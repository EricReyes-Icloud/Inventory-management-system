// Login use case: browser password sign-in -> Firebase ID token -> backend
// exchange. Collaborators are injected so this flow is testable in Node and
// the page stays a thin presentation layer.

const TOO_MANY_ATTEMPTS =
  "Demasiados intentos. Espere unos minutos e intente nuevamente.";
const SERVER_ERROR = "Ocurrió un error del servidor. Intente nuevamente.";
const SESSION_EXPIRED = "La sesión expiró. Inicie sesión nuevamente.";
const NO_PERMISSIONS = "Este usuario no tiene permisos de administrador.";
const FALLBACK = "No se pudo iniciar sesión. Intente nuevamente.";

const MESSAGES = new Map([
  ["auth/invalid-email", "Ingrese un correo electrónico válido."],
  ["auth/missing-password", "Ingrese la contraseña."],
  ["auth/invalid-credential", "Correo o contraseña incorrectos."],
  ["auth/user-not-found", "Correo o contraseña incorrectos."],
  ["auth/wrong-password", "Correo o contraseña incorrectos."],
  ["auth/too-many-requests", TOO_MANY_ATTEMPTS],
  [
    "auth/network-request-failed",
    "No se pudo conectar con el servicio. Revise su conexión e intente nuevamente.",
  ],
  [
    "auth/unauthorized-domain",
    "Este dominio no está autorizado para iniciar sesión.",
  ],
  ["invalid_request", "No se pudo validar la solicitud. Intente nuevamente."],
  ["invalid_token", SESSION_EXPIRED],
  ["admin_not_found", NO_PERMISSIONS],
  ["internal_error", SERVER_ERROR],
  ["http_500", SERVER_ERROR],
  ["too_many_requests", TOO_MANY_ATTEMPTS],
  ["http_429", TOO_MANY_ATTEMPTS],
  ["http_401", SESSION_EXPIRED],
  ["http_403", NO_PERMISSIONS],
]);

/**
 * Maps Firebase Auth and backend error codes to a message safe to display.
 * @param {{code?: string}|null} error
 */
export function describeLoginError(error) {
  if (!error) return FALLBACK;
  const code = typeof error.code === "string" ? error.code : "";
  return MESSAGES.get(code) || FALLBACK;
}

/**
 * Runs the sign-in flow. The backend echoes the same ID token, so no session
 * value is stored here: Firebase Auth owns credential persistence.
 *
 * @param {{email: string, password: string, auth: object,
 *          signIn: Function, exchange: Function}} deps
 */
export async function runLogin({ email, password, auth, signIn, exchange }) {
  const credential = await signIn(auth, email, password);
  const idToken = await credential.user.getIdToken();
  return exchange(idToken);
}
