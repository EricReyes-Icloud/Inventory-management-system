// src/services/auth.service.js
// T2 / S2: login with a Firebase ID token issued by the client SDK.
//
// The Admin SDK verifies ID tokens; it does not verify passwords. Password
// sign-in happens in the frontend with the Firebase JS SDK, which sends the
// resulting ID token here. This service owns the business rule: a valid token
// is not enough, the email must also match an active admin in Firestore.

const AUTH_ERROR_CODES = {
  INVALID_REQUEST: "invalid_request",
  INVALID_TOKEN: "invalid_token",
  ADMIN_NOT_FOUND: "admin_not_found",
};

class AuthServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AuthServiceError";
    this.code = code;
  }
}

/**
 * Verify the client's ID token and resolve the matching admin.
 *
 * Dependencies are injected for tests. Production defaults are resolved lazily
 * so requiring this module never initializes firebase-admin or Firestore.
 *
 * @param {string} idToken
 * @param {{verifyIdToken?:Function, findAdminByEmail?:Function}} [deps]
 */
async function loginWithIdToken(idToken, deps = {}) {
  const verifyIdToken =
    deps.verifyIdToken ||
    ((token) => require("firebase-admin").auth().verifyIdToken(token));
  const findAdminByEmail =
    deps.findAdminByEmail ||
    ((email) =>
      require("../repositories/admin.repository").getAdminByEmailAnyCollection(email));

  if (typeof idToken !== "string" || idToken.trim() === "") {
    throw new AuthServiceError(AUTH_ERROR_CODES.INVALID_REQUEST, "idToken is required");
  }

  const token = idToken.trim();
  let decoded;
  try {
    decoded = await verifyIdToken(token);
  } catch (_error) {
    throw new AuthServiceError(AUTH_ERROR_CODES.INVALID_TOKEN, "Invalid or expired token");
  }

  const email = decoded && decoded.email;
  if (!email || typeof email !== "string") {
    throw new AuthServiceError(AUTH_ERROR_CODES.INVALID_TOKEN, "Token has no email");
  }

  const snapshot = await findAdminByEmail(email);
  if (!snapshot || snapshot.empty || !snapshot.docs || snapshot.docs.length === 0) {
    throw new AuthServiceError(AUTH_ERROR_CODES.ADMIN_NOT_FOUND, "Admin not found");
  }

  const data = snapshot.docs[0].data() || {};
  return {
    token,
    admin: {
      uid: decoded.uid,
      email,
      nombre: data.Nombre,
    },
    passwordChangeRequired: data.passwordChangeRequired === true,
  };
}

module.exports = { loginWithIdToken, AuthServiceError, AUTH_ERROR_CODES };
