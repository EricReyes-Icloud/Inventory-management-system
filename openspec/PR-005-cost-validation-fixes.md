# PR #5 — Cost validation fixes, admin audit trail & variable cost model

## Description

This PR applies three fixes identified as known issues in PR #4 (notes section), all in the monthly closing pipeline:

1. **Cost validation threshold** — Guards in `ganancias.service.js` used `v < 0`, allowing zero-cost line items to pass through undetected.
2. **Admin audit trail** — The closing pipeline stored only the admin UID instead of the admin's real name, making audit logs unreadable.
3. **Variable cost accounting model** — Variable costs were incorrectly multiplied by quantity alongside fixed costs. Per accounting rules, variable costs are period costs and should be added after the fixed × quantity multiplication.

## Changes Made

### Fix 1 — Cost validation (`v < 0` → `v <= 0`)

- **`backend/src/services/ganancias.service.js`**: Three validation guards changed from `v < 0` to `v <= 0`:
  - Miel branch: costos fijos validation
  - Miel branch: costos variables validation
  - No Miel branch: consolidated validation
  - All three now reject zero values the same way they reject negatives.

### Fix 2 — Admin audit trail with real name

- **`backend/src/routes/admin.contabilidad.routes.js`**: Passes `req.admin` (full object) instead of `req.admin.uid` to the orchestrator.
- **`backend/src/services/monthlyClosing.orchestrator.js`**: Signature changed from `(mesAnio, adminUid)` to `(mesAnio, admin)`. Stages 2 and 4 forward the full admin object.
- **`backend/src/services/admin.actions.service.js`**: `registrarCierre()` now receives `admin` instead of `adminUid`. Saves `usuario: admin.nombre` in `AdminActions` and `usuario: admin.nombre` in `Cierres_contables`.
- **`backend/src/services/contabilidad.service.js`**: `generarHistoricoMensual()` now receives `admin` instead of `adminUid`. Saves `generadoPor: admin.uid` and `usuario: admin.nombre` in the historical snapshot.
- **`backend/tests/unit/services/monthlyClosing.orchestrator.test.ts`**: All callsites and assertions updated from string `"admin-1"` to `{ uid: "admin-1", nombre: "Admin Test" }`.

### Fix 3 — Variable costs as period costs

- **`backend/src/services/ganancias.service.js`** (Miel branch): `sumaVar` is now added directly to `inversionProducto` after fixed costs are multiplied by quantity, instead of being accumulated into `costoUnitProducto` and then multiplied.
- **`backend/src/services/ganancias.service.js`** (No Miel branch): Formula changed from `(costosFijosUnit + costosVariablesUnit) * cartonesTotal` to `(costosFijosUnit * cartonesTotal) + costosVariablesUnit`.
- Miel branch validation also unified: silent skip (`if v > 0 sumaVar += v`) replaced with explicit throw (`if v <= 0 throw`), consistent with No Miel behavior.

## Impact

- **Zero-cost items are now properly rejected** instead of silently creating entries with no investment recorded.
- **Admin audit logs are human-readable** — the admin's name appears in `AdminActions` and `Cierres_contables` collections, and in the `Historico_Mensual` snapshot.
- **Variable costs are correctly accounted** as period costs (not unit costs), matching real accounting rules for "Condimentos El Colibrí."
- **Existing tests updated** to pass with the new signatures. No regression on existing functionality.
- All three changes are backward-incompatible at the service layer (signature changes), but no external API contracts were modified — only internal service calls.

## Notes

- The `monthlyClosing.orchestrator.js` signature change from `adminUid` (string) to `admin` (object) is technically breaking for any direct callers, but the orchestrator is only invoked from the route handler, which was updated in the same changeset.
- The variable cost fix in the No Miel branch was already applying `sumaVar` as a period cost — the fix there was purely the threshold validation. The structural change was primarily in the Miel branch.
