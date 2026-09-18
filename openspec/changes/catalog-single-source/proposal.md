# Proposal: Catalog Single Source of Truth

## Intent

The product catalog currently lives in 4 places: Firestore (canonical), `productosOriginales` array, `equivalencias` map, and `diccionarioCategorias`. All are manually kept in sync — today they happen to match, but any Firestore change silently breaks interpretation. Worse, `Ajo en polvo * 50` is missing from categories, silently dropping every sale from accounting totals. Fuse.js v7's fuzzy fallback is dead (`includeScore: true` missing). This change makes Firestore the single source of truth and derives all runtime structures from it.

## Scope

### In Scope
- Load catalog from Firestore at boot (fail-fast if unavailable)
- Derive Fuse index + equivalencias from Firestore product data
- Add `sinonimos: string[]` field to each product document (migrate 53 hardcoded mappings)
- Add `categoria: string` field to each product document (eliminates `diccionarioCategorias`)
- Add `POST /api/admin/recargar-catalogo` endpoint for runtime refresh
- Fix Fuse v7 `includeScore: true` (reactivate fuzzy branch)
- Add `"un"` to `numerosPalabras`
- Add unit test suite for `interpretarPedido` (currently zero direct tests)
- Remove unused `fuse` CLI dependency (v0.12.1)

### Out of Scope
- Renaming `Canela molidad * 100` (typo stays canonical; correct forms added as sinonimos)
- CRUD admin UI for products/sinonimos (writes stay in Firestore console)
- Frontend changes
- Snapshot-based boot fallback (fail-fast only; fallback is future work)

## Capabilities

### New Capabilities
- `catalog-loader`: async load from Firestore at boot, fail-fast, admin refresh endpoint, derives Fuse index + equivalencias map + category lookup from product documents.

### Modified Capabilities
- `interpretarPedido`: becomes async (reads from loaded catalog cache); equivalencias lookup preserved as primary path, Fuse as fallback with working `includeScore`.

## Approach

### Boot Sequence

```
index.js
  └─▶ catalogLoader.init()              // NEW — must complete BEFORE app.listen
        ├─ getProductos()                // 24 reads (trivial)
        ├─ buildEquivalencias(productos) // from sinonimos field
        ├─ buildFuseIndex(productos)     // from nombre + sinonimos
        ├─ buildCategoriaMap(productos)  // from categoria field
        └─ FAIL FAST on error (process.exit(1) with clear message)
```

### Data Model Change (per product document)

```js
// BEFORE (current — 4 fields only)
{ "Precio carton", "Precio unidad", "Peso unidad", "Precio a dar tienda" }

// AFTER (additive — sinonimos + categoria)
{ "Precio carton", "Precio unidad", "Peso unidad", "Precio a dar tienda",
  sinonimos: ["canela molida 100", "canela molida grande"],  // NEW
  categoria: "Canela_molida"                                   // NEW
}
```

### Migration: 53 Synonyms → Firestore

One-time seed script (`scripts/seed-sinonimos.js`):
- Reads current hardcoded `equivalencias` map from `inturis.js`
- For each canonical product, writes `sinonimos` and `categoria` fields
- Idempotent: can re-run safely (merge writes)
- Deletes `diccionarioCategorias` entirely after migration

### File Changes

| File | Impact | Description |
|------|--------|-------------|
| `backend/src/catalog/loader.js` | **New** | Boot loader, cache, refresh |
| `backend/src/brain/inturis.js` | Modified | Remove `productosOriginales`, `equivalencias`, Fuse init; accept catalog from loader |
| `backend/src/utils/diccionario.js` | **Removed** | Category lookup moves to catalog loader |
| `backend/src/index.js` | Modified | Call `catalogLoader.init()` before `app.listen` |
| `backend/src/routes/admin.routes.js` | Modified | Add `POST /recargar-catalogo` |
| `backend/src/repositories/productos.repository.js` | Modified | Add `getCatalogo()` (bulk read + sinonimos/categoria) |
| `backend/tests/unit/brain/inturis.test.js` | **New** | Unit tests for `interpretarPedido` |
| `backend/package.json` | Modified | Remove `fuse` CLI dep |
| `scripts/seed-sinonimos.js` | **New** | One-time migration script |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/index.js` | Modified | Async boot sequence |
| `backend/src/brain/inturis.js` | Modified | Catalog comes from loader, not hardcoded |
| `backend/src/utils/diccionario.js` | Removed | Category as data, not hardcoded map |
| `backend/src/repositories/productos.repository.js` | Modified | Bulk catalog read |
| `backend/src/routes/admin.routes.js` | Modified | New refresh endpoint |
| `backend/tests/` | Modified | New + updated tests |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Firestore unavailable at boot crashes server | Medium | Fail-fast is intentional; clear error message; ops can retry |
| Migration script missed products | Low | Idempotent; reads canonical names from current `productosOriginales` |
| `interpretarPedido` sync→async breaks callers | Medium | Only 2 callers: `procesarMensajeTwilio` (already async) and `POST /pedido-libre` (also async); sync wrapper available if needed |
| Historical orders reference old category structure | Low | Category is additive metadata; old orders unaffected |

## Rollback Plan

1. Revert commit — restores all hardcoded catalogs
2. Firestore data (sinonimos, categoria fields) is additive — old code ignores unknown fields
3. If migration script partially ran, re-run is idempotent (merge writes)

## Dependencies

- Firestore connection (already configured)
- No new external dependencies

## Success Criteria

- [ ] Server fails fast with clear message if Firestore is unreachable at boot
- [ ] `GET /api/productos` returns identical shape to today
- [ ] `interpretarPedido("un aji grande")` resolves correctly
- [ ] `interpretarPedido("media botella miel")` resolves correctly (Fuse v7 fix)
- [ ] All 24 products load with sinonimos and categoria from Firestore
- [ ] `POST /api/admin/recargar-catalogo` refreshes catalog without restart
- [ ] Unit test suite for `interpretarPedido` covers ≥15 scenarios
- [ ] `fuse` CLI dependency removed from package.json
- [ ] `diccionarioCategorias` deleted; no references remain
- [ ] All existing tests pass
