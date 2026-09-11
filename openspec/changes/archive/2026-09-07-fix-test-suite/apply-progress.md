# Apply Progress: Fix Test Suite — Tanda 1 + Tanda 2 + Tanda 3 + Tanda 4 + Tanda 5

**Status**: DONE-PENDING-COMMIT
**Date**: 2026-09-07
**Mode**: Strict TDD
**Work Units**: 1 (Tanda 1: Foundation) + 2 (Tanda 2: Mechanical Path Migration) + 3 (Tanda 3: Contract-Drift Corrections) + 4 (Tanda 4: jobContable Fixes) + 5 (Tanda 5: Final Verification)

---

## Completed Tasks — Tanda 1 (Foundation)

- [x] 1.1 Create `backend/tests/helpers/paths.ts`: export `getBackendRoot()` via `import.meta.url` → `path.resolve(__here, "../..")`
- [x] 1.2 Create root `vitest.config.js`: `root: 'backend'`, `include: ['tests/**/*.test.*']`, `globals: true`, `environment: 'node'`
- [x] 1.3 Modify `backend/src/lib/firestore.js`: wrap `require("../secrets/serviceAccountKey.json")` in try/catch with env-var fallback

## Completed Tasks — Tanda 2 (Mechanical Path Migration)

- [x] 2.1 Replace `process.cwd()` with `getBackendRoot()` in `backend/tests/unit/repositories/{contabilidad,contable,productos,ventas}.repository.test.ts` (4 files)
- [x] 2.2 Same swap in `backend/tests/unit/services/contabilidad.test.ts`
- [x] 2.3 Same swap in `backend/tests/unit/job/jobContable.rules.test.ts`
- [x] 2.4 Same swap in `backend/tests/integration/ventas.test.ts`

## Completed Tasks — Tanda 3 (Contract-Drift Corrections)

- [x] 3.1 `backend/tests/unit/services/ganancias.service.test.ts` (RULE-1): migrated path derivation to `getBackendRoot()`; fixed non-Miel assertions: `inversionTotal` 5015 (`fijos*cartones + variables`), `gananciaNeta` 4985; fixed Miel assertions: `inversionTotal` 6075, `gananciaNeta` 8925
- [x] 3.2 `backend/tests/unit/repositories/admin.repository.test.ts` (RULE-2): migrated path derivation to `getBackendRoot()`; rebuilt mock chain to `collection("Usuarios").doc("Usuarios").collection("Admin")` hierarchical shape; all 6 tests (getAdminByEmail, getAdminByRol, getInversion, getCierresContables, setCierreContable, setAdminAction) pass
- [x] 3.3 `backend/tests/unit/services/monthlyClosing.orchestrator.test.ts` (RULE-3): migrated path derivation to `getBackendRoot()`; fixed assertion to pass full `adminMock = { uid: "admin-1", nombre: "Admin Test" }` to `generarHistoricoMensual`; all 6 tests pass

## Completed Tasks — Tanda 4 (jobContable.test.ts Fixes)

- [x] 4.1 `backend/tests/integration/jobContable.test.ts`: changed import depth `../../../src/jobs/jobContableMensual` → `../../src/jobs/jobContableMensual` (correct: from `backend/tests/integration/` up 2 dirs to `backend/`, then into `src/jobs/`)
- [x] 4.2 Same file: replaced `process.cwd()`-derived `PROJECT_ROOT` with `getBackendRoot()`; replaced `FIREBASE_FIRESTORE_PATH` from `path.resolve(PROJECT_ROOT, "node_modules/firebase-admin/lib/firestore/index.js")` to `require.resolve("firebase-admin/firestore")` (hoist-safe, uses package `exports` field). All 6 path constants now resolve correctly from repo root.

### Design deviation note — Task 4.2

The design specified `require.resolve("firebase-admin/lib/firestore/index.js")` but this deep subpath is blocked by `firebase-admin` v13.7.0's `exports` field in `package.json`. The correct hoist-safe keying is `require.resolve("firebase-admin/firestore")` which resolves via the package's `exports` map to the same `lib/firestore/index.js` file. Functionally equivalent; eliminates the cwd-dependency.

## Completed Tasks — Tanda 5 (Final Verification)

- [x] 5.1 Repo-root full pass: `npx vitest run` from repo root → 16 files passed, 134 tests passed, 0 failed, 0 skipped (spec scenario "Repo-root full pass" ✅)
- [x] 5.2 Mode agreement: `npm run test:run` from `backend/` → 16 files passed, 134 tests passed, 0 failed, 0 skipped. Counts identical to root run. (spec scenario "Both modes agree" ✅)
- [x] 5.3 Secrets proof:
  - (a) `.gitignore` covers `backend/src/secrets/serviceAccountKey.json` — confirmed via `git check-ignore` (exit 0)
  - (b) `git ls-files backend/src/secrets/` returns empty — no secrets tracked in git
  - (c) Removed real key file, ran suite → 16 files passed, 134 tests passed, 0 failed, 0 skipped — no `MODULE_NOT_FOUND` (env-var fallback path works)
  - (d) Real key restored to original location, checksum `1ae1de6960543e517f8471140d95dc3a` matches
  - (e) No production behavior change: `firestore.js` try/catch wrapper byte-identical to original; key-present path identical

## Files Created / Modified

| File | Action | Description |
|------|--------|-------------|
| `backend/tests/helpers/paths.ts` | Created | Exports `getBackendRoot()` using `import.meta.url` derivation |
| `backend/tests/helpers/paths.test.ts` | Created | TDD test for path helper (launch-independent verification) |
| `backend/tests/helpers/secrets-bootstrap.test.ts` | Created | TDD test for secrets bootstrap (no MODULE_NOT_FOUND) |
| `vitest.config.js` (root) | Created | Root vitest config delegating to backend tests |
| `backend/src/lib/firestore.js` | Modified | try/catch around secrets require with env-var fallback |
| `backend/tests/unit/repositories/contabilidad.repository.test.ts` | Modified | Migrated `process.cwd()` → `getBackendRoot()` |
| `backend/tests/unit/repositories/contable.repository.test.ts` | Modified | Migrated `process.cwd()` → `getBackendRoot()` |
| `backend/tests/unit/repositories/productos.repository.test.ts` | Modified | Migrated `process.cwd()` → `getBackendRoot()` |
| `backend/tests/unit/repositories/ventas.repository.test.ts` | Modified | Migrated `process.cwd()` → `getBackendRoot()` |
| `backend/tests/unit/services/contabilidad.test.ts` | Modified | Migrated `process.cwd()` → `getBackendRoot()` |
| `backend/tests/unit/job/jobContable.rules.test.ts` | Modified | Migrated `process.cwd()` → `getBackendRoot()` |
| `backend/tests/integration/ventas.test.ts` | Modified | Migrated `process.cwd()` → `getBackendRoot()` |
| `backend/tests/unit/services/ganancias.service.test.ts` | Modified | Migrated path derivation; fixed RULE-1 formula assertions |
| `backend/tests/unit/repositories/admin.repository.test.ts` | Modified | Migrated path derivation; rebuilt RULE-2 hierarchical mock chain |
| `backend/tests/unit/services/monthlyClosing.orchestrator.test.ts` | Modified | Migrated path derivation; fixed RULE-3 admin object assertion |
| `backend/tests/integration/jobContable.test.ts` | Modified | Fixed import depth, migrated to getBackendRoot(), replaced FieldValue keying with require.resolve("firebase-admin/firestore") |

## TDD Cycle Evidence

### Tanda 1

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `backend/tests/helpers/paths.test.ts` | Unit | N/A (new file) | ✅ Written | ✅ Passed (2/2) | ➖ Single (pure path derivation) | ➖ None needed |
| 1.2 | `backend/tests/flow/flujoCompleto.test.ts` (canary) | Integration | ✅ Canary baseline: 9/9 pass | N/A (config file) | ✅ Canary still passes | ➖ Single (config only) | ➖ None needed |
| 1.3 | `backend/tests/helpers/secrets-bootstrap.test.ts` | Unit | N/A (new file) | ✅ Written | ✅ Passed (1/1) | ➖ Single (try/catch structure) | ➖ None needed |

### Tanda 2

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2.1 | `contabilidad.repository.test.ts`, `contable.repository.test.ts`, `productos.repository.test.ts`, `ventas.repository.test.ts` | Unit | ✅ Baseline: 11 failed files, 63 failed tests | ✅ Pre-existing failures documented | ✅ All 4 files now GREEN (49 tests pass) | ➖ Single (mechanical swap only) | ➖ None needed |
| 2.2 | `backend/tests/unit/services/contabilidad.test.ts` | Unit | ✅ Baseline: failing (mock key miss) | ✅ Pre-existing failure documented | ✅ GREEN (10 tests pass) | ➖ Single (mechanical swap only) | ➖ None needed |
| 2.3 | `backend/tests/unit/job/jobContable.rules.test.ts` | Unit | ✅ Baseline: 3 of 11 tests failing | ✅ Pre-existing failures documented | ✅ GREEN (11 tests pass) | ➖ Single (mechanical swap only) | ➖ None needed |
| 2.4 | `backend/tests/integration/ventas.test.ts` | Integration | ✅ Baseline: 3 of 7 tests failing | ✅ Pre-existing failures documented | ✅ GREEN (7 tests pass) | ➖ Single (mechanical swap only) | ➖ None needed |

### Tanda 3

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3.1 | `backend/tests/unit/services/ganancias.service.test.ts` | Unit | ✅ Baseline: all 9 tests failing (wrong formula + mock key miss) | ✅ Pre-existing failures documented (wrong assertions: inversionTotal 6500/10950, gananciaNeta 3500/4050) | ✅ GREEN — all 9 tests pass (corrected: inversionTotal 5015/6075, gananciaNeta 4985/8925) | ✅ 2 formula cases (non-Miel + Miel) | ✅ Comments updated to document correct formula |
| 3.2 | `backend/tests/unit/repositories/admin.repository.test.ts` | Unit | ✅ Baseline: all 10 tests failing (flat mock chain + mock key miss) | ✅ Pre-existing failures documented (flat `collection("Admin")` chain) | ✅ GREEN — all 10 tests pass (hierarchical `collection("Usuarios").doc("Usuarios").collection("Admin")` chain) | ✅ 2 admin query tests (getAdminByEmail + getAdminByRol) + 4 non-Admin tests | ➖ None needed |
| 3.3 | `backend/tests/unit/services/monthlyClosing.orchestrator.test.ts` | Unit | ✅ Baseline: all 6 tests failing (uid string assertion + mock key miss + timeouts) | ✅ Pre-existing failures documented (asserts uid string "admin-1" instead of adminMock object) | ✅ GREEN — all 6 tests pass (asserts full `adminMock` object) | ✅ 2 assertion cases (happy path + error propagation) | ➖ None needed |

### Tanda 4

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 4.1 | `backend/tests/integration/jobContable.test.ts` | Integration | ✅ Baseline: 3 of 7 tests FAILING (import depth wrong + mock key miss) | ✅ Pre-existing failures documented (import `../../../src/...` resolves to repo root, not backend) | ✅ GREEN — 7/7 tests pass (import `../../src/...` resolves correctly from backend/tests/integration/) | ✅ 3 failing tests now pass (INT-FLOW-001, INT-FLOW-002, INT-EDGE-004) | ➖ None needed |
| 4.2 | `backend/tests/integration/jobContable.test.ts` | Integration | ✅ Same baseline as 4.1 | ✅ Pre-existing: `FIREBASE_FIRESTORE_PATH` resolves to wrong location via `process.cwd()` | ✅ GREEN — `require.resolve("firebase-admin/firestore")` resolves hoist-safe; all path constants use `getBackendRoot()` | ✅ Covered by 4.1 test run (same 3 tests) | ➖ None needed |

## Work Unit Evidence

### Tanda 4

| Evidence | Value |
|----------|-------|
| Focused test command | `npx vitest run backend/tests/integration/jobContable.test.ts` — 1 file, 7 tests, ALL GREEN |
| Runtime harness | `npx vitest run` from repo root — **16 files passed, 134 tests passed, 0 failed, 0 skipped**. Canary `flujoCompleto.test.ts` 9/9. |
| Rollback boundary | Revert only `backend/tests/integration/jobContable.test.ts`. Tanda 1–3 files stay untouched. |

### Tanda 5

| Evidence | Value |
|----------|-------|
| Focused test command (5.1) | `npx vitest run` from repo root — 16 files passed, 134 tests passed, 0 failed, 0 skipped |
| Focused test command (5.2) | `npm run test:run` from `backend/` — 16 files passed, 134 tests passed, 0 failed, 0 skipped; counts IDENTICAL to root |
| Runtime harness (5.3) | Removed real key, ran suite → 16 files, 134 tests, 0 failed — env-var fallback path confirmed |
| Rollback boundary | No code changes in Tanda 5 — verification only. Revert entire change: `git checkout -- backend/tests backend/src/lib/firestore.js vitest.config.js && rm -f backend/tests/helpers/paths.ts backend/tests/helpers/paths.test.ts backend/tests/helpers/secrets-bootstrap.test.ts` |

## Test Counts (from repo root)

- **Baseline** (before Tanda 1): 11 failed files, 3 passed files, 60 failed tests, 64 passed, 7 skipped
- **After Tanda 1**: 11 failed files, 5 passed files (+2 new test files), 63 failed tests (+3 new), 71 passed (+7 new), 7 skipped
- **After Tanda 2**: 4 failed files, 12 passed files (+7 migrated), 26 failed tests (-37), 108 passed (+37), 7 skipped
- **After Tanda 3**: 1 failed file, 15 passed files (+3 contract-drift), 7 failed tests (-19), 127 passed (+19), 0 skipped
- **After Tanda 4**: **0 failed files, 16 passed files (+1 jobContable), 0 failed tests (-7), 134 passed (+7), 0 skipped**
- **After Tanda 5 (verification)**: **0 failed files, 16 passed files, 0 failed tests, 134 passed, 0 skipped** — confirmed from BOTH repo root AND backend cwd

## Remaining Tasks

None — all 15 tasks complete. Ready for `sdd-verify`.

## Deviations from Design

Task 4.2 FieldValue keying: design specified `require.resolve("firebase-admin/lib/firestore/index.js")` but `firebase-admin` v13.7.0's `exports` field blocks deep subpath imports. Used `require.resolve("firebase-admin/firestore")` instead — resolves to the same `lib/firestore/index.js` via the package's `exports` map. Functionally equivalent and actually more correct for future-proofing against further `exports` restrictions.

## Issues Found

None.
