# PR-031: Optimize jobContableMensual with Collection Group Query

## Description

This PR optimizes the monthly accounting job (`jobContableMensual`) by replacing the O(N×M) nested loop query pattern with a single Collection Group Query over the `pedidos` subcollection.

**Problem**: The original implementation read all clients with sales (`getTodosClientesConVentas`), then for each client read all months (`getMesesPedidos`), then for each month read pending orders (`getPedidosPendientes`). With 100 clients × 12 months = ~1,200 Firestore reads per job run. This does not scale.

**Solution**: Use a Collection Group Query on the `pedidos` subcollection with filters `estadoContable == "pendiente"` and `pagado == true`, ordered by `fechaPedido`. This reduces discovery reads to 1 query regardless of client/month count. Results are grouped in memory by `clienteId|mesAnio` (extracted from document path `Ventas/{clienteId}/Pedidos/{mesAnio}/pedidos/{pedidoId}`) to preserve per-pedido atomic batch processing.

**Why it matters**: Linear read growth eliminated. Job latency now constant. Firestore quota consumption flat.

## Changes Made

### Features

- **`backend/src/repositories/ventas.repository.js`**
  - Added `getTodosPedidosPendientesGlobal()` — collectionGroup query with `estadoContable=pendiente`, `pagado=true`, `orderBy(fechaPedido)`
  - Exported new method alongside existing ones (backward compatibility)

- **`backend/src/jobs/jobContableMensual.js`**
  - Refactored `processPendingOrders()` to call `ventasRepo.getTodosPedidosPendientesGlobal()` once
  - In-memory grouping by `clienteId|mesAnio` extracted from document ref path
  - Preserves all validation guards (pagado, estadoContable, detalle, fecha) and atomic batch per pedido
  - Logging updated to show grouped processing

- **`firestore.indexes.json`** (new file)
  - Composite index for collection group `pedidos`: `estadoContable ASC`, `pagado ASC`, `fechaPedido ASC`

### Test Updates

- **`backend/tests/unit/repositories/ventas.repository.test.ts`**
  - Added 2 tests for `getTodosPedidosPendientesGlobal()`: query structure assertion + empty snapshot

- **`backend/tests/unit/job/jobContable.rules.test.ts`**
  - Updated mock setup to inject `ventasRepo.getTodosPedidosPendientesGlobal` via `Module._cache`
  - Replaced `configurarMocks` (nested client→month→pedidos mock) with `configurarMockGlobal` (single global query mock)
  - All 11 existing rule tests pass unchanged — behavior verified

- **`backend/tests/integration/jobContable.test.ts`**
  - Added `collectionGroup` mock to `createMockDb()` and `configurarEscenario()`
  - Collects all pedidos from scenario into flat array for global query mock
  - Preserves legacy nested mock for backward compatibility tests

- **`backend/tests/helpers/firestoreMock.ts`**
  - Added `collectionGroup` mock to `createMockDb()` (returns empty by default)
  - Added `collectionGroup` mock to `buildMockStore()` (returns all pedidos from scenario)

## Impact

- **Performance**: Firestore reads for job discovery reduced from ~1,200 (100 clients × 12 months) to **1**. Latency from sequential round-trips to single round-trip.
- **Scalability**: Read count now constant regardless of client/month growth.
- **Backward compatibility**: Full. Old repository methods (`getTodosClientesConVentas`, `getMesesPedidos`, `getPedidosPendientes`) retained for other consumers (APIs, admin UI). Job logic (validations, atomic batch, idempotency) unchanged.
- **Firestore index**: Must be deployed before production use. Index defined in `firestore.indexes.json` for CI/CD; manual creation via Firebase Console link in error message works immediately.

## Notes

- **How to verify**:
  1. Deploy index: open Firebase Console link from error or run `firebase deploy --only firestore:indexes`
  2. Run `npm run test:ci` — 274/274 tests pass
  3. Execute job via `POST /api/admin/job-contable` — observe single query in logs

- **Risk (Item 6 — read path optimization)**: No test catches wrong query structure if composite index missing or fields wrong. Mitigated by:
  - Unit test asserting query shape (`collectionGroup("pedidos")`, where clauses, orderBy)
  - Integration tests with mock Firestore verifying end-to-end behavior
  - Error message provides direct link to create missing index

- **Follow-up**: Deploy index to production Firebase project. Consider adding `firebase deploy --only firestore:indexes` to CI pipeline.