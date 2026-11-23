// Pure route-guard use case. It asks Firebase for a fresh ID token and asks
// the backend (GET /api/auth/me) to verify it through adminAuth. No token is
// stored here: the result only carries the non-secret admin profile.

const EXPIRED_CODES = new Set([
  "invalid_token",
  "http_400",
  "http_401",
  "auth/user-disabled",
  "auth/user-not-found",
  "auth/invalid-user-token",
  "auth/user-token-expired",
]);

const NOT_ADMIN_CODES = new Set(["admin_not_found", "http_403"]);

const MESSAGES = {
  not_authenticated: "Inicie sesión para continuar.",
  session_expired: "La sesión expiró. Inicie sesión nuevamente.",
  admin_not_found: "Este usuario no tiene permisos de administrador.",
  verification_failed: "No se pudo verificar la sesión. Intente nuevamente.",
};

function errorCode(error) {
  return error && typeof error.code === "string" ? error.code : "";
}

/**
 * Runs the guard check with injected collaborators.
 * @param {{getToken: Function, verify: Function}} deps
 * @returns {Promise<{ok: true, admin: object}|{ok: false, reason: string}>}
 */
export async function runSessionCheck({ getToken, verify }) {
  let token;
  try {
    token = await getToken();
  } catch (error) {
    if (EXPIRED_CODES.has(errorCode(error))) {
      return { ok: false, reason: "session_expired" };
    }
    return { ok: false, reason: "verification_failed" };
  }

  if (typeof token !== "string" || token.trim() === "") {
    return { ok: false, reason: "not_authenticated" };
  }

  try {
    const admin = await verify(token);
    return { ok: true, admin };
  } catch (error) {
    const code = errorCode(error);
    if (EXPIRED_CODES.has(code)) return { ok: false, reason: "session_expired" };
    if (NOT_ADMIN_CODES.has(code)) return { ok: false, reason: "admin_not_found" };
    return { ok: false, reason: "verification_failed" };
  }
}

/**
 * Safe, user-facing message for a guard failure reason.
 * @param {string} reason
 */
export function sessionErrorMessage(reason) {
  return MESSAGES[reason] || MESSAGES.verification_failed;
}
