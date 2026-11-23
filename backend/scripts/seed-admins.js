#!/usr/bin/env node
/**
 * One-time idempotent seed for the MVP0 login flow.
 *
 * Reads the three admin documents that ALREADY exist in Firestore under
 * Usuarios/Usuarios/{Admin,Admin_2,Admin_3}, creates the matching Firebase Auth
 * users with secure random passwords, and flags each Firestore document with
 * passwordChangeRequired: true so the login flow can force a first change.
 *
 * Usage (run from the repo root):
 *   npm run seed:admins -- --dry-run   # read-only preview; no Auth or Firestore writes
 *   npm run seed:admins                # create missing Auth users + write flags
 *
 * Credentials come from the repo's canonical backend/src/lib/firestore.js.
 * Existing Auth users are never recreated or have their password reset.
 */

const crypto = require("crypto");

const ADMIN_ROOT = "Usuarios/Usuarios";
const SUBCOLLECTIONS = ["Admin", "Admin_2", "Admin_3"];

/**
 * 24 random bytes encoded as base64url = 32 URL-safe characters.
 * A fresh value is produced for every admin, and none is persisted in Firestore.
 */
function generateSecurePassword() {
  return crypto.randomBytes(24).toString("base64url");
}

/**
 * Resolve the three real admin documents. Every admin must be active, have the
 * admin role and carry a valid Email/Nombre; otherwise the seed aborts before
 * any Auth or Firestore write.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<Array<{subcollection:string,docId:string,path:string,ref:object,email:string,nombre:string,telefono:* }>>}
 */
async function collectAdmins(db) {
  const parent = db.collection("Usuarios").doc("Usuarios");
  const entries = [];

  for (const subcollection of SUBCOLLECTIONS) {
    const snapshot = await parent.collection(subcollection).get();

    if (snapshot.size !== 1) {
      const detail = snapshot.size === 0 ? "empty" : "more than one";
      throw new Error(
        `Seed aborted: ${ADMIN_ROOT}/${subcollection} has ${snapshot.size} documents (${detail}); expected exactly 1.`
      );
    }

    const doc = snapshot.docs[0];
    const data = doc.data() || {};
    const location = `${ADMIN_ROOT}/${subcollection}/${doc.id}`;

    if (typeof data.Email !== "string" || !data.Email.trim()) {
      throw new Error(`Seed aborted: ${location} has no valid Email.`);
    }
    if (data.Activo !== true) {
      throw new Error(`Seed aborted: ${location} is not Activo.`);
    }
    if (data.Rol !== "admin") {
      throw new Error(`Seed aborted: ${location} has Rol=${data.Rol}, expected admin.`);
    }
    if (typeof data.Nombre !== "string" || !data.Nombre.trim()) {
      throw new Error(`Seed aborted: ${location} has no valid Nombre.`);
    }

    entries.push({
      subcollection,
      docId: doc.id,
      path: doc.ref.path,
      ref: doc.ref,
      email: data.Email.trim(),
      nombre: data.Nombre.trim(),
      telefono: data.Telefono || null,
      needsFlag: data.passwordChangeRequired !== true,
    });
  }

  return entries;
}

/**
 * Create the missing Auth users and flag their Firestore documents.
 * Both dependencies are injected so the write path is testable without Firebase.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{getUserByEmail:Function,createUser:Function}} auth
 * @param {{generatePassword?:Function}} [deps]
 */
async function seedAdmins(db, auth, deps = {}) {
  const generatePassword = deps.generatePassword || generateSecurePassword;
  const entries = await collectAdmins(db);
  const created = [];
  const skipped = [];

  for (const entry of entries) {
    let existing = null;
    try {
      existing = await auth.getUserByEmail(entry.email);
    } catch (error) {
      if (error && error.code === "auth/user-not-found") {
        existing = null;
      } else {
        throw error;
      }
    }

    if (existing) {
      skipped.push(entry.email);
      continue;
    }

    const password = generatePassword();
    const user = await auth.createUser({
      email: entry.email,
      password,
      displayName: entry.nombre,
      emailVerified: false,
    });

    created.push({
      email: entry.email,
      uid: user.uid,
      password,
      entry,
    });
  }

  // Flag every document still missing the marker, including admins whose Auth
  // user already existed. This repairs a run that created Auth users but failed
  // before committing the Firestore batch.
  const toFlag = entries.filter((entry) => entry.needsFlag);
  let flagsWritten = 0;
  if (toFlag.length > 0) {
    const batch = db.batch();
    for (const entry of toFlag) {
      batch.set(entry.ref, { passwordChangeRequired: true }, { merge: true });
    }
    await batch.commit();
    flagsWritten = toFlag.length;
  }

  return { created, skipped, flagsWritten };
}

async function dryRun(db) {
  const entries = await collectAdmins(db);
  console.log("=== DRY RUN ===");
  for (const entry of entries) {
    console.log(`  ${entry.path}: email=${entry.email}, nombre=${entry.nombre}`);
  }
  console.log("\nNo Auth users created and no Firestore writes made (--dry-run).");
}

if (require.main === module) {
  (async () => {
    const db = require("../src/lib/firestore");

    if (process.argv.includes("--dry-run")) {
      await dryRun(db);
      return;
    }

    const admin = require("firebase-admin");
    const result = await seedAdmins(db, admin.auth());

    console.log("\n=== Firebase Auth users created ===");
    for (const item of result.created) {
      console.log(`  ${item.email} (uid=${item.uid})`);
      console.log(`    one-time password: ${item.password}`);
    }
    if (result.skipped.length) {
      console.log("\nSkipped existing Auth users (password left unchanged):");
      for (const email of result.skipped) console.log(`  ${email}`);
    }
    console.log(
      `\nDone. Created ${result.created.length} Auth user(s), flagged ${result.flagsWritten} Firestore document(s).`
    );
    console.log("Deliver the one-time passwords securely; admins must change them on first login.");
  })().catch((error) => {
    console.error("Seed failed:", error.message || error);
    process.exit(1);
  });
}

module.exports = {
  ADMIN_ROOT,
  SUBCOLLECTIONS,
  generateSecurePassword,
  collectAdmins,
  seedAdmins,
  dryRun,
};
