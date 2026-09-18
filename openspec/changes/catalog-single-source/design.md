# Design: Catalog Single Source of Truth

## Technical Approach

Firestore becomes the single source of truth. A `catalog-loader` singleton boots before `app.listen`, reads 24 product subcollections, and derives three runtime structures: equivalencias map (from `sinonimos[]`), Fuse index (from `{nombre, sinonimos[]}`), and category map (from `categoria`). Fixes two co-located interpretation bugs (dead Fuse branch, missing "un") alongside the catalog consolidation.

## Architecture Decisions

| Decision | Option A | Option B | Tradeoff | Decision |
|----------|----------|----------|----------|----------|
| Loader injection | Import singleton | Pass as parameter | A: simpler, testable via module mock. B: explicit but heavy signatures. | **A** — follows `firestore.js` singleton pattern. |
| `interpretarPedido` sig | Async (Promise) | Sync with lazy init | Both callers already async (L45 `ventas.js`, L249 `inturis.js`). | **Async** — no breaking change. |
| Boot error policy | Fail-fast (exit 1) | Snapshot fallback | Fail-fast: simple, ops can restart. Snapshot: stale risk. | **Fail-fast** — explicit proposal decision. |
| Category lookup | `loader.getCategoria()` | Keep `obtenerCategoria` + inject | Only used at `contabilidad.repository.js` L223. | **Direct map** — cleaner, fewer indirections. |
| Admin auth | Skip (matches `admin.js`) | **ADMIN_TOKEN middleware** | Backend antibalas: cheap guard against exposed refresh endpoint. | **ADMIN_TOKEN** — user decision 2026-09-11. |

## Data Flow

```
BOOT:  index.js ──▶ catalogLoader.init()
                      ├─ getProductos()              // 24 Firestore reads
                      ├─ buildEquivalencias(productos) // sinonimos → map
                      ├─ buildFuseIndex(productos)     // includeScore: true
                      └─ buildCategoriaMap(productos)  // categoria → map
                   app.listen() ◀── catalog ready

REQUEST:  ventas.js ──▶ interpretarPedido(mensaje)
                          ├─ equivalencias[normalized] (exact) ──▶ hit? return
                          └─ fuse.search(normalized, includeScore) ──▶ score < 0.8? return
                                                                        else: "No identificado"

ACCOUNTING:  contabilidad.repository.js ──▶ loader.getCategoria(nombre) → string | null

REFRESH:  POST /api/admin/recargar-catalogo ──▶ catalogLoader.refresh() → rebuild + swap atomically
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/catalog/loader.js` | **Create** | Singleton: `init()`, `getCatalog()`, `getEquivalencias()`, `getFuseIndex()`, `getCategoria()`, `refresh()`. |
| `backend/src/brain/inturis.js` | Modify | Remove `productosOriginales`, `equivalencias`, Fuse init (L31-177). Import loader. Make `interpretarPedido` async. Add `"un"` to `numerosPalabras`. |
| `backend/src/utils/diccionario.js` | **Delete** | Category data moves to Firestore `categoria` field. |
| `backend/src/index.js` | Modify | `await catalogLoader.init()` before `app.listen`. |
| `backend/src/routes/admin.js` | Modify | Add `POST /recargar-catalogo` calling `catalogLoader.refresh()`. Guarded by `ADMIN_TOKEN` env var middleware (missing/incorrect token → 401). |
| `backend/src/repositories/contabilidad.repository.js` | Modify | Replace `obtenerCategoria` import with `loader.getCategoria`. Remove `diccionarioCategorias`. |
| `backend/tests/unit/brain/inturis.test.js` | **Create** | ≥15 scenarios: exact, fuzzy, "un", "de", multi-item, suggestions, typo. |
| `backend/package.json` | Modify | Remove `"fuse": "^0.12.1"` from dependencies. |
| `scripts/seed-sinonimos.js` | **Create** | Idempotent migration: reads the current hardcoded map from `inturis.js`/`diccionario.js`, writes `sinonimos[]` + `categoria` to each product doc. Supports `--dry-run`. |

## Interfaces / Contracts

```js
// catalog/loader.js — Public API
module.exports = {
  async init(),               // Fail-fast on Firestore error
  getCatalog(),               // Map<nombre, product>
  getEquivalencias(),         // Map<normalizedKey, canonicalName>
  getFuseIndex(),             // Fuse instance (includeScore: true)
  getCategoria(nombre),       // string | null — replaces obtenerCategoria
  async refresh(),            // Rebuild + atomic swap. Returns { productos: N }
};

// interpretarPedido — new signature
async function interpretarPedido(pedido) → Array<{producto, cantidad, confianza, sugerencias}>

// POST /api/admin/recargar-catalogo
// Header: Authorization: Bearer <ADMIN_TOKEN> (env var; missing/incorrect → 401)
// 200: { success: true, productos: 24 }
// 500: { success: false, error: "..." }  (previous cache stays active)
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit — loader | `buildEquivalencias`, `buildFuseIndex`, `buildCategoriaMap` | Mock `getAllProductos` via `Module._cache`. Verify 53 equivalencias, 11 categories. |
| Unit — interpretarPedido | 15+ scenarios | Mock `catalogLoader` singleton. Real `normalizarTexto`. |
| Integration — boot | `init()` with mocked Firestore | Verify all maps built; fail-fast on error. |
| Integration — refresh | `refresh()` swaps cache | Init → modify mock → refresh → verify new data. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The admin endpoint calls `catalogLoader.refresh()` which reads Firestore only.

## Migration / Rollout

1. Run `scripts/seed-sinonimos.js` to add `sinonimos[]` + `categoria` fields to all 24 product docs. Safe — old code ignores unknown fields.
2. Deploy code: new boot with `catalogLoader.init()` before `app.listen`.
3. Verify: `GET /api/productos` returns identical shape. All tests pass.
4. Cleanup: delete `diccionario.js`, remove `fuse` CLI dep.

Rollback: revert code commit. Firestore data is additive — old code ignores unknown fields.

## Open Questions

Resolved: admin auth — guard `POST /recargar-catalogo` with `ADMIN_TOKEN` env var middleware (401 on missing/incorrect). Seed data — read from current `inturis.js`/`diccionario.js`, no hardcoded duplication.
