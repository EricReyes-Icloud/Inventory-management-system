# Tasks: cost-validation-fixes

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~15–25 (additions + deletions) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Core Validation Fixes

- [x] 1.1 `backend/src/services/ganancias.service.js` L70: change `v < 0` to `v <= 0` for costos_fijos validation
- [x] 1.2 `backend/src/services/ganancias.service.js` L135: change `v < 0` to `v <= 0` for costos_variables (non-Miel) validation
- [x] 1.3 `backend/src/services/ganancias.service.js` L110–113: convert Miel variable cost silent skip (`typeof v === "number" && v > 0`) to explicit throw on `typeof v !== "number" || v <= 0`

## Phase 2: Admin Audit Trail

- [x] 2.1 `backend/src/routes/admin.contabilidad.routes.js` L90: pass `req.admin` (full object) instead of `req.admin.uid` to orchestrator
- [x] 2.2 `backend/src/services/monthlyClosing.orchestrator.js` L25: change signature from `(mesAnio, adminUid)` to `(mesAnio, admin)`; L30: update log to `admin.nombre \|\| admin.uid`; L50: pass `admin.uid` to `generarHistoricoMensual`; L83: pass `admin` (full object) to `registrarCierre`
- [x] 2.3 `backend/src/services/admin.actions.service.js` L153: change `registrarCierre(mesAnio, adminUid, ...)` to `(mesAnio, admin, ...)`, use `admin.uid` for `Cierres_contables.ejecutadoPor` (L161) and `admin.nombre \|\| admin.uid` for `AdminActions.usuario` (L174), also update L182 log

## Phase 3: Verification

- [x] 3.1 Run full test suite — 78/82 pass, 4 pre-existing failures (empty test suites + admin.repository mock)
- [x] 3.2 All 8 ganancias.service tests pass — validation changes verified
- [x] 3.3 All 7 orchestrator tests pass — admin nombre threading verified
