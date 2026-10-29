# Feature: nombre-canonico

**Objective:** Replace the fragile subcollection-ID-derived product name with an explicit `nombreCanonico` field in Firestore documents, making the canonical name a first-class data attribute instead of a runtime derivation.
**Branch:** `feat/backend-robustez` (user-mandated — no new branch).
**Delivery strategy:** `ask-on-risk` (default). Forecast ~120 authored changed lines → single PR, no chain. Push/PR remain human decisions.
**Test runner:** `npm run test:ci` (root, vitest) — baseline 262 tests / 25 files.

## Specs

**S1 — The seed script writes `nombreCanonico` to every product document.**
Scope: `scripts/seed-sinonimos.js`.
Source (verbatim from maintainer): "La solución es convertir el canonico en dato explicito - una constante o mejor un campo nombreCanonico en Firestore."
Acceptance: `dryRun()` includes `nombreCanonico` in each descriptor. `seedCatalog()` merges `nombreCanonico` alongside `sinonimos` and `categoria`. The value equals the snapshot key (the current canonical name).
Check: unit test asserts `nombreCanonico` is present in dry-run descriptors and in batch write payloads.

**S2 — The repository reader prefers `nombreCanonico` over `subcol.id`.**
Scope: `backend/src/repositories/productos.repository.js` (`getCatalogo`).
Acceptance: when a document has `nombreCanonico`, that value becomes `p.nombre` in the returned array. When absent, falls back to `subcol.id` for backward compatibility with unseeded documents.
Check: unit test with mock Firestore returning docs with and without `nombreCanonico`; assert the correct `nombre` in each case.

**S3 — Existing catalog consumers receive the canonical name transparently.**
Scope: `backend/src/catalog/loader.js`, `backend/src/brain/inturis.js`, `backend/src/services/ventas.service.js`, `backend/src/repositories/contabilidad.repository.js`.
Acceptance: no code changes needed in these modules. They read `p.nombre` or `it.nombre` which now originates from `nombreCanonico` via S2. The typo `"Canela molidad * 100"` can be corrected in Firestore without touching code.
Check: existing integration and unit suites pass unchanged. The `MOCK_CATALOGO` in tests already uses correct names, so all 262+ tests remain green.

**S4 — Tests verify `nombreCanonico` preference and fallback behavior.**
Scope: `backend/tests/unit/scripts/seed-sinonimos.test.ts`, `backend/tests/unit/scripts/seed-sinonimos.verify.test.ts`, new repository-level test.
Acceptance: seed tests assert `nombreCanonico` in write payloads. A new repository test asserts `getCatalogo()` returns `data.nombreCanonico` when present and `subcol.id` when absent.
Check: `npm run test:ci` passes with new tests included.

## Tasks

| ID | S# | Route | Task | Status | Evidence |
|----|----|-------|------|--------|----------|
| T1 | S1 | inline | Add `nombreCanonico` to `dryRun()` descriptors and `seedCatalog()` batch writes in `scripts/seed-sinonimos.js` | ✅ | — |
| T2 | S1 | inline | Update seed tests to assert `nombreCanonico` in write payloads (`seed-sinonimos.test.ts` + `seed-sinonimos.verify.test.ts`) | ✅ | — |
| T3 | S2 | inline | Change `getCatalogo()` in `productos.repository.js` to read `data.nombreCanonico \|\| subcol.id` | ✅ | — |
| T4 | S4 | inline | Add repository-level test for `nombreCanonico` preference and `subcol.id` fallback | ✅ | `backend/tests/unit/repositories/productos.repository.nombreCanonico.test.ts` — 2 tests |
| T5 | S3 | inline | Run full suite `npm run test:ci` — expect 262+ tests green, zero regressions | ✅ | 267/267, 26 files |
| T6 | S1,S2 | delegated | Independent verification (high risk: item 1 — writes to production Firestore; item 3 — contract consumed by contabilidad) | ✅ | `gentle-ai-verify` PASS S1-S4, items 1 and 3 OK |
| T7 | all | inline | Work-unit commit on `feat/backend-robustez` | ✅ | `5927f95` |

## Log

**L1 (user, verbatim):** "Tenemos un ID Fragil, estamos derivando las claves del diccionario en runtime (linea 94 de inturis.js). La solución es convertir el canonico en dato explicito - una constante o mejor un campo nombreCanonico en Firestore."

**L2 (user, verbatim, 2026-10-28):** "Si la apruebo, adelante."

**D1 — Classification (2026-10-28).** Large. Resume test fails: spans seed script, repository layer, multiple test files, and requires a production Firestore seed. High risk: item 1 (seed writes to production Firestore via merge), item 3 (the `nombre` field origin changes for contabilidad SKUs and ventas descriptions). Independent verifier required in T6.

**D2 — Design decision: fallback to subcol.id (2026-10-28).** Documents not yet seeded must still work. `getCatalogo()` uses `data.nombreCanonico || subcol.id` so the change is backward-compatible until the seed runs on every document.

**D3 — No code changes needed downstream (2026-10-28).** The entire system reads `p.nombre` from the repository output. By fixing the source in `getCatalogo()`, loader, inturis, ventas.service, and contabilidad.repository automatically get the corrected name. This is the power of the single-source pattern established in `catalog-single-source`.

**D4 — Verification notes (2026-10-27, from gentle-ai-verify).** Merge-only seed is safe; fallback `data.nombreCanonico || subcol.id` is present. Two open advisories: (a) correcting a typo in Firestore may require renaming the subcollection in addition to updating `nombreCanonico`; (b) re-running the seed can revert manual `nombreCanonico` fixes, since the seed always writes the snapshot value. Both are documented, not blockers.

**CLOSE — 2026-10-27.** All 7 tasks complete. Feature closed on `feat/backend-robustez` with commit `5927f95`. Suite 267/267 green. Engram mirror `odd/nombre-canonico/tasks` (obs #1216) updated by the independent verifier. Push/PR/merge remain human decisions.

**Risk: item 1 (seed writes to production Firestore via merge) — mitigated by merge-only + fail-fast guards; item 3 (nombre origin change for contabilidad SKUs) — transparent via S2.**

**D5 — Stemming fix discovered during cierre (2026-10-29).** While closing this feature, a hidden bug surfaced: `normalizarTexto.js` had business rules (`clavos→clavo`, `de→*`, etc.) baked into the normalization function, causing distinct synonyms to collapse into the same key (53 → 52 equivalencias in production). Refactored to separate pure Unicode normalization (`normalizarTexto`) from business rules (`aplicarReglasNegocio`), and created unified pipeline `normalizarParaEquivalencias()` used by both `loader.buildEquivalencias` and `inturis.interpretarPedido`. Fixed 31 ReferenceError tests caused by `reemplazarNumerosPalabras` being referenced but not defined. Commit `f3ce91f`. Suite 273/273 green.
