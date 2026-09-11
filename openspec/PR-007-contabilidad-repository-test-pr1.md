# PR #1 — Unit tests for `obtenerCategoria`, `executeBatch`, `executeBatchWithUpdates`

## Dependency chain

```
feature/testing-automatico (tracker) ← 📍 PR #1 ← PR #2
```

## What

Add 7 unit tests for the `contabilidad.repository.js` module across 3 requirement groups: `obtenerCategoria` (4 tests — pure logic), `executeBatch` (2 tests), and `executeBatchWithUpdates` (1 test). Together with PR #2 (9 tests for `buildOperacionesContables` + `limpiarCategoria`), this completes the 16-test suite in `backend/tests/unit/repositories/contabilidad.repository.test.ts`.

**This PR covers lines 1–195 of the test file.**

## Changes

| File | Action | Lines |
|------|--------|-------|
| `backend/tests/unit/repositories/contabilidad.repository.test.ts` | Create | 1–195 |

## What's included

### Phase 1 — Test infrastructure (tasks 1.1–1.4)

Shared Firestore test doubles, `Module._cache` pre-seeding in `beforeEach`, and cleanup in `afterEach`:

- `buildMockDocRef` / `buildMockDocSnap` / `buildMockQuerySnap` / `buildMockBatch` — factory functions for Firestore document and batch doubles
- `mockFieldValue` — `increment` returns `{ __increment: n }`, `serverTimestamp` returns `{ __serverTimestamp: true }`
- `beforeEach`: seeds `Module._cache` with mocked `firestore.js`, `firebase-admin/firestore`, and `fechas.js`; real `diccionarioCategorias` and `normalizarTexto` remain unmocked
- `afterEach`: cleans all cache entries and calls `vi.restoreAllMocks()`

### Phase 2 — `obtenerCategoria` tests (tasks 2.1–2.4, 4 tests)

Pure logic with real dictionary and normalization:

| Test | Input | Expected |
|------|-------|----------|
| Returns category for matching SKU | `"Miel * 100"` | `"Miel"` |
| Returns most specific (longest) match | `"Canela molida"` | `"Canela_molida"` |
| Returns null when no match | `"Producto Sin Categoria"` | `null` + `console.warn` |
| Handles accented and uppercased names | `"MIEL 100gr con acentos"` | `"Miel"` |

### Phase 4 — `executeBatch` tests (tasks 4.1–4.2, 2 tests)

| Test | Scenario |
|------|----------|
| Writes all operations and commits | 2 ops → `batch.set` × 2 + `batch.commit` × 1 |
| Propagates commit errors | `batch.commit` rejects → error re-thrown |

### Phase 4 — `executeBatchWithUpdates` test (task 4.3, 1 test)

| Test | Scenario |
|------|----------|
| Applies sets and updates then commits | Sets array → `batch.set`, updates array → `batch.update`, then `batch.commit` |

## Out of scope for this PR

- `buildOperacionesContables` tests (6 tests) — PR #2, Phase 3
- `limpiarCategoria` tests (3 tests) — PR #2, Phase 5

These will be added in PR #2 targeting this branch.

## How to review

1. Start with the infrastructure (lines 1–99): imports, mock builders, `beforeEach`, `afterEach`. This is the foundation.
2. Review `obtenerCategoria` tests (lines 106–139): note that `normalizarTexto` and `diccionarioCategorias` are loaded real — these tests verify the actual matching algorithm, not mocked behavior.
3. Review `executeBatch` tests (lines 145–174): verify the batch commit chain is exercised.
4. Review `executeBatchWithUpdates` test (lines 181–194): verify both `set` and `update` paths.

## Verification

```bash
npx vitest run tests/unit/repositories/contabilidad.repository.test.ts --reporter verbose
```

Expected: 7/7 passing (the 9 tests from PR #2 will fail until merged).

## Notes

- Strict TDD: tests written before implementation, though the implementation existed from the original `contabilidad.repository.js` codebase
- `Module._cache` mocking follows the established pattern from `contable.repository.test.ts`
- No production code modified
