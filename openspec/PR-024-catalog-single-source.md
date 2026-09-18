# Firestore as Single Source of Truth for the Product Catalog (catalog-single-source)

## Description

The product catalog was defined in four places: Firestore as the canonical store, plus three hardcoded copies — `productosOriginales` and the `equivalencias` map in `backend/src/brain/inturis.js`, and `diccionarioCategorias` in `backend/src/utils/diccionario.js`. All four had to be kept in sync by hand, so any Firestore change silently broke order interpretation and the hardcoded copies masked two real bugs: `Ajo en polvo * 50` was missing from `diccionarioCategorias`, which caused every one of its sales to be dropped from the accounting totals in `buildOperacionesContables`, and the Fuse.js v7 fuzzy fallback in `interpretarPedido` was dead code because the index was built without `includeScore: true`. The word `un` was also not recognized as quantity 1.

This PR makes Firestore the single source of truth and derives every runtime catalog structure from it. A new `backend/src/catalog/loader.js` singleton reads all product documents via `getCatalogo()` in `backend/src/repositories/productos.repository.js` and builds the equivalencias map (from each product's `sinonimos`), the Fuse index (with `includeScore`), and the category map (from each product's `categoria`). `backend/src/index.js` initializes the loader at boot with fail-fast semantics, `interpretarPedido` becomes async and reads from the loader, and a new token-guarded `POST /api/admin/recargar-catalogo` endpoint refreshes the in-memory catalog at runtime. `scripts/seed-sinonimos.js` migrates the 53 hardcoded synonyms and the category assignments into Firestore idempotently, `backend/src/utils/diccionario.js` is deleted with zero remaining runtime references, and the unused `fuse` CLI dependency is removed.

This change was originally planned as four chained work-unit PRs (PR 1 Loader, PR 2 inturis + contabilidad + admin, PR 3 Tests, PR 4 Migration + Cleanup) targetting `develop`, and was consolidated by the maintainer into this single PR from `feat/backend-robustez` with an explicit size exception. The Changes Made section preserves the work-unit grouping so each planned PR's content is reviewable inside this one. Verification: 8/8 spec requirements compliant and the full suite green at 178/178 tests.

## Changes Made

### Work Unit A — Catalog loader (planned PR 1)

- `backend/src/catalog/loader.js` — new catalog loader singleton: `init()` reads the catalog from Firestore and builds the equivalencias map (from each product's `sinonimos`), the Fuse index (from `nombre` + `sinonimos`, `includeScore: true`, threshold 0.55), and the category map (from each product's `categoria`); `refresh()` rebuilds all structures and swaps them atomically; `getCatalog`, `getEquivalencias`, `getFuseIndex` and `getCategoria` expose the cache.
- `backend/src/repositories/productos.repository.js` — added `getCatalogo()`: bulk read of every product subcollection under `Productos/Productos_ID`, returning `{nombre, sinonimos, categoria}` per product.
- `backend/tests/unit/catalog/loader.test.ts` — new loader suite (12 tests) mocking `productos.repository` via `Module._cache`: 53 equivalencias built, category lookups, Fuse search with numeric `includeScore` scores, `refresh()` atomic swap and keep-previous-cache-on-failure, and fail-fast `process.exit(1)` on Firestore error.
- `backend/src/brain/inturis.js` — `numerosPalabras` now maps `un` to 1 alongside `uno`/`una`, so "un aji grande" resolves with quantity 1 (R-INTERPRETAR).

### Work Unit B — Async interpretation, contabilidad, admin refresh, boot (planned PR 2)

- `backend/src/brain/inturis.js` — removed `productosOriginales`, the hardcoded `equivalencias` map and the inline Fuse instance; `interpretarPedido` is now async and reads `catalogLoader.getEquivalencias()` / `catalogLoader.getFuseIndex()`; exact synonym match remains the primary path, Fuse search is the fallback accepting `score < 0.8`, and `sugerencias` come from Fuse results; `procesarMensajeTwilio` awaits the call.
- `backend/src/routes/ventas.js` — `POST /pedido-libre` now builds its `sugerencias` fallback from `catalogLoader.getCatalog()` product names instead of the flat `diccionarioCategorias` values (prerequisite for the `diccionario.js` deletion).
- `backend/src/repositories/contabilidad.repository.js` — removed the `diccionarioCategorias` import and the local `obtenerCategoria`; `buildOperacionesContables` now resolves categories via `catalogLoader.getCategoria`; the `obtenerCategoria` export is gone.
- `backend/src/services/contabilidad.service.js` — `obtenerCategoria` re-delegated to `catalogLoader.getCategoria`.
- `backend/src/routes/admin.js` — added the `requireAdminToken` middleware (Bearer `ADMIN_TOKEN`; fails closed with 401 when the env var is missing, the header is absent, or the token does not match) and `POST /recargar-catalogo`, which calls `catalogLoader.refresh()` and returns `{success: true, productos}`; a Firestore failure returns 500 and the previous cache stays active (R-RECARGA).
- `backend/src/index.js` — boot now awaits `catalogLoader.init()` before `app.listen`; if Firestore is unreachable the process exits with code 1 and a clear message, so the server never serves with an empty catalog.

### Work Unit C — Test consolidation (planned PR 3)

- `backend/tests/unit/brain/inturis.test.js` — new `interpretarPedido` suite (23 tests) against a mocked loader via `Module._cache` with the real `normalizarTexto`: exact matches, `un` mapping, numeric quantities, multi-item orders, Fuse fallback with score-derived confidence, typo-canonical `Canela molidad * 100`, the `de` → `*` business rule, and the `No identificado` contract.
- `backend/tests/unit/utils/obtenerCategoria.test.ts` — rewritten: category lookups flow through `contabilidad.service` with the loader mocked in `Module._cache`, covering all 12 category mappings (including the `Ajo_en_polvo` fix), unknown products, and edge cases.
- `backend/tests/unit/repositories/contabilidad.repository.test.ts` — `obtenerCategoria` direct tests removed; `catalogLoader.getCategoria` mocked for `buildOperacionesContables`.
- `backend/tests/unit/services/contabilidad.test.ts` — delegation assertion updated from the repository to `catalogLoader.getCategoria`.
- `backend/tests/integration/jobContable.test.ts` — catalog loader mocked in `Module._cache`; fixtures moved to canonical product names (e.g. `Clavo * 100`, `Miel * 100`) so category resolution exercises the loader path.

### Work Unit D — Migration and cleanup (planned PR 4)

- `scripts/seed-sinonimos.js` — new one-time migration script: writes `sinonimos` and `categoria` fields to all 24 product documents with merge writes (idempotent — safe to re-run), a `--dry-run` preview mode that performs no Firestore writes, and a snapshot of the 53 synonyms / 12 categories extracted from the old hardcoded structures (R-MIGRATION).
- `backend/tests/unit/scripts/seed-sinonimos.test.ts` — new snapshot tests: 53 synonyms across 24 products, 12 unique categories (11 original + `Ajo_en_polvo`), structural integrity between both maps, and `dryRun()` descriptors without touching Firestore.
- `backend/src/utils/diccionario.js` — deleted; zero runtime references remain (`diccionarioCategorias` / `utils/diccionario` are gone from `backend/src`).
- `backend/package.json` + `package-lock.json` — removed the unused `fuse` CLI dependency (`^0.12.1`); `fuse.js` (`^7.1.0`) remains in the frontend dependency tree and stays out of scope here (R-DEP).

## Impact

- Order interpretation and accounting categorization now read from one source: the catalog is loaded from Firestore at boot and swapped at runtime via `POST /api/admin/recargar-catalogo`, eliminating the manual sync between Firestore and the three hardcoded copies.
- Accounting bug fixed: `Ajo en polvo * 50` sales now resolve to the `Ajo_en_polvo` category and enter the totals (12 categories vs the 11 in the old `diccionarioCategorias`).
- The Fuse fuzzy fallback is active again: typo and close-match orders that previously fell through to `No identificado` now resolve with a score-derived `confianza`. Note that with threshold 0.55 the `score >= 0.8` reject branch is unreachable when results are non-empty; this is documented in the change record and causes no behavioral regression.
- `un` is now interpreted as quantity 1 in natural-language orders.
- Boot safety: the server exits with code 1 if Firestore is unavailable at startup instead of serving requests against an empty or stale catalog.
- Admin API operational requirement: `POST /api/admin/recargar-catalogo` fails closed — without `ADMIN_TOKEN` set, it returns 401; deployers must configure the env var (the maintainer authorized this strict behavior over the original soft-fail).
- External contract preserved: `GET /api/productos` keeps its exact response shape (no field additions, removals, or renames), verified by the existing test suite (R-CONTRATO-EXT).
- Backward compatibility: the Firestore changes are additive (`sinonimos`, `categoria` fields, merge writes), so a rollback only requires reverting this code — the old code ignores the extra fields.
- Caveat: until `scripts/seed-sinonimos.js` is run against Firestore, the equivalencias map is empty and fuzzy matching covers canonical product names only (documented decision in the change record).

## Notes

- How to verify: run `npm run test:run` from the repo root — 178/178 tests passing (19 files), exit 0; run `node scripts/seed-sinonimos.js --dry-run` — 24 products / 53 synonyms / 12 categories with no Firestore writes; exercise the refresh endpoint with `curl -X POST localhost:4000/api/admin/recargar-catalogo -H "Authorization: Bearer $ADMIN_TOKEN"` expecting `{"success":true,"productos":24}`.
- Deployment order: run `node scripts/seed-sinonimos.js` once against Firestore (dry-run first), set `ADMIN_TOKEN`, then deploy the backend. After any future catalog edit in Firestore, call the refresh endpoint to propagate without a restart.
- SDD artifacts for this change (proposal, spec, design, tasks, verify report) live under `openspec/changes/catalog-single-source/`; the verify report records 8/8 requirements and 16/16 scenarios compliant, with the single warning (admin token guard) resolved, and the full suite green at 178/178 before this PR was opened.