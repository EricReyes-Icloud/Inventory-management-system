# PR #2 — Unit tests for `buildOperacionesContables` and `limpiarCategoria`

## Dependency chain

```
feature/testing-automatico (tracker) ← PR #1 ← 📍 PR #2
```

## What

Add 9 unit tests completing the `contabilidad.repository.js` test suite: 6 tests for `buildOperacionesContables` (batch construction logic) and 3 tests for `limpiarCategoria` (category cleanup). This PR extends the infrastructure and 7 tests from PR #1 into a full 16-test suite at `backend/tests/unit/repositories/contabilidad.repository.test.ts`.

**This PR covers lines 196–390 of the test file.**

## Changes

| File | Action | Lines |
|------|--------|-------|
| `backend/tests/unit/repositories/contabilidad.repository.test.ts` | Extend | 196–390 |

## What's included

### Phase 3 — `buildOperacionesContables` tests (tasks 3.1–3.6, 6 tests)

Batch construction logic using real `obtenerCategoria` and mocked `FieldValue` + `obtenerMesAnio`:

| # | Test | Input | Expected |
|---|------|-------|----------|
| 3.1 | Throws on empty or non-array items | `[]` or `"string"` | `Error("Items inválidos para contabilidad")` |
| 3.2 | Throws on invalid/undefined/null fechaPedido | `"not-a-date"`, `undefined`, `null` | `Error("fechaPedido inválida")` |
| 3.3 | Builds all 20 ops for 3 categorized items | 3 items with real SKU names | 20 ops: 2 main + 6 per item |
| 3.4 | Uses `FieldValue.increment` with correct values | `subtotal: 1500, cantidad: 5` | 6 ops with `{ __increment: 1500 }` or `{ __increment: 5 }` |
| 3.5 | Skips items without a matching category | 1 valid + 1 unknown item | 8 ops only (no error) |
| 3.6 | Includes `serverTimestamp` on main document ops | Valid items | `result[0].data.actualizadoEn === { __serverTimestamp: true }` |

### Phase 5 — `limpiarCategoria` tests (tasks 5.1–5.3, 3 tests)

Category cleanup via subcollection reads and atomic batch writes:

| # | Test | Setup | Assertions |
|---|------|-------|------------|
| 5.1 | `limpiarCategoriaTotal` deletes SKUs and resets total | 2 SKU documents in subcollection | `batch.delete` × 2, `batch.set` with `{ total: 0 }`, `batch.commit` |
| 5.2 | `limpiarCategoriaTotal` handles empty category | 0 SKU documents | `batch.delete` not called, `batch.set` × 1, `batch.commit` |
| 5.3 | `limpiarCategoriaCartones` deletes SKUs and resets total | 2 SKU documents in subcollection | Same as 5.1 but `Cartones_vendidos` path |

## Out of scope

- Infrastructure (mocks, helpers, `beforeEach`) — established in PR #1
- `obtenerCategoria` pure logic tests — established in PR #1
- `executeBatch` / `executeBatchWithUpdates` — established in PR #1

## How to review

1. Start with `buildOperacionesContables` (lines 200–321): each test validates a different validation or construction concern. Pay attention to test 3.3 (20 ops) and 3.4 (FieldValue.increment mapping) — these cover the most logic.
2. Review `limpiarCategoria` tests (lines 327–389): note the subcollection mock pattern via `mockDocRef.collection()`. The `forEach` on `mockQuerySnap` is exercised by the implementation.

## Verification

```bash
npx vitest run tests/unit/repositories/contabilidad.repository.test.ts --reporter verbose
```

Expected: 16/16 passing (requires PR #1 base).

## Notes

- All tests reuse the `Module._cache` infrastructure from PR #1
- `buildOperacionesContables` tests use real `obtenerCategoria` — the categorization path is tested end-to-end
- `limpiarCategoriaTotal` and `limpiarCategoriaCartones` share the same cleanup logic with different Firestore paths
- No production code modified
