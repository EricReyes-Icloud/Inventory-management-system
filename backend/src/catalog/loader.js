/**
 * Catalog Loader — single source of truth for the product catalog.
 *
 * Reads products from Firestore via productos.repository, then derives:
 * - equivalencias map (normalized sinonimo → canonical product name)
 * - Fuse index (fuzzy search with includeScore: true)
 * - category map (product name → category string)
 *
 * Singleton pattern: import and call init() before app.listen().
 */

const Fuse = require("fuse.js");
const { normalizarTexto } = require("../utils/normalizarTexto");
const productosRepo = require("../repositories/productos.repository");

// ── Internal state (swapped atomically on refresh) ────────────────
let catalog = new Map();       // nombre → { nombre, sinonimos, categoria }
let equivalencias = new Map(); // normalized key → canonical name
let fuseIndex = null;          // Fuse instance with includeScore: true
let categoriaMap = new Map();  // nombre → categoria string

// ═══════════════════════════════════════════
// BUILDERS (pure, testable)
// ═══════════════════════════════════════════

function buildEquivalencias(productos) {
  const eq = new Map();
  for (const p of productos) {
    for (const sinonimo of p.sinonimos) {
      const key = normalizarTexto(sinonimo);
      eq.set(key, p.nombre);
    }
  }
  return eq;
}

function buildFuseIndex(productos) {
  const items = productos.map((p) => ({
    nombre: p.nombre,
    // Build a searchable string from nombre + all sinonimos
    searchText: [p.nombre, ...p.sinonimos].map(normalizarTexto).join(" "),
  }));

  return new Fuse(items, {
    keys: ["searchText"],
    includeScore: true,
    threshold: 0.55,
  });
}

function buildCategoriaMap(productos) {
  const map = new Map();
  for (const p of productos) {
    if (p.categoria) {
      map.set(p.nombre, p.categoria);
    }
  }
  return map;
}

// ═══════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════

async function init() {
  try {
    const productos = await productosRepo.getCatalogo();

    if (!Array.isArray(productos) || productos.length === 0) {
      console.error("[catalog-loader] No products returned from Firestore. Failing fast.");
      process.exit(1);
    }

    catalog = new Map(productos.map((p) => [p.nombre, p]));
    equivalencias = buildEquivalencias(productos);
    fuseIndex = buildFuseIndex(productos);
    categoriaMap = buildCategoriaMap(productos);

    console.log(`[catalog-loader] Loaded ${productos.length} products, ${equivalencias.size} equivalencias, ${categoriaMap.size} categories`);
  } catch (err) {
    console.error("[catalog-loader] Failed to load catalog from Firestore:", err.message || err);
    process.exit(1);
  }
}

function getCatalog() {
  return catalog;
}

function getEquivalencias() {
  return equivalencias;
}

function getFuseIndex() {
  return fuseIndex;
}

function getCategoria(nombre) {
  return categoriaMap.get(nombre) || null;
}

async function refresh() {
  const productos = await productosRepo.getCatalogo();

  const newCatalog = new Map(productos.map((p) => [p.nombre, p]));
  const newEquivalencias = buildEquivalencias(productos);
  const newFuseIndex = buildFuseIndex(productos);
  const newCategoriaMap = buildCategoriaMap(productos);

  // Atomic swap
  catalog = newCatalog;
  equivalencias = newEquivalencias;
  fuseIndex = newFuseIndex;
  categoriaMap = newCategoriaMap;

  console.log(`[catalog-loader] Refreshed: ${productos.length} products, ${equivalencias.size} equivalencias`);
  return { productos: productos.length };
}

module.exports = {
  init,
  getCatalog,
  getEquivalencias,
  getFuseIndex,
  getCategoria,
  refresh,
};
