// src/lib/firestore.js
const admin = require("firebase-admin");
const serviceAccount = require("../secrets/serviceAccountKey.json");

// Evita inicializar Firebase más de una vez
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

// Instancia de Firestore
const db = admin.firestore();

module.exports = db; // ✅ Exporta correctamente en CommonJS
