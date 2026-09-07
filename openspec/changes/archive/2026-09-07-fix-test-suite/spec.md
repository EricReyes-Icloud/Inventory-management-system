# Fix Test Suite — Specification

## Purpose

Correct the backend test suite so it passes from both repo root and backend cwd. Production code is NOT changed; tests are corrected to match existing business rules. A secrets bootstrap enables CI without the real service account key.

---

## Requirements

### Requirement: Test-suite green from both launch directories

The test suite MUST produce 0 failures and 0 skipped tests from repo root (`npx vitest run`) and backend cwd (`npm test`).

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Repo-root full pass | repo cloned, `npm install` done | `npx vitest run` from repo root | 0 failed, 0 skipped |
| Backend-cwd full pass | repo cloned, `npm install` done | `npm test` from `backend/` | 0 failed, 0 skipped |
| Both modes agree | full run from root and from backend | both complete | total and passing counts identical |

### Requirement: Shared path helper

A shared helper at `backend/tests/helpers/paths.ts` MUST export `getBackendRoot()` using `import.meta.url` path derivation, replacing `process.cwd()` in all 11 affected test files.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Helper exports backend root | helper file exists | imported by any test | `getBackendRoot()` resolves to `backend/` absolute path |
| Mock keys launch-independent | test uses helper for `Module._cache` keys | run from repo root or backend | mock keys resolve identically |
| flujoCompleto unaffected | existing `flujoCompleto.test.ts` uses `import.meta.url` | helper introduced | continues to pass from repo root |

### Requirement: Root vitest config

A root `vitest.config.js` MUST produce identical behavior to `backend/vitest.config.js`.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Root config delegates correctly | `vitest.config.js` at repo root | vitest discovers tests | all `backend/tests/` files found; globals and node env match backend config |

### Requirement: jobContable.test.ts loads from root

`backend/tests/integration/jobContable.test.ts` MUST resolve its module graph correctly from repo root.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Import depth correct | test run from repo root | imports `jobContableMensual` | resolves to `backend/src/jobs/jobContableMensual.js` |
| FieldValue mock keyed at hoisted path | `Module._cache` keyed for FieldValue | run from repo root | key targets `backend/node_modules/firebase-admin/...` |

### Requirement: Contract-drift tests corrected (7 tests, 3 files)

Tests MUST assert production business rules. Production code is NOT modified.

| Scenario | File | Rule | Old assertion (wrong) | New assertion (correct) |
|----------|------|------|----------------------|------------------------|
| Ganancias formula non-Miel | `ganancias.service.test.ts` | RULE-1 | `inversionTotal` = 6500 | `inversionTotal` = 5015 (`fijos*cartones + variables`) |
| Ganancias net non-Miel | `ganancias.service.test.ts` | RULE-1 | `gananciaNeta` = 3500 | `gananciaNeta` = 4985 |
| Admin Firestore path | `admin.repository.test.ts` | RULE-2 | flat `collection("Admin")` | `collection("Usuarios").doc("Usuarios").collection("Admin")` |
| Orchestrator admin contract | `monthlyClosing.orchestrator.test.ts` | RULE-3 | passes uid string `"admin-1"` | passes full object `{ uid, nombre }` |

### Requirement: Secrets bootstrap

`backend/src/lib/firestore.js` MUST support running without `serviceAccountKey.json` via env-var fallback or test-only fake credential.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Missing key file does not crash | `secrets/serviceAccountKey.json` absent | test suite launched | no `MODULE_NOT_FOUND`; mocked tests pass |
| Real key never committed | fresh clone | inspecting git-tracked files | `.gitignore` covers `secrets/` (already true) |
| Env-var fallback | key absent, env vars set | `firestore.js` required | Firebase initializes with env credentials |

---

## Key Learnings

1. The `import.meta.url` pattern from `flujoCompleto.test.ts` is the proven approach for launch-independent mock keying.
2. Ganancias non-Miel formula: `fijos * cartones + variables` (NOT `(fijos + variables) * cartones`).
3. Admin Firestore path is hierarchical: `Usuarios/Usuarios/Admin` with `.doc()` step.
4. Orchestrator passes full `{ uid, nombre }` object, not uid string.
5. `.gitignore` already covers `secrets/` — the risk is CI without the key file, not a leak.
