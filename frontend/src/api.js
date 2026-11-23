// Transport layer for the backend session endpoint. Kept separate from the
// Firebase SDK call so swapping the API base URL never touches auth logic.
import { getApiBaseUrl } from "./config.js";

const LOGIN_PATH = "/api/auth/login";

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
