# Design: jobContable-integration-test

## Technical Approach

Integration tests for `processPendingOrders()` using `Module._cache` injection (same pattern as `ventas.test.ts`). The key difference from existing unit tests: **real repositories**, not mocked ones.

```
Tests → processPendingOrders() → real ventas.repository.js → mocked db (firestore.js)
                                 → real contabilidad.repository.js → mocked db + mocked FieldValue
                                 → real utility modules (fechas, diccionario, normalizarTexto)
```

Only two modules are mocked:
- `src/lib/firestore.js` — the `db` object (chainable collection/doc/batch API)
- `firebase-admin/firestore` — `FieldValue.increment` and `FieldValue.serverTimestamp`

Everything else (`ventas.repository.js`, `contabilidad.repository.js`, `fechas.js`, `diccionario.js`, `normalizarTexto.js`) runs with **real implementations**. This is what makes these *integration* tests — they verify the actual composition of job + repos + utility logic against a controlled Firestore mock.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Real repos, not mocked** | Unit tests already mock repos; integration tests need to prove the real composition works |
| **Module._cache injection** | Consistent with the established project pattern (`ventas.test.ts`, `jobContable.rules.test.ts`) — avoids fighting Vitest's ESM/CJS interop |
| **FieldValue as sentinel objects** | `contabilidad.repository.buildOperacionesContables()` calls `FieldValue.increment(n)` and `FieldValue.serverTimestamp()`. The mock returns `{ _increment: n }` / `{ _serverTimestamp: true }` — the test asserts the operation objects contain these sentinels, not that they survive batch.set |
| **`db.doc(path)` returns path string** | Same as unit tests — `batch.set(ref, data, opts)` receives the path string directly. Since the integration test validates the *structure* of operations (correct paths, FieldValue sentinels), not actual Firestore serialization, this is sufficient |
| **Inline mock builder** | A `createMockDb()` factory (like `ventas.test.ts`) that returns terminal references for assertions. Each test configures the mock data via helpers, keeping the test body focused on the scenario |

## Mock Architecture

```
Module._cache injection (beforeEach):
  src/lib/firestore.js
    → { collection(), doc(), batch() }
    → collection("Ventas") → .get() → clientesSnapshot { docs, empty }
                            → .doc(id) → .collection("Pedidos") → .get() → mesesSnapshot
                                                                   → .doc(mes) → .collection("pedidos") → .where(field, op, val) → .get() → pedidosSnapshot
    → batch() → { set, update, commit }
    → doc(path) → path string (passthrough)

  firebase-admin/firestore
    → { FieldValue: { increment: vi.fn(n => ({ _increment: n })),
                       serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })) } }

Cache cleanup (clear so repos re-require with mocked deps):
  ventas.repository.js, contabilidad.repository.js

Dynamic import (after mocks injected):
  jobContableMensual.js → .processPendingOrders()
```

### Mock data shape for happy path

```
clientesSnapshot: { docs: [{ id: "Cliente_A", data: () => ({ Nombre: "Test" }) }], empty: false }
mesesSnapshot:    { docs: [{ id: "Enero 2026" }], empty: false }
pedidosSnapshot:  {
  docs: [{
    id: "pedido-001",
    data: () => ({
      pagado: true,
      contabilidadAplicada: false,
      detalle: [{ nombre: "Clavo", cantidad: 2, subtotal: 5000 }],
      fechaPedido: new Date("2026-01-15"),
    }),
    ref: { id: "pedido-001", update: vi.fn() },
  }],
  empty: false,
  size: 1,
}
```

## File Changes

| File | Action |
|------|--------|
| `backend/tests/integration/jobContable.test.ts` | **Modify** — currently empty; populate with integration tests |

## Testing Strategy

### Test structure (per spec scenarios)

```
describe("processPendingOrders - integration")
  describe("happy path")          → INT-FLOW-001, INT-FLOW-002, INT-EDGE-004
  describe("edge cases")         → INT-EDGE-001, INT-EDGE-002, INT-EDGE-003
  describe("error handling")     → INT-ERROR-001
```

### Assertion strategy

Each test asserts on **three layers**:
1. **Return value** — `{ pedidosProcesados, pedidosFallidos }` matches expected counts
2. **Firestore mock calls** — `batch.set` was called with correct operation paths + FieldValue sentinels; `batch.update` marks order as `estadoContable: "procesado"`; `batch.commit` was called the expected number of times
3. **Real `buildOperacionesContables` output** — the operations structure reflects real categorization logic (e.g., "Clavo" maps to `Clavo` category, paths contain `Total Productos/Enero 2026/...`)

### Edge case coverage

| Scenario | Key assertion |
|----------|---------------|
| Empty clients | Returns `{ 0, 0 }`, no batch calls |
| Client with no months | Client skipped, no batch calls |
| Month with no orders | Month skipped, no batch calls |
| Empty detalle array | Order skipped, no batch calls |
| Two product items | Correct category mapping + FieldValue.increment calls |
| Two clients each with an order | Two separate batch commits |

### Cleanup strategy

Each `afterEach`:
1. Delete mock entries from `Module._cache` (firestore.js, firebase-admin/firestore)
2. Clear repo cache entries so next test gets fresh requires
3. `vi.restoreAllMocks()`
