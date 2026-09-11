# Tasks: Fix Test Suite

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~120–180 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Whole change: foundation, migrations, contract fixes, verification | Single PR | `npx vitest run` from repo root | `npm test` in `backend/` (counts must match root) | `git checkout -- backend/tests backend/src/lib/firestore.js vitest.config.js` + `rm -f backend/tests/helpers/paths.ts` |

## Phase 1: Foundation

- [x] 1.1 Create `backend/tests/helpers/paths.ts`: export `getBackendRoot()` via `import.meta.url` → `path.resolve(__here, "../..")` (mirror design contract §Interfaces)
- [x] 1.2 Create root `vitest.config.js`: `root: 'backend'`, `include: ['tests/**/*.test.*']`, `globals: true`, `environment: 'node'` (mirror `backend/vitest.config.js`)
- [x] 1.3 Modify `backend/src/lib/firestore.js`: wrap `require("../secrets/serviceAccountKey.json")` in try/catch with `serviceAccount = null` fallback; when absent initialize via `admin.credential.applicationDefault()` + `process.env.FIREBASE_PROJECT_ID || "test-project"`; key-present path byte-identical

## Phase 2: Mechanical path migration (helper swap only)

- [x] 2.1 Replace `process.cwd()` with `getBackendRoot()` in `backend/tests/unit/repositories/{contabilidad,contable,productos,ventas}.repository.test.ts` (4 files)
- [x] 2.2 Same swap in `backend/tests/unit/services/contabilidad.test.ts`
- [x] 2.3 Same swap in `backend/tests/unit/job/jobContable.rules.test.ts`
- [x] 2.4 Same swap in `backend/tests/integration/ventas.test.ts`

## Phase 3: Contract-drift corrections

- [x] 3.1 `backend/tests/unit/services/ganancias.service.test.ts` (RULE-1): assert `inversionTotal` 5015 / `gananciaNeta` 4985 (non-Miel) and 6075 / 8925 (Miel); also migrate path derivation
- [x] 3.2 `backend/tests/unit/repositories/admin.repository.test.ts` (RULE-2): rebuild mock chain to `collection("Usuarios").doc("Usuarios").collection("Admin")` shape; keep existing `where` chain; also migrate path derivation
- [x] 3.3 `backend/tests/unit/services/monthlyClosing.orchestrator.test.ts` (RULE-3): assert `generarHistoricoMensual("Enero 2026", adminMock)` with `adminMock = { uid: "admin-1", nombre: "Admin Test" }`; also migrate path derivation

## Phase 4: jobContable.test.ts targeted fixes

- [x] 4.1 `backend/tests/integration/jobContable.test.ts`: change import depth `../../../src/jobs/jobContableMensual` → `../../src/jobs/jobContableMensual`
- [x] 4.2 Same file: replace cwd-derived `FIREBASE_FIRESTORE_PATH` with `require.resolve("firebase-admin/firestore")`; migrate all remaining path constants to `getBackendRoot()`

## Phase 5: Verification

- [x] 5.1 Run `npx vitest run` from repo root → 0 failed, 0 skipped (spec scenarios "Repo-root full pass")
- [x] 5.2 Run `npm test` from `backend/` → 0 failed, 0 skipped; total/passing counts identical to root (spec "Both modes agree")
- [x] 5.3 Secrets proof: temporarily move `backend/src/secrets/serviceAccountKey.json`, rerun root suite → no `MODULE_NOT_FOUND`; restore file; confirm `git ls-files backend/src/secrets` returns nothing