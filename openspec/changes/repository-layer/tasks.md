# Tasks: Repository Layer — Monthly Closing Orchestrator & contable.repository

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~600–750 (additions + deletions) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Repo Foundation) → PR 2 (Services + Orchestrator) → PR 3 (Routes + Cleanup) → PR 4 (Tests) |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Base Branch |
|------|------|-----------|-------------|
| 1 | Repository Foundation: contable.repository + contabilidad.repository metadata | PR #1 | `feat/fase4-cierre-mensual` (tracker) |
| 2 | Job extraction + Service refactors (ganancias, contabilidad, admin.actions) | PR #2 | PR #1 branch |
| 3 | Orchestrator + Route wiring + Cleanup | PR #3 | PR #2 branch |
| 4 | New tests + regression | PR #4 | PR #3 branch |

## Phase 1: Repository Foundation

- [x] 1.1 Create `repositories/contable.repository.js` with 9 methods: `getInvertir`, `getCostosFijos`, `getCostosVariables`, `getCostosVariablesPorProducto`, `getGanancias`, `setGanancias`, `setHistoricoCompras`, `resetCostosVariables`, `setCostosVariablePorProducto`. Follow pattern from `contabilidad.repository.js` (`const db = require("../lib/firestore")`, no DI, `null` for missing docs).
- [x] 1.2 Modify `repositories/contabilidad.repository.js` — `setHistoricoMensual(mesAnio, data)` accepts full data payload from service (including `generadoPor`); remove hardcoded field defaults.

## Phase 2: Job Extraction

- [x] 2.1 Extract `processPendingOrders()` as named export from `jobs/jobContableMensual.js`. Iterates client/mes/pedido, processes pending, skips done.
- [x] 2.2 Refactor `jobContableMensual.js` — main export wraps `processPendingOrders()`; cron behavior unchanged. Update `module.exports`.

## Phase 3: Service Refactors

- [x] 3.1 Refactor `services/ganancias.service.js` — replace all 7 `db.collection()` calls with `contableRepo.*`; fix `costosVariablesRef` bug (line 236 → `contableRepo.resetCostosVariables(categoria)`); uniform Miel validation (throw if missing, no silent skip); export only `cerrarGananciasPorCategoria`.
- [x] 3.2 Modify `services/contabilidad.service.js` — `generarHistoricoMensual(mesAnio, adminUid)`; remove existence guard (idempotent overwrite); pass metadata (`estado`, `generadoEn`, `generadoPor`) in snapshot payload.
- [x] 3.3 Add `registrarCierre(mesAnio, adminUid, snapshot, ganancias[])` to `services/admin.actions.service.js` — consolidated audit write to `Cierres_contables` + `AdminActions` (merge, idempotent).

## Phase 4: Orchestrator

- [x] 4.1 Create `services/monthlyClosing.orchestrator.js` — `cerrarMes(mesAnio, adminUid)` with 4-stage pipeline: ① `processPendingOrders()` ② `contabilidadService.generarHistoricoMensual()` ③ iterate snapshot categories → `gananciasService.cerrarGananciasPorCategoria()` ④ `adminActionsService.registrarCierre()`. Error catch with stage logging, idempotent re-run.

## Phase 5: Route Wiring

- [x] 5.1 Modify `routes/admin.contabilidad.routes.js` — replace `cierreMensual.cerrarMesContable` with `orchestrator.cerrarMes(mesAnio, req.admin.uid)`. Same response shape.
- [x] 5.2 Modify `routes/ventas.js` — delete `/calcular-ganancias` handler (lines 219–231) and its inline `require("../services/ganancias.service")`.

## Phase 6: Cleanup

- [x] 6.1 Delete `services/cierreMensual.service.js`.
- [x] 6.2 Grep project for `cierreMensual` references — confirm zero remaining imports.

## Phase 7: Testing

- [ ] 7.1 Write `tests/unit/repositories/contable.repository.test.ts` — 9 method tests following `admin.repository.test.ts` pattern (mock `firestore.js` via `Module._cache`).
- [ ] 7.2 Write `tests/unit/services/monthlyClosing.orchestrator.test.ts` — pipeline ordering, error propagation, idempotency, missing `mesAnio` guard (mock all 3 services + `processPendingOrders`).
- [ ] 7.3 Write `tests/unit/services/ganancias.service.test.ts` — refactored calc with `contableRepo` mocks; uniform Miel validation throws; non-Miel throws on missing costos_variables.
- [ ] 7.4 Run full test suite — confirm all existing tests pass with zero regressions.
