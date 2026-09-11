# Design: Flujo Completo Integration Test

## Technical Approach

Integration test for `cerrarMes()` through all 4 orchestrator stages using `Module._cache` Firestore mock injection (same pattern as `jobContable.test.ts`). Mock only `firestore.js` + `firebase-admin/firestore`; real services, repos, job, and orchestrator. A central `createMockDb()` factory builds a complete Firestore mock supporting all 9 collections from a single scenario object — no per-test `configurarEscenario` fragmentation.

## Architecture Decisions

| Option | Tradeoffs | Decision |
|--------|-----------|----------|
| Module._cache (existing pattern) | Node.js internals import, no hoisting. Works with CJS | ✅ Proven in jobContable — 425 lines of passing tests |
| vi.mock (vitest hoisted) | Hoisting conflicts with CJS dynamic imports | ❌ Breaks with destructured `require()` calls in repos |
| Per-collection configurarEscenario | Simple per collection, but 9 collections → combinatorial explosion | ✅ Single `buildMockStore(scenario)` handles all collections in one pass |
| Mock both db.doc() and db.collection() | Must support two access patterns | ✅ contabilidad uses `db.doc()`, ventas/contable/admin use `db.collection()` |
| Assert on terminal write refs only | Cleaner assertions, no spying on intermediate queries | ✅ Capture batch.set/update/commit + all direct set calls |

## Data Flow

```
Test setup (buildMockStore with scenario data)
  → cerrarMes("Enero 2026", { uid, nombre })
    → Stage 1: processPendingOrders()
        → ventasRepo.getTodosClientesConVentas()       ← db.collection("Ventas").get()
        → ventasRepo.getPedidosPendientes(clienteId, mes) ← .where("estadoContable").get()
        → contabilidadRepo.buildOperacionesContables()  ← FieldValue sentinels
        → db.batch() → batch.set + batch.update → batch.commit()
    → Stage 2: generarHistoricoMensual()
        → contabilidadRepo.getHistoricoMensual(mes)     ← db.doc("Historico_Mensual/...")
        → contabilidadRepo.getCategoriasTotalProductos()← db.doc("Total Productos/...").collection()
        → contabilidadRepo.setHistoricoMensual(mes, data)
    → Stage 3: cerrarGananciasPorCategoria()
        → contabilidadRepo.getHistoricoMensual(mes)
        → contableRepo.getCostosFijos(cat)              ← db.collection("Invertir")
        → contableRepo.getCostosVariables(cat)
        → contableRepo.setGanancias() + .setHistoricoCompras() + .resetCostosVariables()
    → Stage 4: registrarCierre()
        → adminRepo.setCierreContable(mes, "consolidado", data)  ← db.collection("Cierres_contables")
        → adminRepo.setAdminAction(mes, "cierre_mensual", data)  ← db.collection("AdminActions")
```

## Mock Strategy

Two access patterns must be supported simultaneously:

| Pattern | Usage | Collections |
|---------|-------|-------------|
| `db.collection("X")` → .doc(id).collection("Y").get() | ventas, contable, admin repos | Ventas, Invertir, Ganancias, Cierres_contables, AdminActions |
| `db.doc("X/Y")` → .get() / .collection("Z").get() | contabilidad repos | Total Productos, Cartones_vendidos, Historico_Mensual |

`createMockDb()` returns `{ mockDb, refs }` where `refs` captures all terminal write calls:

```
MockRefs {
  batchSet, batchUpdate, batchCommit,        // Stage 1
  setHistoricoMensual,                       // Stage 2
  setGanancias, setHistoricoCompras,         // Stage 3
  setCierreContable, setAdminAction          // Stage 4
}
```

`buildMockStore(scenario, mockDb, refs)` configures `mockDb.collection` and `mockDb.doc` to return pre-canned data from the scenario object — no intermediate getter needs a `vi.fn`.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/tests/flow/flujoCompleto.test.ts` | Create | 9-scenario integration test for cerrarMes() full pipeline |

No production code is modified.

## Interfaces / Contracts

```typescript
interface FullScenario {
  ventas?: ClienteInput[];           // Stage 1: clientes with months + pedidos
  totalProductos?: CategoriaInput[]; // Stage 2: categories with SKUs + totals
  cartonesVendidos?: CategoriaInput[];
  historicoMensual?: object | null;  // Stage 2 guard: null = does not exist
  invertir?: CostosInput[];          // Stage 3: fixed + variable costs per category
}
```

The orchestrator contract remains unchanged: `cerrarMes(mesAnio: string, admin: { uid: string, nombre: string })` → `Promise<{ mesAnio, snapshot, ganancias }>`.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Integration | FLUJO-FLOW-001 (multi-category) | 2 clients, Clavo + Miel orders → assert 4 stages, ganancias.length === 2 |
| Integration | FLUJO-FLOW-002 (single category) | 1 client, 1 category → ganancias[0].categoria === "Clavo" |
| Integration | FLUJO-EDGE-001 (no pending) | Pre-populated Total Productos/Cartones, 0 orders → stages 2-4 still run |
| Integration | FLUJO-EDGE-002 (already closed) | Historico_Mensual exists → stage 2 throws, stages 3-4 never run |
| Integration | FLUJO-EDGE-003 (empty collections) | Empty productos subcollections → snapshot with zero categories |
| Integration | FLUJO-ERR-001 (empty mesAnio) | `""` → immediate throw, no stages execute |
| Integration | FLUJO-ERR-002 (no admin uid) | Admin without uid → stage 2 throws |
| Integration | FLUJO-ERR-003 (missing fixed costs) | No Invertir/{cat} → stage 3 throws |
| Integration | FLUJO-ERR-004 (missing variable costs) | No costos_variables → stage 3 throws |

## Migration / Rollout

No migration required. Delete `backend/tests/flow/flujoCompleto.test.ts` to rollback.

## Open Questions

None.
