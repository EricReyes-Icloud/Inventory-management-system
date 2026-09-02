# PR #20 — Integration tests for the monthly closing flow (`cerrarMes`) and `processPendingOrders`

## Dependency chain

```
feature/testing-automatico (tracker) ← PR #19 ← 📍 PR #20
```

## What

Add 16 integration tests covering the full monthly closing pipeline (`cerrarMes` in `monthlyClosing.orchestrator.js`) and the standalone pending-order processor (`processPendingOrders` in `jobContableMensual.js`). These tests exercise real production code — orchestrator, repositories, services — against a comprehensive Firestore mock, validating the 4-stage pipeline end-to-end without hitting a live database.

The mock infrastructure (`firestoreMock.ts`, 509 lines) supports the full Firestore document hierarchy: Ventas -> Pedidos -> pedidos, Total Productos, Cartones_vendidos, Historico_Mensual, Invertir, Ganancias, Cierres_contables, AdminActions. It reads and writes through the same `mockDb.doc()` and `mockDb.collection()` paths the production repos use, so tests verify real traversal logic rather than mocked shortcuts.

**This PR adds 1,353 lines across 4 files (2 test files + 2 helper files).**

## Changes Made

### New test files

| File | Lines | Tests |
|------|-------|-------|
| `backend/tests/flow/flujoCompleto.test.ts` | 473 | 9 tests for `cerrarMes()` |
| `backend/tests/integration/jobContable.test.ts` | 425 | 7 tests for `processPendingOrders()` |

### New test infrastructure

| File | Lines | Purpose |
|------|-------|---------|
| `backend/tests/helpers/firestoreMock.ts` | 509 | Firestore mock: doc/collection ref builders, snapshot factories, store populators, scenario builders |
| `backend/tests/helpers/firestoreMockTypes.ts` | 46 | TypeScript types: `Scenario`, `MockRefs`, `PedidoInput`, `ClienteInput`, `CostosInput` |

### `flujoCompleto.test.ts` — 9 tests

**Happy path (2 tests):**

| # | Test ID | What it covers |
|---|---------|----------------|
| 1 | FLOW-001 | Multi-category (Clavo + Miel): all 4 stages execute, `ganancias.length === 2`, result has correct shape |
| 2 | FLOW-002 | Single category (Clavo): `ganancias[0].categoria === "Clavo"`, `gananciaNeta` is number, all stages verified |

**Edge cases (3 tests):**

| # | Test ID | What it covers |
|---|---------|----------------|
| 3 | EDGE-001 | No pending orders: `processPendingOrders` returns 0/0, stages 2-4 execute from pre-populated data |
| 4 | EDGE-002 | Already-closed month: Stage 2 throws `"El histórico para Enero 2026 ya fue generado"`, stages 3-4 skip |
| 5 | EDGE-003 | Empty Productos/Cartones subcollections: stage 2 produces empty snapshot, stage 3 iterates zero categories, stage 4 writes audit with `totalCategorias: 0` |

**Error cases (4 tests):**

| # | Test ID | What it covers |
|---|---------|----------------|
| 6 | ERR-001 | Empty `mesAnio`: throws immediately, no stages execute |
| 7 | ERR-002 | Admin without `uid`: Stage 1 executes, Stage 2 throws, stages 3-4 skip |
| 8 | ERR-003 | Missing `Invertir/{categoria}` fixed costs: stages 1-2 complete, Stage 3 throws, Stage 4 skips |
| 9 | ERR-004 | Missing `costos_variables` for non-Miel category: stages 1-2 complete, Stage 3 throws, Stage 4 skips |

### `jobContable.test.ts` — 7 tests

**Happy path (3 tests):**

| # | Test ID | What it covers |
|---|---------|----------------|
| 1 | INT-FLOW-001 | Single client, single month, single pending paid order: `batch.set` with FieldValue sentinels, `batch.update` marks order processed, single `batch.commit` |
| 2 | INT-FLOW-002 | Two clients, one order each: 2 batch commits, both orders marked processed |
| 3 | INT-EDGE-004 | Two product items in one order: verifies FieldValue.increment sentinels and document paths follow `Total Productos/`, `Cartones_vendidos/`, `productos/` structure |

**Edge cases (3 tests):**

| # | Test ID | What it covers |
|---|---------|----------------|
| 4 | INT-EDGE-001 | Empty clientes snapshot: returns `{ pedidosProcesados: 0, pedidosFallidos: 0 }` |
| 5 | INT-EDGE-002 | Client with empty months subcollection: returns 0/0 |
| 6 | INT-EDGE-003 | Month with zero pending orders: returns 0/0 |

**Error handling (1 test):**

| # | Test ID | What it covers |
|---|---------|----------------|
| 7 | INT-ERROR-001 | Order with empty `detalle` array: skipped by real job logic, returns 0/0 |

## Impact

- **No production code modified.** All changes are test-only.
- **No breaking changes.** The new test files are additive.
- **Dev experience**: validates the full 4-stage monthly closing pipeline end-to-end. Any regression in the orchestrator, repositories, or services that affect the pipeline will now surface as test failures.
- **Mock infrastructure**: `firestoreMock.ts` is reusable — future integration tests can import `createMockDb`, `buildMockStore`, `buildTotalProductosAfterStage1`, and `buildCartonesVendidosAfterStage1` instead of building mocks from scratch.

### Test results

- 16/16 tests in this PR pass (`flujoCompleto.test.ts`: 9/9, `jobContable.test.ts`: 7/7).
- The remaining 59 failures in the test suite are pre-existing tech debt and are **not caused by this PR**. They exist on `develop` before this branch.

## Notes

### How to verify

```bash
# Run the full PR scope
npx vitest run tests/flow/flujoCompleto.test.ts tests/integration/jobContable.test.ts --reporter verbose

# Run individually
npx vitest run tests/flow/flujoCompleto.test.ts --reporter verbose
npx vitest run tests/integration/jobContable.test.ts --reporter verbose
```

### Architecture decisions

- Both test files use `Module._cache` injection to mock Firestore at the module level. This is the same pattern established by the existing `monthlyClosing.orchestrator.test.ts` and `contabilidad.repository.test.ts` in the codebase.
- `flujoCompleto.test.ts` imports the shared `firestoreMock.ts` helper. `jobContable.test.ts` contains its own inline mock builder (`configurarEscenario`) because it only needs the Ventas collection chain, not the full document hierarchy.
- Mock helpers were kept separate (`firestoreMock.ts` + `firestoreMockTypes.ts`) rather than inlined, to make them available for future integration tests.

### Size exception

This PR exceeds the standard line limit (~1,353 lines added). The bulk is test infrastructure (`firestoreMock.ts` at 509 lines) and two comprehensive test files. A `size: exception` label is appropriate.

### Follow-up

- The pre-existing 59 test failures are a known tech debt item tracked separately.
- Future work can add tests for additional `processPendingOrders` error scenarios (e.g., batch commit failure, partial writes).
