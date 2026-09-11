// scripts/get-token.js
// Genera un Firebase ID Token de prueba para administradores.
// Uso: node scripts/get-token.js <email>
// Ejemplo: node scripts/get-token.js ereyes102504k@icloud.com

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const admin = require("firebase-admin");
const serviceAccount = require("../src/secrets/serviceAccountKey.json");

const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;
const API_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`;

// ─────────────────────────────────────────────
// Init Admin SDK (evita duplicados)
// ─────────────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("❌ Uso: node scripts/get-token.js <email>");
    console.error("   Ej:  node scripts/get-token.js ereyes102504k@icloud.com");
    process.exit(1);
  }

  if (!WEB_API_KEY) {
    console.error("❌ FIREBASE_WEB_API_KEY no está definida en backend/.env");
    process.exit(1);
  }

  try {
    // 1. Obtener UID real del usuario por email
    const userRecord = await admin.auth().getUserByEmail(email);
    const uid = userRecord.uid;

    // 2. Generar custom token con el UID real
    const customToken = await admin.auth().createCustomToken(uid);

    // 3. Intercambiar por ID Token vía REST API
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true,
      }),
    });

    const data = await response.json();

    if (!data.idToken) {
      console.error("❌ Error al intercambiar token:", data.error?.message || JSON.stringify(data));
      process.exit(1);
    }

    console.log("\n✅ Token generado exitosamente\n");
    console.log(data.idToken);
    console.log("\n📌 Copiá este token y usalo en el header:");
    console.log(`   Authorization: Bearer ${data.idToken}\n`);

    // Mostrar datos del usuario para confirmar
    console.log("👤 Usuario:", email);
    console.log("🆔 UID:", uid);
    console.log("⏰ Expira:", new Date(Date.now() + parseInt(data.expiresIn) * 1000).toLocaleString());
    console.log("──────────────────────────────────────────\n");
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      console.error(`❌ No existe un usuario en Firebase Auth con el email: ${email}`);
      console.error("   Asegurate de haber creado el usuario en Firebase Authentication primero.");
    } else {
      console.error("❌ Error:", err.message);
    }
    process.exit(1);
  }
}

main();
