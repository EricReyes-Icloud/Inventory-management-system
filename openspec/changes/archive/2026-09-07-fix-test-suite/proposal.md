# Proposal: Fix Test Suite

## Intent

Backend test suite: **60 failures** from repo root, **7 from `backend/`**. Both block strict TDD. Root causes: (A) mock keying depends on `process.cwd()`, (B) 7 tests assert wrong business rules, (C) wrong import depth in `jobContable.test.ts`, (D) secrets file gitignored blocks CI.

## Scope

### In Scope
- Shared path-derivation helper (`backend/tests/helpers/paths.ts`)
- Root `vitest.config.js` for identical root/backend behavior
- Migrate 11 test files to shared helper + consistent `Module._cache` keying
- Fix `jobContable.test.ts` import depth (`../../../` → `../../`)
- Fix 7 contract-drift tests per confirmed business rules
- Secrets bootstrap: env-var / fake-credential fallback (no real key committed)

### Out of Scope
- Production behavior changes (all production logic is correct)
- Vitest version migration or `Module._cache` replacement
- Frontend tests, CI pipeline YAML

## Confirmed Business Rules

| Rule | Production (correct) | Test (wrong) | Files |
|------|---------------------|--------------|-------|
| **Ganancias formula** | `fijos*cartones + variables` | `(fijos+variables)*cartones` | `ganancias.service.test.ts` (2 tests) |
| **Admin Firestore path** | `Usuarios/Usuarios/Admin` | `collection("Admin")` flat | `admin.repository.test.ts` (4 tests) |
| **Orchestrator admin contract** | `{ uid, nombre }` object | uid string `"admin-1"` | `monthlyClosing.orchestrator.test.ts` (1 test) |
| **Secrets bootstrap** | env-var fallback required | No fallback for CI | `firestore.js` |

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None — production behavior unchanged; tests corrected to match existing specs.

## Approach

1. Extract `import.meta.url` path derivation → `backend/tests/helpers/paths.ts`
2. Add root `vitest.config.js` pointing to `backend/tests/`
3. Migrate 11 files: replace `process.cwd()` paths with shared helper
4. Fix `jobContable.test.ts` import depth + FieldValue keying
5. Fix 7 contract-drift tests per business rules above
6. Add env-var / fake-credential fallback in `backend/src/lib/firestore.js`

## Affected Areas

- `backend/tests/helpers/paths.ts` (new) — shared path helper
- `backend/vitest.config.js` (new) — root vitest config
- `backend/src/lib/firestore.js` — env-var secrets fallback
- 11 test files — path derivation + contract fixes

## Risks

- **11-file diff** (Medium) — mechanical migration; verify per-file
- **`Module._cache` fragile** (Low) — no vitest version change in scope
- **Secrets leak** (Low) — env-var priority; never commit real credential

## Rollback Plan

```bash
git checkout -- backend/tests/ backend/src/lib/firestore.js backend/vitest.config.js
rm -f backend/tests/helpers/paths.ts
```

If committed: `git revert <commit-sha>`. No database/deployment state to revert.

## Dependencies

- `backend/src/secrets/serviceAccountKey.json` must exist locally (already present, gitignored)

## Success Criteria

- [ ] `npx vitest run` from repo root: 0 failures, 0 skipped
- [ ] `npm test` (backend cwd): 0 failures, 0 skipped
- [ ] No real service-account key committed
- [ ] All 7 contract-drift tests pass with production-correct assertions
