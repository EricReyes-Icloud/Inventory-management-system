// Frontend configuration. The backend default port is 4000 (backend/src/config.js).
// Vite only exposes variables prefixed with VITE_ to client code.

const REQUIRED_FIREBASE_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
];

function present(value) {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Builds the Firebase Web SDK config from Vite's environment.
 * @param {ImportMetaEnv} env
 */
export function getFirebaseConfig(env) {
  const missing = REQUIRED_FIREBASE_KEYS.filter((key) => !present(env[key]));

  if (missing.length > 0) {
    const error = new Error(
      `Missing Firebase client config: ${missing.join(", ")}`
    );
    error.code = "missing_firebase_config";
    throw error;
  }

  return {
    apiKey: env.VITE_FIREBASE_API_KEY.trim(),
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN.trim(),
    projectId: env.VITE_FIREBASE_PROJECT_ID.trim(),
  };
}

/**
 * Base URL of the backend API.
 * @param {ImportMetaEnv} env
 */
export function getApiBaseUrl(env) {
  return present(env.VITE_API_BASE_URL)
    ? env.VITE_API_BASE_URL.trim().replace(/\/+$/, "")
    : "http://localhost:4000";
}
