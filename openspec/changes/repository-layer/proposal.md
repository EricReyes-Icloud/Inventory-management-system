# Proposal: Monthly Closing Process Redesign (Fase 4)

## Intent

The monthly closing flow has 4 services with overlapping, inconsistent responsibilities and 2 critical runtime bugs. `ganancias.service.js` bypasses the repository layer (6+ direct `db.collection()` calls) and references an undefined `costosVariablesRef`. `cierreMensual.service.js` cannot run (no `contabilidadRepo` import). Two services write `Historico_Mensual` with INCOMPATIBLE schemas (nested vs flat). The system works today only because the broken path was never actually invoked — the next admin-triggered close would silently corrupt the earnings calculation. This change makes `Historico_Mensual` the single source of truth and routes the entire close through one orchestrator.

## Scope

### In Scope
- Define the canonical 4-stage monthly closing pipeline + orchestrator
- Extend `contable.repository.js` with Invertir subcollection + Ganancias write methods
- Refactor `ganancias.service.js` to use repositories exclusively; fix `costosVariablesRef` bug
- Formalize `contabilidad.service.generarHistoricoMensual` as the SOLE writer of `Historico_Mensual`
- Delete `cierreMensual.service.js` (logic is already in `contabilidad.service`, the working path)
- Migrate admin route to call the orchestrator
- Delete the dead `/calcular-ganancias` endpoint in `routes/ventas.js` (imports non-existent function)

### Out of Scope
- Changing the Firestore collection structure (only additive schema extensions to `Historico_Mensual`)
- Frontend changes (response shape stays identical)
- Migrating services outside the monthly-closing flow

## Capabilities

### New Capabilities
- `monthly-closing`: single `cerrarMes(mesAnio, adminUid)` entry point orchestrating snapshot → earnings → audit.

### Modified Capabilities
- `contable.repository`: extend with `setGanancias`, `setHistoricoCompras`, `resetCostosVariables`, `getCostosVariablesPorProducto`, `setCostosVariablePorProducto`. Becomes the single access layer for all Invertir paths and Ganancias writes.
- `contabilidad.service`: becomes the sole writer of `Historico_Mensual`; produces the NESTED schema with `estado`/`generadoEn`/`generadoPor` metadata. Other writers are deleted.

## Approach

### The Canonical Pipeline

```
[1] jobContableMensual          per-order, real-time  → Total Productos, Cartones_vendidos (live)
        │
        ▼
[2] contabilidad.service         month-close trigger  → Historico_Mensual/{mes}  (NESTED + metadata)
   .generarHistoricoMensual()
        │
        ▼
[3] ganancias.service            reads frozen snapshot → Ganancias/{mes}
   .cerrarGananciasPorCategoria()                       → Invertir/{cat}/historico_compras/{mes}
                                                        → Invertir/{cat}/costos_variables  (RESET)
        │
        ▼
[4] admin.actions.service        audit                 → AdminActions/{mes}, Cierres_contables/{mes}
```

### File Restructure

| File | Decision | Reason |
|---|---|---|
| `services/cierreMensual.service.js` | **DELETE** | Duplicates `contabilidad.service.generarHistoricoMensual` with broken code + wrong (flat) schema |
| `services/contabilidad.service.js` | KEEP, formalize as sole `Historico_Mensual` writer | Already has the working NESTED writer (Path B) that `ganancias.service` reads |
| `services/ganancias.service.js` | REFACTOR | Replace 6+ direct `db.collection()` calls with `contable.repository`; fix `costosVariablesRef` |
| `services/monthlyClosing.orchestrator.js` | **NEW** | Single entry point, owns pipeline ordering and audit |
| `services/admin.actions.service.js` | No change (Fase 3) | Already on repository |
| `routes/admin.contabilidad.routes.js` | MODIFY | Calls `orchestrator.cerrarMes()` instead of `cierreMensual.cerrarMesContable()` |
| `routes/ventas.js` | MODIFY | Delete dead `/calcular-ganancias` endpoint and its broken import |

### The Orchestrator

```js
// backend/src/services/monthlyClosing.orchestrator.js
async function cerrarMes(mesAnio, adminUid) {
  const snapshot  = await contabilidadService.generarHistoricoMensual(mesAnio, adminUid);
  const ganancias = await gananciasService.cerrarGananciasPorCategoria(mesAnio);
  const audit     = await adminActionsService.registrarCierre(mesAnio, adminUid, snapshot, ganancias);
  return { mesAnio, snapshot, ganancias, audit };
}
```

### Repository Boundaries

`contable.repository.js` owns ALL Invertir + Ganancias paths:

```js
// Reads
getInvertir(categoria)                                  // Invertir/{cat}
getCostosFijos(categoria)                               // Invertir/{cat}/costos_fijos/costos_fijos
getCostosVariables(categoria)                           // Invertir/{cat}/costos_variables (aggregate)
getCostosVariablesPorProducto(categoria, producto)      // Invertir/{cat}/costos_variables/{producto}
getGanancias(mesAnio)                                   // Ganancias/{mes}

// Writes
setGanancias(mesAnio, data)                             // Ganancias/{mes} (merge)
setHistoricoCompras(categoria, mesAnio, data)            // Invertir/{cat}/historico_compras/{mes}
resetCostosVariables(categoria)                         // zeros the aggregate doc
setCostosVariablePorProducto(categoria, producto, data) // single SKU write
```

`admin.repository.getInversion(categoria)` (main Invertir doc) stays where it is — that's an admin concern, not contable.

### Canonical `Historico_Mensual` Schema

```js
Historico_Mensual/{mesAnio} = {
  totalProductos:   { [categoria]: { total: N, skus: { [sku]: N } } },  // NESTED
  cartonesVendidos: { [categoria]: { total: N, skus: { [sku]: N } } },  // NESTED
  estado: "cerrado",          // NEW (additive)
  generadoEn: <Timestamp>,    // NEW
  generadoPor: <adminUid>     // NEW
}
```

We pick NESTED because `ganancias.service.js` already reads `historico.totalProductos[categoria].total`. Metadata fields are non-breaking additions — old readers ignore them.

### The `costosVariablesRef` Fix

The line `await costosVariablesRef.set(resetData, { merge: true })` (line 236) targets the aggregate `costos_variables` document, zeroing all per-producto entries after the close. This is now expressed as `await contableRepo.resetCostosVariables(categoria)`.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `backend/src/services/monthlyClosing.orchestrator.js` | **New** | Pipeline orchestrator |
| `backend/src/services/cierreMensual.service.js` | **Removed** | Logic absorbed by `contabilidad.service` |
| `backend/src/services/ganancias.service.js` | Modified | Repository-only; fix `costosVariablesRef` |
| `backend/src/services/contabilidad.service.js` | Modified | Sole `Historico_Mensual` writer + metadata |
| `backend/src/repositories/contable.repository.js` | Modified | +5 new methods (set/reset + per-producto) |
| `backend/src/routes/admin.contabilidad.routes.js` | Modified | Calls orchestrator |
| `backend/src/routes/ventas.js` | Modified | Delete dead `/calcular-ganancias` |
| `backend/tests/unit/repositories/contable.repository.test.ts` | Modified | New methods coverage |
| `backend/tests/unit/services/ganancias.service.test.ts` | Modified | Mock `contable.repository`, not `db` |
| `backend/tests/unit/services/monthlyClosing.orchestrator.test.ts` | **New** | Pipeline tests |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `costosVariablesRef` "fix" doesn't match original intent | Medium | Documented in spec as `resetCostosVariables(categoria)`; explicit code comment in the diff explains the intent |
| Deleting `cierreMensual.service.js` breaks a hidden import | Low | Project-wide grep before deletion; orchestrator test catches it |
| Orchestrator mid-pipeline failure leaves partial state | Medium | Stages are idempotent — re-running the orchestrator overwrites snapshot, recalculates earnings from immutable snapshot, merge-sets audit. Re-run = natural recovery. |
| NESTED schema with new metadata breaks a reader using `.data()` on the whole doc | Low | All readers access subfields explicitly; metadata is additive |
| Real production data lacks `estado`/`generadoEn` fields | Low | Default to `"abierto"` / `null` if missing; readers tolerant |

## Rollback Plan

1. **Revert the commit** — restores all service files, including `cierreMensual.service.js`.
2. **Schema rollback is unnecessary**: additive metadata in `Historico_Mensual` is forward-compatible; old readers ignore new fields.
3. **In-flight failure recovery** (no rollback needed): re-run `cerrarMes(mesAnio, adminUid)` — each stage is idempotent over its own input.
4. If only the orchestrator misbehaves, pointing the admin route back to `cierreMensual.service` is not possible (file deleted) — commit revert is the safe path.

## Dependencies

- `contabilidad.repository.js` ✅ (Fase 1)
- `admin.repository.js` ✅ (Fase 3)
- `contabilidad.service.generarHistoricoMensual()` already produces the NESTED schema (Path B) that `ganancias.service` expects — no schema work needed in the service.

## Success Criteria

- [ ] `monthlyClosing.orchestrator.cerrarMes(mesAnio, adminUid)` runs end-to-end without errors
- [ ] `cierreMensual.service.js` deleted; zero project references
- [ ] `ganancias.service.js` has zero `db.collection()` calls
- [ ] `contable.repository.js` exposes all 9 methods above with ≥80% test coverage
- [ ] `Historico_Mensual/{mes}` docs have NESTED structure + `estado`/`generadoEn`/`generadoPor`
- [ ] All existing tests pass + new orchestrator tests (≥6 scenarios: happy path, re-run idempotency, missing-month, partial-failure recovery, earnings-only, snapshot-only)
- [ ] Admin endpoint `/admin/contabilidad/cerrar-mes` returns identical response shape to today
