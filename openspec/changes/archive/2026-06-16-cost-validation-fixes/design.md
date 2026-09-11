# Design: cost-validation-fixes

## Technical Approach

Two independent fixes in the monthly closing pipeline:

1. **Cost validation threshold**: Change three validation guards in `ganancias.service.js` from `v < 0` to `v <= 0`, and convert Miel's silent-skip guard to an explicit throw — ensuring zero costs are consistently rejected across all categories.

2. **Admin audit trail**: Thread the full `admin` object `{ uid, nombre }` through the pipeline instead of a bare `adminUid` string. The route passes `req.admin`, the orchestrator passes it to stage 4, and `registrarCierre` extracts `.uid` for `Cierres_contables.ejecutadoPor` and `.nombre` (falling back to `.uid`) for `AdminActions.usuario`.

## Architecture Decisions

### Decision: Pass full admin object vs extract at route
| Option | Tradeoff | Decision |
|--------|----------|----------|
| Extract `.uid` at route, pass `.nombre` down | Two params at every call site | ❌ |
| Pass full admin object | Cleaner signatures, colocated extraction in registrarCierre | ✅ |

**Rationale**: `registrarCierre` writes to two collections with different field semantics (UID for Cierres_contables, human name for AdminActions). Passing the full object keeps extraction logic with the writes and is more extensible for future audit fields (e.g. email).

### Decision: Miel variable cost validation — explicit throw over silent skip
| Option | Tradeoff | Decision |
|--------|----------|----------|
| Keep silent skip for v <= 0 | Inconsistent with non-Miel path, hides data issues | ❌ |
| Explicit throw on v <= 0 | Consistent validation, fails fast on bad data | ✅ |

**Rationale**: Non-Miel validation throws on invalid values. The Miel path should behave identically to prevent silent data corruption.

### Decision: Fallback for admin.nombre
**Choice**: Use `admin.nombre || admin.uid` when writing `AdminActions.usuario`.
**Rationale**: The `adminAuth` middleware always populates `.nombre` from the DB, but a defensive fallback prevents UID strings in the audit trail if the field is ever absent.

## Data Flow

```
Route (req.admin = { uid, email, nombre })
  │
  ▼
orchestrator.cerrarMes(mesAnio, admin)
  │
  ├─ Stage 1: processPendingOrders()
  │
  ├─ Stage 2: generarHistoricoMensual(mesAnio, admin.uid)
  │            └─ Historico_Mensual.generadoPor = admin.uid
  │
  ├─ Stage 3: cerrarGananciasPorCategoria({ mesAnio, categoria })
  │            └─ Validation: v <= 0 → throw
  │
  └─ Stage 4: registrarCierre(mesAnio, admin, snapshot, ganancias)
               ├─ Cierres_contables.ejecutadoPor = admin.uid
               └─ AdminActions.usuario = admin.nombre ‖ admin.uid
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/services/ganancias.service.js` | Modify | Fix 3 validation guards: `v < 0` → `v <= 0` (L70, L135), Miel silent skip → explicit throw (L111) |
| `backend/src/routes/admin.contabilidad.routes.js` | Modify | Pass `req.admin` instead of `req.admin.uid` to orchestrator (L90) |
| `backend/src/services/monthlyClosing.orchestrator.js` | Modify | Signature `cerrarMes(mesAnio, admin)`, pass `admin.uid` to stage 2, full `admin` to stage 4, update log (L25, L30, L50, L83) |
| `backend/src/services/admin.actions.service.js` | Modify | Signature `registrarCierre(mesAnio, admin, ...)`, use `admin.uid` for Cierres_contables, `admin.nombre \|\| admin.uid` for AdminActions (L153, L161, L174) |

## Interfaces / Contracts

```js
// orchestrator
async function cerrarMes(mesAnio, admin)     // admin: { uid, nombre }

// admin.actions.service
async function registrarCierre(mesAnio, admin, snapshot, ganancias)

// contabilidad.service (unchanged)
async function generarHistoricoMensual(mesAnio, adminUid)
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `ganancias.service` validates v <= 0 for all cost types | Mock repo reads returning zero values; assert throw for costos_fijos, non-Miel costos_variables, Miel product variable costs |
| Unit | `admin.actions.registrarCierre` writes admin.uid and admin.nombre correctly | Pass mock admin object; assert `ejecutadoPor = admin.uid`, `usuario = admin.nombre` |
| Integration | Pipeline end-to-end with mock repos | Stub all 4 stages; verify signature changes propagate correctly |
| Unit | Fallback when admin.nombre is falsy | Pass `admin = { uid: "abc", nombre: "" }`; assert `usuario = "abc"` |

## Rollback

Simple revert of the 4 modified files. Each file's changes are self-contained with no migration impact.
