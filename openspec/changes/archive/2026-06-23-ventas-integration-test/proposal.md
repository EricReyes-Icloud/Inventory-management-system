# Proposal: Integration Test for Sales Endpoint

## Intent

Create comprehensive integration tests for the `/pedido-libre` endpoint in ventas.js to validate the complete HTTP flow from request to Firestore persistence, using mocking strategies consistent with existing unit tests but at the integration layer.

## Scope

### In Scope
- Integration test file: `backend/tests/integration/ventas.test.ts`
- Test scenarios covering input validation, client lookup, product interpretation, and complete order flow
- Mocking strategy for firestore.js and brain/inturis.interpretarPedido using Module._cache pattern
- Supertest + Vitest implementation with proper describe/it organization

### Out of Scope
- Unit tests for individual repository methods (covered in unit test suite)
- End-to-end tests requiring actual Firebase emulator
- Tests for other endpoints (jobContable, flujoCompleto)
- Performance or load testing considerations

## Capabilities

### New Capabilities
- `ventas-integration-test`: Integration test coverage for the ventas libre pedido endpoint

### Modified Capabilities
- None: This is a new capability addition, not modifying existing spec behavior

## Approach

Follow the existing mocking pattern from unit tests where firestore.js is completely mocked via Module._cache to control Firestore responses. Use supertest to make actual HTTP requests to the Express app, enabling full integration testing of the route handler while maintaining control over external dependencies (Firestore and IA service).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/tests/integration/ventas.test.ts` | New | Create new integration test file |
| `backend/src/routes/ventas.js` | None | Test existing implementation without modification |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Mock complexity leading to brittle tests | Medium | Follow established patterns from unit tests, keep mocks focused |
| Missing test coverage for error paths | Low | Comprehensive scenario planning based on endpoint analysis |
| Difficulty isolating IA dependency | Low | Mock brain/inturis.interpretarPedido completely as done in unit tests |

## Rollback Plan

Since this is adding new test files without modifying production code:
1. Remove the created test file: `backend/tests/integration/ventas.test.ts`
2. No production code changes to revert

## Dependencies

- Supertest (should be available as devDependency)
- Vitest testing framework (already configured)
- Existing mocking patterns from unit tests

## Success Criteria

- [ ] Test file created with proper integration test structure
- [ ] All validation scenarios covered (missing client, missing message, empty message)
- [ ] Client lookup scenarios covered (not found, found)
- [ ] Product interpretation scenarios covered (no products, product not found)
- [ ] Happy path scenario covering complete flow with assertions on HTTP response and Firestore method calls
- [ ] Tests pass successfully when run with vitest