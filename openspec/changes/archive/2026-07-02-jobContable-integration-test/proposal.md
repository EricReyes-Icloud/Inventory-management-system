# Proposal: jobContable-integration-test

## Intent

Create integration tests for `jobContableMensual.js` that verify the real interaction between `processPendingOrders()`, `ventas.repository.js`, and `contabilidad.repository.js` with a mocked Firestore layer. Unit tests already cover business rules with fully mocked dependencies; this closes the gap by testing the actual composition between job + repositories + Firestore.

## Scope

### In Scope
- Integration tests in `backend/tests/integration/jobContable.test.ts`
- Mock only `db` (firestore.js) and `firebase-admin/firestore` (FieldValue) via `Module._cache`
- Use real `ventas.repository.js`, `contabilidad.repository.js`, and utility modules
- Test `processPendingOrders()` directly (not the HTTP endpoint)
- Coverage: happy path, edge cases (empty clients/months/pedidos), repository errors with real data

### Out of Scope
- HTTP endpoint `POST /api/admin/job-contable` (trivial wrapper, no logic to test)
- Modifications to production code or existing tests
- Unit tests for `jobContableMensual.js` (already covered by `jobContable.rules.test.ts`)

## Capabilities

### New Capabilities
None — test-only change, no new business capabilities.

### Modified Capabilities
None — existing specs remain unchanged.

## Approach

Follow the established `Module._cache` pattern from `ventas.test.ts`:

1. Mock `src/lib/firestore.js` in `Module._cache` with a chainable mock that covers `collection()`, `doc()`, `batch()`, and all Firestore query methods (`where()`, `get()`, `limit()`).
2. Mock `firebase-admin/firestore` in `Module._cache` to control `FieldValue.increment` and `FieldValue.serverTimestamp` — required by `buildOperacionesContables()`.
3. Clear `Module._cache` entries for `ventas.repository.js` and `contabilidad.repository.js` so they re-require with mocked Firestore.
4. Dynamically import `jobContableMensual.js` after injection, call `processPendingOrders()`.
5. Assert against the mock Firestore methods (batch.set, batch.update, batch.commit, collection.get, etc.).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/tests/integration/jobContable.test.ts` | Modified | Currently empty; filled with integration tests |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Complex Firestore mock chain | Medium | Build incrementally, test each query path against `ventas.repository.js` behavior |
| Module._cache state leaking | Low | Follow `beforeEach`/`afterEach` cleanup pattern from `ventas.test.ts` |
| `obtenerMesAnio` depends on real date | Low | Mock `fechas.js` in `Module._cache` to control month/year |

## Rollback Plan

Revert the single modified file: `git checkout -- backend/tests/integration/jobContable.test.ts`

## Dependencies

- Existing test patterns from `ventas.test.ts` (Module._cache, inline Express)
- Existing `contabilidad.repository.test.ts` for FieldValue mock pattern

## Success Criteria

- [ ] All integration tests pass with `npm test` (or `npx vitest run`)
- [ ] Zero regressions in existing tests
- [ ] Each integration test proves a real interaction between job + repos + Firestore mock
