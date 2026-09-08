# Proposal: GitHub Actions CI

## Intent

No CI pipeline exists — the 134-test suite only runs when a developer manually executes `npx vitest run` locally. This creates a gap where regressions can silently land on `main`. Adding a lightweight GitHub Actions workflow closes that gap with zero secrets and minimal configuration.

## Scope

### In Scope
- `.github/workflows/ci.yml` — single `test` job: `ubuntu-latest`, `actions/setup-node@v4` (Node 22 LTS, npm cache), `npm ci`, `npx vitest run`
- Root `package.json`: add `"test:ci": "vitest run"` script
- Triggers: `pull_request` (all branches) + `push` to `main`/`develop`
- Job timeout: 10 minutes (safe default for ~1.5s suite)
- No secrets required — tests use `Module._cache` mocks and `firestore.js` fallback

### Out of Scope
- `functions` lint/build job (follow-up change; requires Node 24, its own lockfile)
- Coverage thresholds or `@vitest/coverage-v8` dependency
- Branch protection rules or required status checks (user configures in GitHub UI)
- README badge
- Advanced `actions/cache` for vitest cache (`setup-node` built-in npm cache is sufficient)
- Secrets configuration (`GOOGLE_APPLICATION_CREDENTIALS`, `FIREBASE_PROJECT_ID`)

## Capabilities

### New Capabilities
- `ci-pipeline`: GitHub Actions workflow that runs the test suite on PRs and pushes to main/develop

### Modified Capabilities
None — no existing spec covers CI/CD; all existing specs are business-domain (ventas, contabilidad, ganancias).

## Approach

Single workflow file (Approach 1 from exploration). The `test:ci` script (`vitest run`) provides an explicit, deterministic CI entry point decoupled from the watch-capable `test` script. `npm ci` from root works today despite the declared-but-missing `frontend` workspace (npm ignores it). No repo secrets needed.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `.github/workflows/ci.yml` | New | CI workflow file (~40 lines) |
| `package.json` (root) | Modified | Add `test:ci` script |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Missing `frontend` workspace breaks `npm ci` if `frontend/package.json` appears later | Low | Regenerate root lockfile (`npm install`) when frontend materializes |
| `functions/` build surfaces pre-existing TS issues if added later | Low | Out of scope; own lockfile isolates it |
| Root `test` script (watch mode) confusion if called from CI | Low | CI calls `test:ci` explicitly, not `test` |

## Rollback Plan

Delete `.github/workflows/ci.yml` and remove the `test:ci` script from root `package.json`. No data or config changes to revert.

## Dependencies

None. Tests run with no Firebase secrets via existing `Module._cache` mocks.

## Success Criteria

- [ ] Workflow triggers on `pull_request` and `push` to `main`/`develop`
- [ ] `npm ci` completes without errors from root
- [ ] `npx vitest run` passes 134/134 tests in the workflow
- [ ] No repo secrets required
- [ ] Job finishes within 2 minutes (suite is ~1.5s; remainder is setup)
