# Exploration: fix-test-suite

Date: 2026-09-07
Status: complete — ready for proposal

## Objective

Determine, with fresh runtime evidence, why the backend test suite fails, classify every
failure into root-cause classes, and recommend a fix order for the `sdd-propose` phase.

## How to run the suite (two competing modes — this is part of the problem)

| Invocation | cwd inside tests | Result |
|---|---|---|
| `npx vitest run` (repo root) | repo root | **60 failed / 64 passed / 7 skipped** — 11 files fail, 3 pass |
| `npm test` / `npm run test:run` (`-w backend`) | `backend/` | **7 failed / 124 passed** — 3 files fail, 11 pass |

Both were verified fresh on 2026-09-07. The 7-skipped tests are the 7 tests of
`backend/tests/integration/jobContable.test.ts`, whose suite fails to load from root
(`Cannot find module '/src/jobs/jobContableMensual'`).

## Current State

- Monorepo: `backend/` (Express 5, Firestore, CommonJS) + `frontend/` (unimplemented).
- Tests: 14 files, 131 tests total, Vitest v4.1.2, `backend/vitest.config.js` (globals, node env).
- Tests are launched from the repo root per the strict-TDD preflight; `npm test` delegates to the
  backend workspace, which changes the effective cwd to `backend/`.
- `backend/src/lib/firestore.js` exports a real Firestore db constructed from
  `backend/src/secrets/serviceAccountKey.json` (present locally, gitignored, NOT in git — 0 tracked files).
- Mock strategy: `Module._cache` injection keyed on absolute paths, used because the backend is
  CommonJS and deps are workspace-hoisted.

## Findings

### Root cause A — CONFIRMED: mock keying and import paths depend on `process.cwd()`

11 of 14 test files derive their mock-cache keys from `process.cwd()`:

```
const projectRoot = process.cwd();
const firestorePath = path.resolve(projectRoot, "src/lib/firestore.js");
```

When vitest launches from the repo root, `process.cwd()` = repo root, so the key points to
`<repo-root>/src/lib/firestore.js`, which does NOT exist. The injected mock is therefore never
consulted, the REAL firestore.js loads, and the tests hit a live Firestore client (or fail at
firebase-admin init). This explains the root-run failures of:

- `backend/tests/unit/repositories/admin.repository.test.ts` — mock miss → live-ish behavior (`expected true to be false`, `expected null not to be null`)
- `backend/tests/unit/repositories/contabilidad.repository.test.ts` — "TypeError: fn is not a function" at `firebase-namespace.js:307` (real firebase-admin)
- `backend/tests/unit/repositories/contable.repository.test.ts` — `expected null not to be null`
- `backend/tests/unit/repositories/productos.repository.test.ts` — timeouts (live calls)
- `backend/tests/unit/repositories/ventas.repository.test.ts` — `expected null not to be null`, `expected 2 but got 1`
- `backend/tests/unit/services/contabilidad.test.ts` — delegation assertions fail because mocks never applied
- `backend/tests/unit/services/ganancias.service.test.ts` — "Ventas en cero", "El histórico ya fue generado" (mock miss)
- `backend/tests/unit/services/monthlyClosing.orchestrator.test.ts` — timeouts + cross-stage leaks
- `backend/tests/unit/job/jobContable.rules.test.ts` — "called 0 times", no batch ops
- `backend/tests/integration/ventas.test.ts` — live-ish route → `404` instead of `400` (no product in real DB)

`flujoCompleto.test.ts` is the ONLY Firestore-touching file that passes from the repo root,
because it derives its base from `import.meta.url`:

```ts
const __filename = new URL(import.meta.url).pathname;
const __here = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__here, "../..");     // backs out to backend/
```

and clears/re-injects the full module graph (`firestore.js`, firebase-admin firestore index,
repos, services, job, orchestrator). When run from `backend/`, the other files pass because
`process.cwd()` now equals `backend/` and the keys match.

**Proof**: rerunning any of the 11 files from `backend/` fixes them:
- `backend/` → `jobContable.test.ts`: 7 passed (vs suite load failure from root).
- `backend/` → `admin.repository.test.ts`: still 4 failures (see cause C).
- `backend/` full `npx vitest run`: only 3 files fail → same 7 tests.

**Secondary A-driver — vitest root vs file-relative imports in `jobContable.test.ts`**:
it uses `import("../../../src/jobs/jobContableMensual")`. From `backend/tests/integration/`
the correct relative hop is `../../src/jobs/jobContableMensual` (verified: `../../../src/jobs`
resolves to repo-root `src/jobs` which does not exist; `../../src/jobs` resolves to
`backend/src/jobs`). From the repo root the import additionally glues onto `/src/...`
(filesystem root), causing the suite-load failure.

### Root cause B — PARTIALLY CONFIRMED / REFRAMED: secrets are missing from git, present locally

- `backend/src/secrets/serviceAccountKey.json` EXISTS in the working tree (gitignored, 0 tracked files).
- So locally, `require("../secrets/serviceAccountKey.json")` succeeds and `admin.initializeApp` works,
  meaning a live-ish Firestore client is created whenever the mock misses.
- On a fresh clone (CI), that file is absent → `MODULE_NOT_FOUND` on line 3 → every test that
  touches the module graph fails at import. This is a latent CI blocker, not the local cause of
  the current 60 failures. It also means the repo has a `secrets/`-less bootstrap gap that must be
  addressed (env-var fallback or fake/example credential) for CI to be green.

### Root cause C — CONFIRMED: 3 contract drifts (fail even from `backend/`, i.e. the 7 core test failures)

1. **admin.repository.test.ts (4 tests)** — the real repository queries
   `Usuarios/Usuarios/Admin` (admin.repository.js:16-25 and 33-40), but the tests mock
   `db.collection("Admin")`-style chains WITHOUT a `.doc()` step, so `db.collection(...).doc`
   is not a function. Test comment says `collection("Admin")` — stale relative to the production path.

2. **ganancias.service.test.ts (2 tests)** — formula drift:
   - Production (ganancias.service.js:141): `inversionTotal = costosFijosUnit * cartonesTotal + costosVariablesUnit` → 50*100+15 = **5015** (and Miel: 6075)
   - Test expects `(fijos + variables) * cartones` → (50+15)*100 = **6500** (Miel: 10950)
   - This is a BUSINESS DECISION: does `inversionTotal` charge variable costs per carton or as a lump sum? `DOMAIN_RULES.md` / monthly-close intent must be checked before changing either side.

3. **monthlyClosing.orchestrator.test.ts (1 test)** — the orchestrator and
   `contabilidad.service.generarHistoricoMensual` accept a full admin OBJECT `{ uid, nombre }`
   (validated at contabilidad.service.js:19-23), but the unit test asserts
   `generarHistoricoMensual("Enero 2026", "admin-1")` (a uid string). `flujoCompleto.test.ts`
   passes the object form and passes → the TEST is the stale side.

### Cause C (prior) — CONFIRMED variant: FieldValue keying under hoisting

- `jobContable.test.ts` keys `FIREBASE_FIRESTORE_PATH` at
  `node_modules/firebase-admin/lib/firestore/index.js` relative to `process.cwd()`:
  from the repo root this points to `<repo-root>/node_modules/...`, but firebase-admin is NOT
  hoisted to the root (`backend/node_modules/firebase-admin` exists; root does not). From the
  root, the FieldValue mock is therefore never applied and real sentinels leak into assertions.
- `contabilidad.repository.test.ts` uses the more robust `require.resolve("firebase-admin/firestore")`.

### New discovery — two "committed green" files that are only accidentally green

- `obtenerCategoria.test.ts` imports `contabilidad.service` → `contabilidad.repository` →
  `firestore.js` → real Firebase init. It passes because the local secrets file exists and the
  tested function (`obtenerCategoria`) never calls the DB. On CI without secrets this file goes red at import.
- `normalizarTexto.test.ts` is genuinely pure/independent (does not touch Firestore).

### Git state

- Branch `feature/testing-automatico` at `f9b28b7` ("test: full flow integration tests…").
- Only dirty files: `.atl/skill-registry*` (tool-generated, unrelated).
- The failing tests are PRE-EXISTING DEBT committed on this branch (test commits: `6c78530`,
  `65bc6cc`, `29f9147`, `93e7557`, `311880f`, `f9b28b7`), not uncommitted WIP.

### Which files could migrate to the shared helper

- `backend/tests/helpers/firestoreMock.ts` + `firestoreMockTypes.ts` exist and are currently used
  ONLY by `flujoCompleto.test.ts`. They provide `createMockDb()`, `buildMockStore()`, path-aware
  `doc/collection` refs, batch spies, and scenario builders.
- All 11 failing files could migrate their path derivation to `import.meta.url` and — for the
  repository/service tests — reuse `createMockDb()` instead of hand-rolled `Module._cache` shapes.

## Approaches

1. **Unify the launch + fix path derivation (recommended core)**
   - Add a root-level `vitest.config.js` (or document a single canonical command) so `npx vitest run`
     and `npm test` behave identically, and make every test file derive paths from `import.meta.url`
     (extract the pattern from `flujoCompleto.test.ts` into a shared `tests/helpers/paths.ts`).
   - Pros: kills ~53 of the 60 root-run failures; makes CI/root/local identical; one pattern to maintain.
   - Cons: touches all 11 files (mechanical, low-risk); must keep `Module._cache` semantics in mind (CJS).
   - Effort: Medium.

2. **Stand on `npm test` only (backend cwd)**
   - Declare backend-workspace execution the single supported mode; fix only the 7 core failures.
   - Pros: minimal change (7 tests + secrets bootstrap); matches current `npm test` behavior.
   - Cons: root-run still fails 60; preflight/TDD contract runs from root → mismatch persists; CI that
     runs from root breaks; fragile for any future hoisting change.
   - Effort: Low-Medium (but leaves a footgun).

3. **Only patch the 7 core failures, leave cwd sensitivity**
   - Pros: smallest diff.
   - Cons: 53 intermittent-red tests remain depending on launch dir — not acceptable for strict TDD.
   - Effort: Low (rejected as incomplete).

Recommended: **Approach 1**, with the 7 core contract fixes (cause C) and the secrets bootstrap
(env-var fallback in `firestore.js` or a checked-in example credential for tests) shipped in the
same change.

## Per-file effort (under Approach 1)

| File | Root cause | Effort |
|---|---|---|
| `tests/integration/jobContable.test.ts` | A (path derivation + wrong `../../../` import depth + FieldValue keying) | Medium |
| `tests/integration/ventas.test.ts` | A (path derivation) | Low |
| `tests/unit/job/jobContable.rules.test.ts` | A (path derivation) | Low |
| `tests/unit/repositories/admin.repository.test.ts` | A + C1 (mock path + `Usuarios/Usuarios/Admin` contract) | Medium |
| `tests/unit/repositories/contabilidad.repository.test.ts` | A (path derivation; already uses `require.resolve` for FieldValue) | Low |
| `tests/unit/repositories/contable.repository.test.ts` | A | Low |
| `tests/unit/repositories/productos.repository.test.ts` | A | Low |
| `tests/unit/repositories/ventas.repository.test.ts` | A | Low |
| `tests/unit/services/contabilidad.test.ts` | A | Low |
| `tests/unit/services/ganancias.service.test.ts` | A + C2 (business formula decision) | Low + decision |
| `tests/unit/services/monthlyClosing.orchestrator.test.ts` | A + C3 (admin object vs uid string) | Low |
| `tests/helpers/firestoreMock.ts` | Reference helper (extend: paths + FieldValue) | Low-Medium |

## Business decisions required

1. **Ganancias inversion formula**: `fijos*cartones + variables` (production) vs
   `(fijos + variables) * cartones` (test expectation). Must be resolved against the accounting
   domain rules before either side is edited. Check `DOMAIN_RULES.md` and the monthly-close
   intent in the proposal phase.

## Recommendation

Adopt Approach 1: unify launch behavior (root config), migrate all test path derivation to
`import.meta.url` (shared helper), fix the jobContable import depth + FieldValue keying, fix the
3 core contract drifts (admin path mock, orchestrator admin object, ganancias formula after the
business decision), and add a secrets bootstrap so CI without `secrets/` can run the tests.
Suggested order for `sdd-propose` → `sdd-spec`: (1) infra unification, (2) secrets bootstrap,
(3) contract fixes, (4) ganancias formula decision.

## Risks

- Touching all 11 test files expands the diff; keep migrations mechanical and verify per-file.
- The ganancias formula decision could require a production change (not just a test change) — the
  spec must pin the expected formula before implementation.
- `Module._cache`-based mocking is fragile under vitest version bumps; consider a targeted
  dependency-mocking strategy only if a bump is planned.
- CI currently cannot run the suite without secrets — the change must not depend on committing
  the real service account key.

## Open questions

- Should tests run ONLY from the repo root (per preflight) or is `npm test` (backend cwd) acceptable
  as the single canonical mode? (Affects whether a root `vitest.config.js` is needed.)
- Which ganancias formula is correct for the business? (See business decisions above.)
- Should the secrets bootstrap use env-var credentials (`.env` already has `FIREBASE_*` keys) or a
  test-only fake credential?

## Evidence

- `openspec/changes/fix-test-suite/evidence-full-run-root.txt` — full `npx vitest run` output from repo root (60 failed / 64 passed / 7 skipped).
- Backend-cwd run: `npx vitest run` from `backend/` → 7 failed / 124 passed (verified 2026-09-07).