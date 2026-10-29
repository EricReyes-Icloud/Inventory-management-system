# Feature: job-contable-optimization

**Objective:** Replace the N+1 client→month→pedidos query pattern in `jobContableMensual.js` with a single Collection Group Query over `pedidos` subcollection, reducing Firestore reads from O(N×M) to O(1) for discovery phase.

**Branch:** `feat/backend-robustez` (existing feature branch, no new branch)
**Delivery strategy:** `ask-on-risk` (default). Forecast ~200 authored changed lines → single PR. Push/PR/merge remain human decisions.
**Test runner:** `npm run test:ci` (root, vitest) — baseline 273 tests / 26 files.

## Specs

**S1 — New repository method for global pending orders query.**
Scope: `backend/src/repositories/ventas.repository.js`.
Acceptance: New function `getTodosPedidosPendientesGlobal()` uses `collectionGroup("pedidos")` with `.where("estadoContable", "==", "pendiente").where("pagado", "==", true)`. Returns QuerySnapshot.
Check: Unit test mocks Firestore and asserts query structure.

**S2 — Job uses global query instead of nested loops.**
Scope: `backend/src/jobs/jobContableMensual.js` (`processPendingOrders`).
Acceptance: Function calls `ventasRepo.getTodosPedidosPendientesGlobal()` once, groups results by `clienteId|mesAnio` extracted from document path, then processes each group with existing batch logic. No more `getTodosClientesConVentas`, `getMesesPedidos`, `getPedidosPendientes` calls in the hot path.
Check: Unit test asserts single repository call and correct grouping.

**S3 — Firestore composite index defined.**
Scope: `firestore.indexes.json` (or Firebase Console equivalent).
Acceptance: Collection Group index on `pedidos` with fields: `estadoContable` (ASC), `pagado` (ASC), `fechaPedido` (ASC).
Check: Index deployed and active in Firebase project.

**S4 — Existing behavior preserved (idempotency, atomic batch per pedido).**
Scope: `jobContableMensual.js` batch logic.
Acceptance: Each pedido still gets its own atomic batch with contabilidad operations + `contabilidadAplicada: true` marker. Validation guards (pagado, estadoContable, detalle, fecha) unchanged.
Check: Integration test with mock Firestore verifies same output for same input.

**S5 — Full suite passes, zero regressions.**
Scope: `npm run test:ci`.
Acceptance: 273+ tests green, all existing job tests pass with new implementation.
Check: CI run.

## Tasks

| ID | S# | Route | Task | Status | Evidence |
|----|----|-------|------|--------|----------|
| T1 | S1 | inline | Add `getTodosPedidosPendientesGlobal()` to `ventas.repository.js` with collectionGroup query | ⏳ | — |
| T2 | S1 | inline | Add unit test for `getTodosPedidosPendientesGlobal()` mocking Firestore collectionGroup | ⏳ | — |
| T3 | S2 | inline | Refactor `processPendingOrders()` to use global query + group by clienteId|mesAnio | ⏳ | — |
| T4 | S2 | inline | Update job unit tests to mock new repository method and verify grouping | ⏳ | — |
| T5 | S3 | inline | Add/update `firestore.indexes.json` with collectionGroup index for pedidos | ⏳ | — |
| T6 | S4 | inline | Verify idempotency guards and batch logic unchanged via existing tests | ⏳ | — |
| T7 | S5 | inline | Run full suite `npm run test:ci` — expect 273+ tests green | ⏳ | — |
| T8 | all | inline | Work-unit commit on `feat/backend-robustez` | ⏳ | — |

## Log

**L1 (user, verbatim):** "Job contable lee TODOS los clientes cada vez — no escala bien. Me parece perfecta esa propuesta, vamos a implementarlo con ODD por favor."

**D1 — Classification (2026-10-29).** Large. Resume test fails: requires Firestore index deployment (external wait), changes fundamental query pattern, spans repository + job + index config. High risk: item 6 (optimization of read path, no test catches regression if query structure wrong). Independent verifier required for T7.

**D2 — Design decision: collectionGroup over nested loops (2026-10-29).** Single query with composite index replaces O(N×M) reads. Groups results in memory by extracting `clienteId` and `mesAnio` from document path (`Ventas/{clienteId}/Pedidos/{mesAnio}/pedidos/{pedidoId}`). Preserves per-pedido atomic batch.

**D3 — Index requirement (2026-10-29).** Composite index on collection group `pedidos`: `estadoContable` ASC, `pagado` ASC, `fechaPedido` ASC. Must be deployed before job runs in production. Added to `firestore.indexes.json` for CI/CD.

**D4 — Backward compatibility (2026-10-29).** Old methods `getTodosClientesConVentas`, `getMesesPedidos`, `getPedidosPendientes` remain in repository for other consumers (APIs, admin UI). Only the job switches to global query.

**Risk: item 6 (read path optimization, no test catches wrong query structure) — mitigated by unit test asserting query shape + integration test with mock Firestore.**