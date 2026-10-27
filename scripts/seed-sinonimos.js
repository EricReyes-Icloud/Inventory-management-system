#!/usr/bin/env node
/**
 * One-time idempotent migration: writes sinonimos + categoria fields
 * to each product document in Firestore.
 *
 * SNAPSHOT: This data was extracted from inturis.js (equivalencias map)
 * and diccionario.js (diccionarioCategorias) at authoring time (2026-09-18).
 *
 * Usage (run from the repo root):
 *   npm run seed:catalog -- --dry-run   # Preview the writes; never touches Firestore
 *   npm run seed:catalog                # Execute the writes
 *
 * Credentials come from backend/src/secrets/serviceAccountKey.json — the same
 * file backend/src/lib/firestore.js uses. No environment variables required.
 */

const path = require("path");

// firebase-admin lives in the backend workspace's node_modules, so this
// root-level script cannot resolve it by bare name. Resolve it explicitly
// instead of requiring NODE_PATH in the environment.
const BACKEND_NODE_MODULES = path.join(__dirname, "..", "backend", "node_modules");
const SERVICE_ACCOUNT_PATH = path.join(
  __dirname,
  "..",
  "backend",
  "src",
  "secrets",
  "serviceAccountKey.json"
);

function requireFromBackend(name) {
  return require(require.resolve(name, { paths: [BACKEND_NODE_MODULES] }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SNAPSHOT DATA — extracted at authoring time from inturis.js + diccionario.js
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Synonym map: canonical product name → array of normalized synonym strings.
 * Total: 53 entries across 24 products.
 * Keys match the productsOriginales array from inturis.js.
 * Values are the lowercase, normalized forms from the equivalencias map.
 */
const SNAPSHOT_SYNONYMS = {
  "Aji * 100": ["aji 100", "aji grande", "ajies", "ajies grandes"],
  "Aji * 50": ["aji pequeño", "aji 50", "ajies pequeños"],
  "Ajo en polvo * 50": ["ajo en polvo", "ajo polvo", "ajo molido"],
  "Bicarbonato * 100": ["bicarbonato 100", "bicarbonato grande"],
  "Bicarbonato * 50": ["bicarbonato 50", "bicarbonato pequeño"],
  "Canela * 100 pequeña": ["canela 100"],
  "Canela * 50 grande": ["canela grande"],
  "Canela * 50 mediana": ["canela mediana", "canela en rama"],
  "Canela * 50 pequeña": ["canela pequeña"],
  "Canela molida * 50": [
    "canela molida 50",
    "canela polvo",
    "canela molida",
  ],
  "Canela molidad * 100": ["canela molida 100"],
  "Clavo * 100": [
    "clavo",
    "clavos",
    "clavo 100",
    "clavo grande",
    "clavos de 100",
  ],
  "Clavo * 50": ["clavo 50", "clavo pequeño", "clavos de 50"],
  "Coco * 30": ["coco", "coco pequeño"],
  "Color * 50": ["color", "color pequeño"],
  "Comino * 50": ["comino", "comino pequeño"],
  "Copas de miel": ["copas de miel", "copa de miel"],
  "Frasco de miel": ["frasco de miel", "frasco miel", "frasco"],
  "Media botella miel": ["media botella", "botella de miel"],
  "Miel * 100": ["miel", "miel grande"],
  "Miel * 50": ["miel pequeña", "miel mediana"],
  "Miel jumbo * 50": ["miel jumbo"],
  "Salsina * 50": ["salsina", "salsina pequeña"],
  "Uva * 30": ["uva", "uva pequeña"],
};

/**
 * Category map: canonical product name → category key.
 * Total: 11 categories across 24 products.
 * Keys match diccionarioCategorias from diccionario.js.
 */
const SNAPSHOT_CATEGORIES = {
  "Aji * 100": "Aji",
  "Aji * 50": "Aji",
  "Ajo en polvo * 50": "Ajo_en_polvo",
  "Bicarbonato * 100": "Bicarbonato",
  "Bicarbonato * 50": "Bicarbonato",
  "Canela * 100 pequeña": "Canela",
  "Canela * 50 grande": "Canela",
  "Canela * 50 mediana": "Canela",
  "Canela * 50 pequeña": "Canela",
  "Canela molida * 50": "Canela_molida",
  "Canela molidad * 100": "Canela_molida",
  "Clavo * 100": "Clavo",
  "Clavo * 50": "Clavo",
  "Coco * 30": "Coco",
  "Color * 50": "Color",
  "Comino * 50": "Comino",
  "Copas de miel": "Miel",
  "Frasco de miel": "Miel",
  "Media botella miel": "Miel",
  "Miel * 100": "Miel",
  "Miel * 50": "Miel",
  "Miel jumbo * 50": "Miel",
  "Salsina * 50": "Salsina",
  "Uva * 30": "Uva",
};

// ═══════════════════════════════════════════════════════════════════════════════
// DRY RUN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns an array of write descriptors for dry-run mode.
 * Each descriptor describes the Firestore write that would be made.
 *
 * @returns {Array<{product: string, sinonimos: string[], categoria: string}>}
 */
function dryRun() {
  return Object.entries(SNAPSHOT_SYNONYMS).map(([product, sinonimos]) => ({
    product,
    nombreCanonico: product,
    sinonimos,
    categoria: SNAPSHOT_CATEGORIES[product] || null,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIRESTORE WRITES (only executed when NOT in dry-run mode)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Applies the seed writes against an injected Firestore db.
 * Exported so the write path can be tested without touching Firestore.
 *
 * Each subcollection holds exactly one product document, and the readers
 * (`productos.repository.js`: `buscarSubcoleccion`, `getCatalogo`) take the
 * FIRST document of the subcollection. Writing to `.doc(product)` would create
 * a second document whose ID sorts before the real one — a collection query
 * without orderBy is ordered by document ID, and " " (0x20) sorts before "_"
 * (0x5F) — so the readers would then return a document with no price fields.
 * That is exactly the production bug (price 0 on 18 products).
 *
 * Therefore: resolve the document that already exists, refuse to guess when the
 * subcollection is empty or ambiguous, and write everything in one batch.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Array<{product: string, sinonimos: string[], categoria: string|null}>} entries
 * @returns {Promise<number>} number of documents written
 */
async function seedCatalog(db, entries) {
  const COLRef = db.collection("Productos").doc("Productos_ID");

  // ── Phase 1: resolve the existing document for every product (reads only) ──
  const plan = [];

  for (const { product, sinonimos, categoria } of entries) {
    const subcolSnap = await COLRef.collection(product).get();

    if (subcolSnap.empty) {
      throw new Error(
        `Seed aborted: subcollection "${product}" has no documents; refusing to create one.`
      );
    }

    if (subcolSnap.size !== 1) {
      throw new Error(
        `Seed aborted: subcollection "${product}" has more than one document ` +
          `(${subcolSnap.size}); expected exactly 1. Resolve it manually before seeding.`
      );
    }

    plan.push({
      ref: subcolSnap.docs[0].ref,
      data: { nombreCanonico: product, sinonimos, categoria },
    });
  }

  // ── Phase 2: one atomic batch, so a failure leaves Firestore untouched ──
  const batch = db.batch();

  for (const { ref, data } of plan) {
    batch.set(ref, data, { merge: true });
  }

  await batch.commit();

  return plan.length;
}

async function executeSeed() {
  // Lazy-load firebase-admin only when actually writing
  const admin = requireFromBackend("firebase-admin");

  if (!admin.apps.length) {
    // Same credential source as backend/src/lib/firestore.js — not ADC.
    admin.initializeApp({
      credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
    });
  }

  const entries = dryRun();
  const writeCount = await seedCatalog(admin.firestore(), entries);

  for (const { product, sinonimos, categoria } of entries) {
    console.log(`  ✅ ${product}: ${sinonimos.length} sinonimos, categoria=${categoria}`);
  }

  console.log(`\nDone. Wrote ${writeCount} product documents (merge).`);
  return writeCount;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════════════════════

const isDryRun = process.argv.includes("--dry-run");

if (require.main === module) {
  if (isDryRun) {
    const writes = dryRun();
    console.log("=== DRY RUN ===");
    console.log(`Would write ${writes.length} product documents:\n`);
    for (const w of writes) {
      console.log(
        `  ${w.product}: sinonimos=[${w.sinonimos.join(", ")}], categoria=${w.categoria}`
      );
    }

    const totalSynonyms = writes.reduce((s, w) => s + w.sinonimos.length, 0);
    console.log(`\nTotal synonyms: ${totalSynonyms}`);
    console.log(`Total categories: ${new Set(writes.map((w) => w.categoria).filter(Boolean)).size}`);
    console.log("\nNo Firestore writes made (--dry-run).");
  } else {
    executeSeed().catch((err) => {
      console.error("❌ Seed failed:", err.message || err);
      process.exit(1);
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS (for testing)
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  SNAPSHOT_SYNONYMS,
  SNAPSHOT_CATEGORIES,
  dryRun,
  seedCatalog,
};
