# Tasks: jobContable-integration-test

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~300 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Mock Infrastructure

- [x] 1.1 Add `createMockDb()` builder in `backend/tests/integration/jobContable.test.ts` — returns chainable collection/doc/batch mock with terminal references for assertions
- [x] 1.2 Add `firebase-admin/firestore` mock (`FieldValue.increment` as `{ _increment: n }`, `serverTimestamp` as `{ _serverTimestamp: true }`)
- [x] 1.3 Add `beforeAll` hook (instead of `beforeEach` for module loading): inject both mocks into `Module._cache`, clear cache for `ventas.repository.js` and `contabilidad.repository.js` so they re-require with mocked deps. `beforeEach` mutates the shared mockDb object for per-test data.

## Phase 2: Happy Path Tests

- [x] 2.1 Test **INT-FLOW-001** — one client, one month, one pending paid order: assert `{ pedidosProcesados: 1, pedidosFallidos: 0 }`, `batch.set` called, `batch.update` marks `estadoContable: "procesado"`, `batch.commit` called once
- [x] 2.2 Test **INT-FLOW-002** — two clients, one order each: assert two `batch.commit` calls, both orders processed correctly, result `{ pedidosProcesados: 2, pedidosFallidos: 0 }`
- [x] 2.3 Test **INT-EDGE-004** — one order with two product items: assert `batch.set` receives `FieldValue.increment` sentinels for quantity and subtotal, operation paths follow expected document structure

## Phase 3: Edge Case Tests

- [x] 3.1 Test **INT-EDGE-001** — empty clientes snapshot: assert early return with `{ pedidosProcesados: 0, pedidosFallidos: 0 }`, zero batch calls
- [x] 3.2 Test **INT-EDGE-002** — one client with empty months subcollection: assert client skipped, result `{ 0, 0 }`, zero batch calls
- [x] 3.3 Test **INT-EDGE-003** — one client, one month, zero pending orders: assert month skipped, result `{ 0, 0 }`, zero batch calls

## Phase 4: Error Handling + Cleanup

- [x] 4.1 Test **INT-ERROR-001** — pending paid order with empty `detalle`: assert order filtered by job validation, result `{ 0, 0 }`, zero batch calls
- [x] 4.2 Add `afterEach` hook: delete mock entries from `Module._cache`, clear repo cache entries, call `vi.restoreAllMocks()`
