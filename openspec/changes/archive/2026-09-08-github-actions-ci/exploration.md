# Exploration: GitHub Actions CI

- **status**: complete
- **date**: 2026-09-08
- **branch**: `feature/testing-automatico` (remote default: `main`)

## Executive Summary

The repo is CI-ready: the full suite runs 134/134 via `npx vitest run` from the root in ~1.5s, is idempotent, and requires no Firebase credentials (tests use `Module._cache` Firestore mocks; `firestore.js` falls back to `applicationDefault()` + `FIREBASE_PROJECT_ID || "test-project"` without a secrets file). `npm ci --dry-run` from the root succeeds despite the declared-but-missing `frontend` workspace. Recommended CI baseline: GitHub Actions on `ubuntu-latest`, Node 22 LTS, `setup-node` cache, `npm ci`, `npx vitest run`. No repo secrets are needed for this phase.

## Current State (verified evidence)

| Fact | Evidence |
|---|---|
| Test suite: 16 files / 134 tests, all green | `npx vitest run` → `Test Files 16 passed (16)`, `Tests 134 passed (134)`, Duration ~1.3–1.6s (ran twice: 1.59s, 1.29s) |
| Root vitest config unifies launch modes | `vitest.config.js` (root): `root: 'backend'`, `include: ['tests/**/*.test.*']`, `globals: true`, `environment: 'node'` |
| `npm test` (root) routes to watch-capable script | root `package.json` `test` → `npm run test -w backend` → backend `test` = `vitest` (no `run`) |
| CI-safe script already exists | backend `package.json` `test:run` = `vitest run` |
| Watch does NOT hang in CI on vitest 4.1.2 | `CI=true npx vitest` → runs once, exit 0 (1.49s); `env -u CI npx vitest </dev/null` → runs once, exit 0 (1.38s). Vitest 4 auto-exits when stdin is not a TTY. Only interactive TTY (local watch) stays alive. **Still**, `test:run` is the deterministic, documented choice. |
| `npm ci --dry-run` works from root | Exit 0, "added 36 packages in 1s" (delta over existing tree; consistency check package.json↔lockfile passed) |
| `frontend` workspace declared but missing | root `package.json` `workspaces: ["backend","frontend"]`; `frontend/` does NOT exist (ls: No such file). `npm ls --workspaces` shows only `backend`. Lockfile lists `frontend` only in the root workspaces array (line 13), with NO `frontend` entry in `packages` — npm ignores the missing folder. |
| Lockfiles all tracked | `package-lock.json` (root), `backend/package-lock.json`, `functions/package-lock.json` all in `git ls-files` ✓ |
| backend lockfile is orphaned/stale | `backend/package-lock.json` contains NO vitest entry (pre-workspace era). Never run `npm ci` inside `backend/`; always from repo root. |
| Node version compatibility | vitest 4.1.2 `engines`: `^20.0.0 || ^22.0.0 || >=24.0.0`; firebase-admin (resolved 13.7.0, backend wants ^13.5.0) `engines`: `>=18`; `@types/node` 25.6.0 is types-only (no runtime engine); `functions/package.json` `engines.node: "24"` |
| Local Node works | `node v22.22.3`, `npm 10.9.8` runs the suite green |
| Secrets bootstrap is CI-safe | `backend/src/lib/firestore.js` try/catch on `require("../secrets/serviceAccountKey.json")` → falls back to `admin.credential.applicationDefault()` + `process.env.FIREBASE_PROJECT_ID || "test-project"` |
| Tests need no credentials | `backend/tests/integration/jobContable.test.ts` injects `mockDb`/`FieldValue` via `Module._cache`; unit tests pre-seed repos in `Module._cache`; `backend/tests/helpers/secrets-bootstrap.test.ts` proves the module loads with no secrets file (moves the file away, expects no `MODULE_NOT_FOUND`) |
| No CI exists yet | `.github/` absent; `gh` CLI not installed locally (remote queried via `git remote -v`: `github.com/EricReyes-Icloud/Inventory-management-system.git`) |
| Gitignore already safe | `.env`, `.env.*`, `secrets/`, `coverage/`, `node_modules/`, `dist/`, `build/` excluded |
| Docs plan CI | `docs/testing/testing-strategy.md` §CI/CD: "GitHub Actions, Ejecución automática de tests en cada push, Validación antes de merge a main"; `ROADMAP.md` §Planes futuros: "GitHub Actions, Validaciones automáticas, Pipelines de testing" |

## Affected Areas

- `.github/workflows/ci.yml` — NEW. The CI pipeline (does not exist today).
- `package.json` (root) — ADD script `test:ci`: `npx vitest run` (or `npm run test:run -w backend`). Explicit CI entry point decoupled from `test` (watch-capable) semantics.
- `openspec/changes/github-actions-ci/exploration.md` — this artifact.
- (Optional, future integration) GitHub repo settings: branch protection on `main`/`develop`; repo secrets `GOOGLE_APPLICATION_CREDENTIALS` / `FIREBASE_PROJECT_ID` — NOT required for this phase.

## Approaches

1. **Minimal CI: single `test` job (recommended)**
   - Triggers: `push` to `main`/`develop` (and feature branches optionally) + `pull_request` (all).
   - Steps: `checkout@v4` → `setup-node@v4` (node 22, `cache: npm`, `cache-dependency-path: package-lock.json`) → `npm ci` → `npx vitest run` (CI command from root; deterministic).
   - Optionally add root script `test:ci` and call `npm run test:ci`.
   - Pros: ~1 min total job; zero secrets; covers the 134-test suite; unblocks roadmap Phase 2; low diff (2 files).
   - Cons: no function lint/build coverage yet; no coverage gate.
   - Effort: Low.

2. **Test + functions lint/build jobs**
   - Adds a second job `functions-ci`: `npm ci` in `functions/` (its own lockfile), `npm run lint`, `npm run build` — with Node 24 (`setup-node` node: 24) to match `engines.node: "24"`.
   - Pros: guards Cloud Functions regressions early; matches deployment runtime.
   - Cons: `functions/` is on firebase-functions v7 + typescript ^6 (devDeps); build may surface pre-existing TS issues unrelated to this change; larger scope for Phase 1.
   - Effort: Medium.

3. **Full CI with coverage + caching of vitest cache**
   - Adds `@vitest/coverage-v8` (not installed today — `coverage` script exists in backend but provider dependency missing), coverage threshold gate, and `actions/cache` for `node_modules/.vite` / vitest cache.
   - Pros: coverage regression guard.
   - Cons: `coverage` script currently references a provider not present as devDep (`npm run coverage -w backend` would prompt/fail) — would need a dependency addition first; more moving parts.
   - Effort: Medium.

## Recommendation

**Approach 1** for this change: a single `test` job, `ubuntu-latest`, Node 22 LTS (matches vitest 4 engines, local runtime v22.22.3, and firebase-admin >=18), with npm cache via `setup-node@v4`, `npm ci`, and `npx vitest run` from the root. Add a root `test:ci` script (canonical: `npm run test:run -w backend`) so the pipeline calls an explicit, documented CI entry point instead of relying on vitest's CI auto-detect. Keep `functions` lint/build out of scope for this change (can be a follow-up change reusing `functions/package-lock.json` and Node 24). No secrets configuration. Caching: `setup-node`'s built-in npm cache is sufficient; a separate `actions/cache` layer is premature.

## Verified Commands

```bash
# Test suite (run twice, idempotent)
npx vitest run          # 16 files / 134 passed, ~1.3–1.6s, exit 0

# Watch-mode behavior under CI-like conditions (evidence for gotcha)
CI=true npx vitest      # runs once, 134 passed, exit 0
env -u CI npx vitest < /dev/null  # runs once, 134 passed, exit 0

# Install
npm ci --dry-run        # exit 0 (root install resolves workspaces; frontend missing is ignored)
npm ls --workspaces --depth=0  # shows backend only

# Versions
node --version          # v22.22.3
npm --version           # 10.9.8
```

## Risks

- **Watch-mode ambiguity**: `npm test` (root) resolves to `vitest` and behaves differently with an interactive TTY. Mitigated by calling `test:run`/`npx vitest run` explicitly in CI. Do NOT switch root `test` to `run` without user confirmation (local DX change).
- **Missing `frontend` workspace**: if a `frontend/package.json` is created later, the root lockfile is out of sync → `npm ci` fails (`EBADENGINE`-class out-of-sync error). Regenerate the root lockfile (`npm install`) when frontend materializes. For now, `npm ci` passes because npm ignores declared-but-absent workspaces and the lockfile has no `frontend` entry.
- **Orphaned `backend/package-lock.json`**: stale (no vitest). Running `npm ci` inside `backend/` would install an outdated tree. Always run install from the repo root; optionally delete the orphaned lockfile in a future cleanup change.
- **Node version drift**: `functions` demands Node 24; backend has no `engines`. If a future job builds functions, it must pin Node 24 explicitly. The test job uses Node 22 (vitest-compatible; functions are NOT part of the workspace install).
- **Secrets hygiene**: this phase needs none. Future real-integration env vars: `GOOGLE_APPLICATION_CREDENTIALS` (path to service account JSON) and `FIREBASE_PROJECT_ID`. Never echo them into logs; store as repo secrets only.
- **Branch policy**: default branch is `main`; `develop` and `feature/*` exist. Decide (with user) whether CI triggers on all pushes or only `main`+`develop`+PRs. Suggested default: `push` on `main`/`develop` + `pull_request` (all targets) — covers feature work via PRs without burning minutes on every push.
- **Timeout**: suite is ~1.5s locally, so default job timeouts are fine; no special `timeout-minutes` needed beyond a sane 10.
- **Budget guard**: change is tiny (< 50 added lines across 2 files) — no chained-PR concern.

## Ready for Proposal

Yes. The orchestrator should tell the user: CI can be shipped with a ~40-line workflow file plus one root script (`test:ci`), zero secrets, Node 22 LTS baseline; recommend confirming branch-policy trigger choice (push scope) and whether functions lint/build stays out of scope for this change.