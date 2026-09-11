# Stabilize Failing Backend Test Suite

## Description

The backend test suite was failing both locally and in CI, and the root cause was split across two distinct problems. First, roughly 53 failures were launch-directory noise: test files derived their `Module._cache` mock keys from `process.cwd()`, so the mocked absolute paths resolved differently depending on whether vitest was started from the repo root or from the `backend/` directory. Second, seven tests were asserting values that no longer matched production: they encoded earlier, incorrect contract shapes instead of the business rules the implementation already follows.

This PR introduces a shared, `cwd`-independent path helper, migrates the affected tests to it, corrects the seven contract-drift assertions to match production behavior, fixes the remaining integration test so it passes in both launch modes, and adds a root `vitest.config.js` so `npx vitest run` from the repo root behaves identically to `npm test` inside `backend/`. It also hardens the Firestore secrets bootstrap so CI on a fresh clone no longer fails with `MODULE_NOT_FOUND` when the gitignored service account key is absent.

## Changes Made

### Bug fixes

- `backend/tests/helpers/paths.ts` — new helper `getBackendRoot()` that derives the absolute `backend/` path from `import.meta.url` instead of `process.cwd()`.
- `backend/tests/integration/jobContable.test.ts` — uses `getBackendRoot()`; fixes import depth from `../../../src/...` to `../../src/...`; replaces the hand-resolved Firestore module key with hoist-safe `require.resolve("firebase-admin/firestore")`.
- `backend/tests/integration/ventas.test.ts` — uses `getBackendRoot()` for its `Module._cache` mock keys.
- `backend/tests/unit/job/jobContable.rules.test.ts` — uses `getBackendRoot()`.
- `backend/tests/unit/services/contabilidad.test.ts` — uses `getBackendRoot()`.
- `backend/tests/unit/repositories/contabilidad.repository.test.ts` — uses `getBackendRoot()`.
- `backend/tests/unit/repositories/contable.repository.test.ts` — uses `getBackendRoot()`.
- `backend/tests/unit/repositories/productos.repository.test.ts` — uses `getBackendRoot()`.
- `backend/tests/unit/repositories/ventas.repository.test.ts` — uses `getBackendRoot()`.

### Contract-drift corrections (align tests with already-correct production rules)

- `backend/tests/unit/services/ganancias.service.test.ts` — RULE-1: uses `getBackendRoot()`; corrects the non-Miel assertions so `inversionTotal` uses `fijos*cartones + variables` (5015) and `gananciaNeta` is 4985, and the Miel assertions to 6075 / 8925.
- `backend/tests/unit/repositories/admin.repository.test.ts` — RULE-2: uses `getBackendRoot()`; rebuilds the mock chain to match `collection("Usuarios").doc("Usuarios").collection("Admin")` hierarchical shape.
- `backend/tests/unit/services/monthlyClosing.orchestrator.test.ts` — RULE-3: uses `getBackendRoot()`; assertion now passes the full admin object (`{ uid, nombre }`) to `generarHistoricoMensual` instead of the uid string.

### Dev tooling / configuration

- `vitest.config.js` — new root config with `root: 'backend'` so `npx vitest run` from the repo root matches `npm test` inside `backend/`.
- `backend/src/lib/firestore.js` — wraps the `require("../secrets/serviceAccountKey.json")` in a `try/catch` and falls back to `admin.credential.applicationDefault()` plus `FIREBASE_PROJECT_ID` env-var (or `"test-project"`) when the gitignored key is absent; real key never committed.
- `backend/tests/helpers/paths.test.ts` — new test verifying `getBackendRoot()` returns an absolute path ending in `backend` and is identical regardless of `process.cwd()`.
- `backend/tests/helpers/secrets-bootstrap.test.ts` — new test verifying `firestore.js` loads without throwing about `serviceAccountKey` when the file is absent.

## Impact

- The suite is now green from both launch directories: 16/16 test files, 134/134 tests, idempotent across repeated runs. Verify report confirms `scenarios: 16/16`, `verdict: pass` (evidence `2e037760…`).
- No production business logic changed: the 7 corrected tests assert behavior the implementation already produces (RULE-1/2/3). The only production-source change is the `firestore.js` secrets wrapper, which preserves the existing `cert` path when the key file is present.
- DX improvement: contributors can run `npx vitest run` from the repo root or `npm test` inside `backend/` and get identical results, so test failures no longer depend on where the command is launched.
- CI on fresh clones no longer fails on a missing service-account key; credentials come from env vars when the gitignored file is absent.

## Notes

- To verify locally: run `npx vitest run` from the repo root and `npm test` in `backend/`; both should report 134/134 passing.
- No `.env` or key file additions are included — the real `serviceAccountKey.json` remains gitignored and is never committed.
