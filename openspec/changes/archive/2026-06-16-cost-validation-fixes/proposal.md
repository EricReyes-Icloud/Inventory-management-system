# Proposal: cost-validation-fixes

## Intent

Fix two critical bugs in the monthly closing process: 
1. Cost validation incorrectly allows zero values for costos_fijos and costos_variables, which should be rejected as they represent real costs that must be > 0
2. AdminActions logs admin UID instead of human-readable admin name, losing audit trail usability

## Scope

### In Scope
- Fix cost validation in `backend/src/services/ganancias.service.js` to reject zero values (change `v < 0` to `v <= 0`)
- Fix admin name logging in `backend/src/routes/admin.contabilidad.routes.js` to pass full admin object instead of just UID
- Update `backend/src/services/monthlyClosing.orchestrator.js` to extract and store admin name from the admin object

### Out of Scope
- Any changes to frontend components
- Changes to Firestore data structure or security rules
- Additional validation beyond fixing the zero-value issue
- Refactoring of existing service architectures

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `ganancias.service`: Fix cost validation logic to properly reject zero costs
- `admin.contabilidad.routes`: Pass complete admin data instead of just UID
- `monthly-closing-orchestrator`: Extract and use admin name for audit logging

## Approach

1. For cost validation: Modify the validation loops in `ganancias.service.js` to check `v <= 0` instead of `v < 0` for both fixed and variable costs
2. For admin logging: Update the route to pass `req.admin` (containing `.nombre`) instead of `req.admin.uid` to the orchestrator
3. Update the orchestrator to accept the full admin object and extract the nombre for storage in AdminActions

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/services/ganancias.service.js` | Modified | Fix cost validation to reject zero values |
| `backend/src/routes/admin.contabilidad.routes.js` | Modified | Pass full admin object instead of just UID |
| `backend/src/services/monthlyClosing.orchestrator.js` | Modified | Extract and store admin name for audit |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Breaking existing valid cost calculations | Low | Changes only affect validation threshold (0 → <=0), valid positive costs unchanged |
| Admin name not available in some contexts | Low | AdminAuth middleware already validates and attaches admin data to request |
| Orchestrator interface change affecting other callers | Low | Orchestrator is only used by this specific route |

## Rollback Plan

Revert the three commits:
1. Change in ganancias.service.js validation logic
2. Change in admin.contabilidad.routes.js parameter passing
3. Change in monthlyClosing.orchestrator.js parameter handling and nombre extraction

## Dependencies

None - these are purely internal code fixes with no external dependencies.

## Success Criteria

- [ ] Cost validation properly rejects zero values for costos_fijos and costos_variables
- [ ] AdminActions stores human-readable admin name instead of UID
- [ ] All existing tests continue to pass
- [ ] Manual testing confirms fixes work for both Miel and non-Miel categories