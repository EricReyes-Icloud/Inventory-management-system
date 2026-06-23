# Design: contabilidad-service-test

## Technical Approach

Add validation guards to `generarHistoricoMensual` and create a Vitest test file using the `Module._cache` mocking pattern established in `ganancias.service.test.ts`. The service contract (signature, return type) remains unchanged; only preconditions are enforced. No changes to orchestrator, routes, or existing tests.

## Architecture Decisions

### Decision: Module._cache Mocking Pattern

| Option | Tradeoff |
|--------|----------|
| **Module._cache pre-seed** (chosen) | Project convention. Avoids `vi.mock()` hoisting issues with CJS + TS paths. Works because services use `require()` at module scope. |
| `vi.mock()` factory | Vitest hoisting conflicts with CJS `require` patterns in the project. Not used elsewhere. |
| Dependency injection | Would require refactoring all services. Out of scope. |

**Rationale**: Follow the established pattern exactly — pre-seed `contabilidad.repository` in `Module._cache`, clear the service cache, `require()` the service fresh. The orchestrator test (`monthlyClosing.orchestrator.test.ts`) already mocks `contabilidad.service` the same way.

### Decision: Validation-First Guards

| Option | Tradeoff |
|--------|----------|
| **Guards at top of method** (chosen) | Fail fast — zero wasted Firestore reads. Self-contained validation regardless of caller. |
| Guards in orchestrator | Duplicates validation logic across callers. Orchestrator already passes valid admin. |
| Guards as middleware | Overengineered for a single method. |

**Rationale**: All three guards (`admin.uid`, `admin.nombre`, duplicate `mesAnio`) execute before any `await` — no Firestore costs on invalid input.

### Decision: Duplicate Check Before Category Reads

| Option | Tradeoff |
|--------|----------|
| **Check `getHistoricoMensual` first** (chosen) | Saves all downstream Firestore reads if snapshot exists. One read vs ~N reads. |
| Check after category reads | Wasted reads if duplicate found later. No benefit. |

**Rationale**: `getHistoricoMensual` is a single document read; category reads could be dozens of documents (categories × SKUs). Checking first minimizes read costs.

### Decision: No Orchestrator Changes

| Option | Tradeoff |
|--------|----------|
| **No changes** (chosen) | Orchestrator already passes `{ uid, nombre }` admin. Interface unchanged. |
| Add try/catch in orchestrator | Not needed — errors propagate correctly via existing stage-error handling (see test at line 179). |

**Rationale**: The orchestrator's `cerrarMes` already calls `generarHistoricoMensual(mesAnio, admin)` with a valid admin object. The new guards don't change the call contract — they make existing implicit requirements explicit. Existing orchestrator test data (`{ uid: "admin-1", nombre: "Admin Test" }`) satisfies the new guards.

## Data Flow

```
contabilidad.test.ts                           contabilidad.service.js
  │                                                    │
  ├─ Module._cache[repo] = {...mocks}                  │
  ├─ delete Module._cache[service]                     │
  ├─ service = require(...)                            │
  │                                                    │
  └─ service.generarHistoricoMensual(mesAnio, admin)   │
       │                                               │
       ├──── validate admin.uid ──────→ throw if falsy │
       ├──── validate admin.nombre ───→ throw if falsy │
       ├──── getHistoricoMensual ─────→ throw if exists│
       │                                               │
       ├──── getCategoriasTotalProductos ──────────────│
       │       └── for each: getSkusTotalProductos     │
       ├──── getCategoriasCartonesVendidos ────────────│
       │       └── for each: getSkusCartonesVendidos   │
       ├──── setHistoricoMensual(data) ────────────────│
       └──── return { totalProductos, cartonesVendidos }│
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/services/contabilidad.service.js` | Modify | Add 3 validation guards at the top of `generarHistoricoMensual` |
| `backend/tests/unit/services/contabilidad.test.ts` | Create | Unit test file covering all 10 scenarios from spec |

## Interfaces / Contracts

No new interfaces. Existing `generarHistoricoMensual(mesAnio, admin)` contract gains preconditions:

```js
/**
 * @param {string} mesAnio
 * @param {object} admin — must have { uid, nombre }
 * @throws {Error} If admin.uid, admin.nombre missing, or duplicate mesAnio
 * @returns {Promise<{totalProductos, cartonesVendidos}>}
 */
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `generarHistoricoMensual` (8 scenarios) | Module._cache mock of contabilidad.repository. Test happy path, empty data, missing SKUs, admin validation (2), duplicate rejection, error propagation. |
| Unit | Export surface (2 scenarios) | Assert exactly 3 exports, all functions. `obtenerCategoria` and `buildOperacionesContables` match repo references. |

## Migration / Rollback

No migration required. The new guards are purely additive — they reject inputs that would have caused runtime errors downstream. Rollback: revert `contabilidad.service.js` and delete the test file.

## Open Questions

None.
