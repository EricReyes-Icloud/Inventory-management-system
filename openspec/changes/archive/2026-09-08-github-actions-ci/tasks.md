# Tasks: GitHub Actions CI

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~41 (40 workflow + 1 package.json) |
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
| 1 | Add test:ci script + CI workflow | PR 1 | `npm ci && npm run test:ci` | Push to feature branch, open PR, verify Actions tab shows green `test` job | Delete `.github/workflows/ci.yml` and remove `test:ci` from `package.json` scripts |

## Phase 1: Foundation — CI Script

- [x] 1.1 Add `"test:ci": "vitest run"` to root `package.json` `scripts` section (between `test` and `build`)
  - Verify: `node -e "const p=require('./package.json'); console.assert(p.scripts['test:ci']==='vitest run')"`
- [x] 1.2 Run `npm run test:ci` locally — confirm 134/134 tests pass and exit code 0

## Phase 2: Core Implementation — Workflow File

- [x] 2.1 Create `.github/workflows/ci.yml` with the exact YAML from design: `name: CI`, triggers on `pull_request` + `push` to `[main, develop]`, single `test` job with `ubuntu-latest`, `timeout-minutes: 10`, steps: `checkout@v4`, `setup-node@v4` (node 22.x, cache npm), `npm ci`, `npm run test:ci`
- [x] 2.2 Validate YAML structure — verify: single `test` job exists, no other jobs, no `fetch-depth` on checkout, `timeout-minutes` is 10

## Phase 3: Verification

- [x] 3.1 Spec scenario — CI Script: run `node -e "const s=require('./package.json').scripts; if(s.test!=='npm run test -w backend') throw 'test script changed'"` — confirms local `test` script unchanged
- [x] 3.2 Spec scenario — Workflow Simplicity: parse `ci.yml` and confirm exactly 1 job named `test`
- [x] 3.3 Spec scenario — CI Triggers: confirm `on:` block has `pull_request:` (no branch filter) and `push: branches: [main, develop]`
- [x] 3.4 Spec scenario — Job Timeout: confirm `timeout-minutes: 10` under `test` job
- [x] 3.5 Spec scenario — Checkout Depth: confirm no `fetch-depth` parameter on `actions/checkout@v4` step
- [x] 3.6 Spec scenario — Node.js Setup: confirm `setup-node@v4` has `node-version: 22.x` and `cache: npm`
- [x] 3.7 Full local dry-run: `npm ci && npm run test:ci` — reproduces exact CI steps, must exit 0
