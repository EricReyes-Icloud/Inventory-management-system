// src/lib/firestore.js
const admin = require("firebase-admin");

let serviceAccount;
try {
  serviceAccount = require("../secrets/serviceAccountKey.json");
} catch {
  // CI / fresh-clone fallback: use env-var credentials
  serviceAccount = null;
}

// Evita inicializar Firebase más de una vez
if (!admin.apps.length) {
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID || "test-project",
    });
  }
}

// Instancia de Firestore
const db = admin.firestore();

module.exports = db; // ✅ Exporta correctamente en CommonJS
