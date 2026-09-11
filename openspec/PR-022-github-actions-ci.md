# GitHub Actions CI for Automated Tests

## Description

Until now, the test suite could only be run manually — there was no automated gate to catch regressions before merging. This meant broken code could land on `main` or `develop` without any CI signal, relying entirely on contributors remembering to run tests locally.

This PR adds a GitHub Actions CI pipeline that runs the full test suite on every pull request and every push to `main` or `develop`. The pipeline installs dependencies, executes the 134-test suite, and fails the build if any test breaks — providing an automated quality gate with zero manual intervention.

The approach is intentionally minimal: a single `test` job, no coverage, no linting, no deployment steps. This keeps the pipeline fast (~1.5s for tests) and avoids scope creep while still closing the most critical gap in the development workflow.

## Changes Made

### Dev tooling

- `.github/workflows/ci.yml` — new GitHub Actions workflow named `CI` with a single `test` job (`ubuntu-latest`, `timeout-minutes: 10`). Triggers on `pull_request` (all branches) and `push` to `main`/`develop`. Steps: `actions/checkout@v4`, `actions/setup-node@v4` (node-version `22.x`, npm cache), `npm ci`, `npm run test:ci`.
- `package.json` (root) — added `"test:ci": "vitest run"` script between `test` and `build`. The existing `test` script (workspace-delegated, watch-mode) remains unchanged.

### Specs

- `openspec/specs/ci-pipeline/spec.md` — new capability spec (`ci-pipeline`, 11 requirements, 17 scenarios) covering workflow triggers, job configuration, dependency installation, test execution, and timeout behavior.
- `openspec/changes/archive/2026-09-08-github-actions-ci/` — archived SDD change record for this cycle.

## Impact

- Every pull request and every push to `main`/`develop` now triggers an automated test run. Broken tests will block merges once branch protection rules with required status checks are configured (out of scope for this PR).
- The local developer experience is unaffected: `npm test` still delegates to the `backend` workspace in watch mode; `npm run test:ci` is a new entry point for CI-only single-run execution.
- The `test:ci` script runs `vitest run` directly from the root, which picks up `vitest.config.js` (added in PR-021) with `root: 'backend'`. All 134 tests pass in approximately 1.5 seconds on `ubuntu-latest`.
- No GitHub repository secrets are required — the test suite uses mocked Firestore and `backend/src/lib/firestore.js` falls back to `FIREBASE_PROJECT_ID` env var (defaulting to `"test-project"`) when the gitignored service account key is absent.
- `actionlint` v1.7.12 validates the workflow with zero errors.

## Notes

- To verify: push to a branch, open a PR, and confirm the `CI` check passes. Locally, run `npm ci && npm run test:ci` from the repo root — expect 134/134 tests passing, exit 0.
- The `workspaces` field in `package.json` declares `frontend`, but that directory does not exist yet. npm ignores the missing workspace today; if `frontend/` is added later, regenerate the lockfile to avoid install issues. Installing from the repo root is mandatory — the `backend/package-lock.json` is orphaned and does not reflect the root lockfile.
- Follow-up items not in scope: lint/build steps for `functions/`, test coverage reporting, CI badge in README, branch protection rules with required status checks.
