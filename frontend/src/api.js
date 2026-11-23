// Transport layer for the backend session endpoint. Kept separate from the
// Firebase SDK call so swapping the API base URL never touches auth logic.
import { getApiBaseUrl } from "./config.js";

const LOGIN_PATH = "/api/auth/login";
const ME_PATH = "/api/auth/me";

/**
 * Exchanges a Firebase ID token for a backend session result.
 * @param {string} idToken
 */
export async function loginWithIdToken(idToken) {
  const response = await fetch(`${getApiBaseUrl(import.meta.env)}${LOGIN_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  let payload = null;
  let parsed = false;
  try {
    payload = await response.json();
    parsed = true;
  } catch {
    // A non-JSON body (proxy error, malformed JSON) is still a failed login.
  }

  const errorCode = (payload && payload.error) || `http_${response.status}`;

  if (!response.ok || !parsed) {
    const error = new Error(
      (payload && payload.error) || `login_failed_${response.status}`
    );
    error.code = errorCode;
    error.status = response.status;
    throw error;
  }

  return payload;
}

/**
 * Asks the backend to verify a Firebase ID token through adminAuth.
 * Returns only the non-secret admin profile; the token is never persisted.
 * @param {string} idToken
 */
export async function verifyAdminSession(idToken) {
  let response;
  try {
    response = await fetch(`${getApiBaseUrl(import.meta.env)}${ME_PATH}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${idToken}` },
    });
  } catch {
    const error = new Error(
      "No se pudo conectar con el servicio. Revise su conexión."
    );
    error.code = "network_error";
    throw error;
  }

  let payload = null;
  let parsed = false;
  try {
    payload = await response.json();
    parsed = true;
  } catch {
    // A non-JSON body cannot confirm a valid session.
  }

  const confirmed = parsed && payload && payload.ok === true && payload.admin;
  if (!response.ok || !confirmed) {
    const code = (payload && (payload.error || payload.code)) || `http_${response.status}`;
    const error = new Error("La sesión no es válida.");
    error.code = code;
    error.status = response.status;
    throw error;
  }

  return payload.admin;
}
