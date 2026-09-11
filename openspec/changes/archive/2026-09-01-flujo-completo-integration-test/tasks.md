# Tasks: Flujo Completo Integration Test

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~500-650 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Mock infrastructure + happy paths (Phases 1-2) → PR 2: Edge + error cases + verification (Phases 3-5) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Mock infrastructure + 2 happy paths | PR 1 | Base = main. Tests FLUJO-FLOW-001 + 002. Verifies the factory works end-to-end. |
| 2 | Edge cases + error cases + verification | PR 2 | Base = main. Tests FLUJO-EDGE-001/002/003 + FLUJO-ERR-001/002/003/004. Independent of PR 1 — just adds scenarios. |

## Phase 1: Mock Infrastructure

- [x] 1.1 Create `buildMockStore(scenario)` factory supporting all collections: ventas, totalProductos, cartonesVendidos, historicoMensual, invertir
- [x] 1.2 Create `createMockDb()` returning { mockDb, refs } with dual access patterns: `db.collection("X")` + `db.doc("X/Y")`
- [x] 1.3 Set up `Module._cache` mock injection in `describe()` scope for `firestore.js` and `firebase-admin/firestore`

## Phase 2: Happy Path Scenarios

- [x] 2.1 Write FLUJO-FLOW-001 — Multi-category (Clavo + Miel) full pipeline, assert 4 stages and `ganancias.length === 2`
- [x] 2.2 Write FLUJO-FLOW-002 — Single category (Clavo), assert `ganancias.length === 1` and `gananciaNeta` is number

## Phase 3: Edge Case Scenarios

- [x] 3.1 Write FLUJO-EDGE-001 — No pending orders, pre-populated Total Productos/Cartones_vendidos, stages 2-4 execute
- [x] 3.2 Write FLUJO-EDGE-002 — Already-closed month (Historico_Mensual exists), stage 2 throws, stages 3-4 skip
- [x] 3.3 Write FLUJO-EDGE-003 — Empty Productos/Cartones subcollections, snapshot with zero categories

## Phase 4: Error Case Scenarios

- [x] 4.1 Write FLUJO-ERR-001 — Empty mesAnio string, immediate throw, no stages execute
- [x] 4.2 Write FLUJO-ERR-002 — Admin without uid, stage 2 throws
- [x] 4.3 Write FLUJO-ERR-003 — Missing Invertir/{categoria} fixed costs, stage 3 throws
- [x] 4.4 Write FLUJO-ERR-004 — Missing costos_variables for non-Miel category, stage 3 throws

## Phase 5: Verification

- [x] 5.1 Run `npx vitest run backend/tests/flow/flujoCompleto.test.ts` — confirm 9/9 passing
- [x] 5.2 Run `npm run test:run` — verify no regressions in existing tests
