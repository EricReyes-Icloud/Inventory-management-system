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
  try {
    payload = await response.json();
  } catch {
    // A non-JSON body (proxy error, malformed JSON) is still a failed login.
  }

  if (!response.ok) {
    const error = new Error(
      (payload && payload.error) || `login_failed_${response.status}`
    );
    error.code = (payload && payload.error) || `http_${response.status}`;
    error.status = response.status;
    throw error;
  }

  return payload;
}
