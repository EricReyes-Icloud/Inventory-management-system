# Proposal: contabilidad-service-test

## Intent
Create unit tests for contabilidad.service.js to ensure proper behavior of generarHistoricoMensual and delegated methods. This addresses the need for test coverage on the thin orchestration layer that coordinates monthly inventory snapshots.

## Scope

### In Scope
- Unit tests for contabilidad.service.js only
- Focus on generarHistoricoMensual method (non-trivial logic)
- Test delegation of obtenerCategoria and buildOperacionesContables to repository
- Validate export surface exactly matches 3 exports
- Test admin validation (uid and nombre required)
- Test duplicate mesAnio rejection
- Test repository error propagation
- Test empty data scenarios
- Test categories missing SKUs (default to 0)

### Out of Scope
- Integration tests with Firestore
- Tests for contabilidad.repository (covered elsewhere)
- Tests for monthlyClosing.orchestrator (consumer)
- HTTP route tests
- Changes to production code (test-only change)

## Capabilities

### New Capabilities
None

### Modified Capabilities
None

## Approach
Follow existing test pattern from ganancias.service.test.ts using Vitest and Module._cache mocking. Mock contabilidad.repository dependency and test generarHistoricoMensual with various scenarios: happy path, empty data, missing SKUs, admin validation, duplicate prevention, and error propagation. Verify exact export counts and delegation behavior.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| openspec/changes/contabilidad-service-test/proposal.md | New | SDD proposal document |
| backend/tests/unit/services/contabilidad.service.test.js | New | Unit test file following existing patterns |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Mocking complexity with Module._cache | Medium | Follow existing ganancias.service.test.ts pattern exactly |
| Missing edge cases in generarHistoricoMensual | Low | Comprehensive scenario coverage per scope |
| Test fragility due to implementation changes | Low | Focus on behavior, not implementation |

## Rollback Plan
Delete the test file openspec/changes/contabilidad-service-test/proposal.md and backend/tests/unit/services/contabilidad.service.test.js. No production code changes to rollback.

## Success Criteria
- [ ] Test file created following existing patterns
- [ ] Tests cover all specified scenarios for generarHistoricoMensual
- [ ] Export validation tests pass (exactly 3 exports)
- [ ] Delegation verification for obtenerCategoria and buildOperacionesContables
- [ ] All tests pass with Vitest
- [ ] No production code modified

## Next Step
Ready for specs (sdd-spec) to create detailed test specifications.