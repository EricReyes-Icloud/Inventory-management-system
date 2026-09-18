# Tasks: Catalog Single Source of Truth

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~950–1,150 (A ~300, B ~260, C ~320, D ~135) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Loader) → PR 2 (inturis+contabilidad+admin) → PR 3 (Tests) → PR 4 (Migration+Cleanup) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| A | loader + getCatalogo + un/includeScore fixes + loader tests | PR 1 | `npx vitest run tests/unit/catalog/loader.test.ts` | `node -e "const l=require('./src/catalog/loader');l.init().then(()=>console.log(l.getEquivalencias().size))"` → 53 | Revert A — loader unused by callers yet |
| B | inturis async + ventas sugerencias + contabilidad + admin route + boot | PR 2 | `npx vitest run tests/unit/services/contabilidad.test.ts tests/unit/repositories/contabilidad.repository.test.ts` | Boot `npm start` (fail-fast if Firestore down); `curl -X POST localhost:4000/api/admin/recargar-catalogo -H "Authorization: Bearer $ADMIN_TOKEN"` → `{success:true,productos:24}` | Revert B — restores hardcoded catalog |
| C | inturis suite ≥15 + category test updates + full suite | PR 3 | `npx vitest run tests/unit/brain/inturis.test.js && npm run test:run` | `node -e "const {interpretarPedido}=require('./src/brain/inturis');require('./src/catalog/loader').init().then(()=>interpretarPedido('un aji grande')).then(r=>console.log(JSON.stringify(r)))"` | Revert C — tests only |
| D | seed-sinonimos.js (snapshot pre-refactor) + delete diccionario.js + drop fuse CLI | PR 4 | `node scripts/seed-sinonimos.js --dry-run`; `grep -rn "diccionario" backend/src` → 0 | N/A — user runs real seed manually; dry-run is the harness | Revert D — Firestore fields additive |

## Phase 1: Loader + Interpretation Fixes (Unit A)

- [x] 1.1 Add `getCatalogo()` to `backend/src/repositories/productos.repository.js` — bulk read incl. `sinonimos` + `categoria` (R-SINONIMOS, R-CATEGORIA)
- [x] 1.2 Create `backend/src/catalog/loader.js` singleton: `init()` fail-fast, `getCatalog`, `getEquivalencias`, `getFuseIndex` (includeScore: true), `getCategoria`, `refresh()` atomic swap (catalog-loader cap, R-RECARGA)
- [x] 1.3 [TEST-FIRST] `backend/tests/unit/catalog/loader.test.ts` — mock `productos.repository` via `Module._cache` (pattern: `productos.repository.test.ts`); verify 53 equivalencias, 11 categories, refresh swap, fail-fast (R-SINONIMOS, R-RECARGA)
- [x] 1.4 `inturis.js` `numerosPalabras`: add `un: 1` (R-INTERPRETAR)

## Phase 2: Migration Script (Unit D — create before refactor)

- [x] 2.1 Create `scripts/seed-sinonimos.js` — idempotent merge writes, `--dry-run`; snapshot the 53 synonyms + 11 categories from current `inturis.js`/`diccionario.js` at authoring time; NOT executed during implementation (user runs against Firestore) (R-MIGRATION)

## Phase 3: inturis Async + Callers (Unit B)

- [x] 3.1 [TEST-FIRST] Create `backend/tests/unit/brain/inturis.test.js` ≥15 scenarios — exact, Fuse fallback, "un", multi-item, typo synonym, "No identificado"+sugerencias; mock loader singleton via `Module._cache`, real `normalizarTexto` (R-TESTS, R-INTERPRETAR)
- [x] 3.2 `inturis.js` — delete `productosOriginales`/`equivalencias`/Fuse init (L31–177); import loader; `interpretarPedido` async; search with `includeScore: true`, accept match when `score < 0.8` (design + current code; spec R-INTERPRETAR wording inverted — resolve at verify) (interpretarPedido cap)
- [x] 3.3 `routes/ventas.js` L50 — replace `diccionarioCategorias` fallback sugerencias with loader catalog names (prereq for diccionario deletion) (R-CONTRATO-EXT)

## Phase 4: Contabilidad + Admin + Boot (Unit B)

- [x] 4.1 `repositories/contabilidad.repository.js` — remove `obtenerCategoria` + `diccionario` import; use `loader.getCategoria` at L223; update exports (R-CATEGORIA)
- [x] 4.2 `services/contabilidad.service.js` L90 — re-delegate `obtenerCategoria` to `loader.getCategoria`; update `contabilidad.test.ts` mock/export assertions (R-CATEGORIA)
- [x] 4.3 `routes/admin.js` — add `POST /recargar-catalogo` guarded by `ADMIN_TOKEN` env (Bearer; missing/incorrect → 401); `refresh()` → 200 `{success,productos}` / 500 keeps previous cache (R-RECARGA)
- [x] 4.4 `index.js` — `await catalogLoader.init()` before `app.listen`; clear fail-fast message (catalog-loader boot scenario)

## Phase 5: Test Consolidation (Unit C)

- [x] 5.1 Update `tests/unit/utils/obtenerCategoria.test.ts` + repo/service category tests to `loader.getCategoria` expectations (R-TESTS)
- [x] 5.2 Full suite `npm run test:run` — zero failures; spot-check `GET /api/productos` shape unchanged (R-CONTRATO-EXT, R-TESTS)

## Phase 6: Cleanup (Unit D)

- [x] 6.1 Delete `backend/src/utils/diccionario.js`; grep for `diccionarioCategorias`/`utils/diccionario` → zero refs (R-MIGRATION)
- [x] 6.2 `backend/package.json` — remove `"fuse": "^0.12.1"`; `npm install` clean (R-DEP)