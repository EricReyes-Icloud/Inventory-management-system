# Proposal: Flujo Completo Integration Test

## Intent

Verify the complete monthly cycle of "Condimentos El Colibrí" — sales → inventory → accounting → snapshot → earnings → closing audit — end-to-end through the orchestrator's 4-stage pipeline with mocked Firestore. This catches integration bugs between services/repos that individual tests miss.

## Scope

### In Scope
- Integration test at `backend/tests/flow/flujoCompleto.test.ts`
- Mock only `firestore.js` + `firebase-admin/firestore` via `Module._cache` (same pattern as `jobContable-integration-test`)
- Real repositories, services, job, and orchestrator
- Test `monthlyClosing.orchestrator.cerrarMes()` through all 4 stages:
  - Stage 1: `processPendingOrders()` — process pending paid orders into accounting records
  - Stage 2: `generarHistoricoMensual()` — snapshot from Total Productos / Cartones Vendidos
  - Stage 3: `cerrarGananciasPorCategoria()` — per-category earnings from Historico_Mensual + costs
  - Stage 4: `registrarCierre()` — audit trail to Cierres_contables / AdminActions
- Happy path: full cycle with multiple categories (e.g., Clavo + Miel)
- Edge cases: no pending orders, already-closed month, single category

### Out of Scope
- HTTP route testing (covered by `ventas-integration-test`)
- Individual service/repository unit tests (already exist as separate specs)
- Firestore emulator (mocks only, same strategy as existing integration tests)

## Capabilities

### New Capabilities
- `flujo-completo-integration-test`: Integration tests for the complete monthly accounting cycle — orchestrator pipeline end-to-end

### Modified Capabilities
- None (pure behavioral test artifact, no spec-level requirements change)

## Approach

Follow the same `Module._cache` mock injection pattern from `jobContable-integration-test`:
1. Mock `firestore.js` to return a chainable `db` with `collection()`, `doc()`, and `batch()` stubs
2. Mock `firebase-admin/firestore` for `FieldValue.increment` sentinels
3. Each test configures a Firestore scenario (collections, documents, subcollections) matching the pre-closing state
4. Call `cerrarMes(mesAnio, admin)` and assert on batch interactions, return values, and side-effect calls

The mock must support ALL collections the pipeline touches: Ventas, Total Productos, Cartones_vendidos, Historico_Mensual, Invertir, Ganancias, Cierres_contables, AdminActions.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/tests/flow/flujoCompleto.test.ts` | New | Integration test for the complete monthly cycle |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Mock complexity (8+ collections) | Med | Follow jobContable pattern — nested factory functions with terminal reference capture |
| `contabilidad.service.generarHistoricoMensual` guards block re-run | Low | Spec explicitly tests idempotency via orchestrator re-run semantics |

## Rollback Plan

Delete `backend/tests/flow/flujoCompleto.test.ts`. No production code is modified.

## Dependencies

- All source files under `backend/src/services/`, `backend/src/repositories/`, `backend/src/jobs/`
- Vitest v4 via `npx vitest run`

## Success Criteria

- [ ] `npx vitest run backend/tests/flow/flujoCompleto.test.ts` passes for all scenarios
- [ ] Happy path exercises all 4 orchestrator stages sequentially
- [ ] At least one edge case (empty pending orders, already-closed month) covered
- [ ] Mock captures terminal batch calls (set, update, commit) for assertion
