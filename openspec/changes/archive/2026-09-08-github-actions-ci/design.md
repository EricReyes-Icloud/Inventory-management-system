# Design: GitHub Actions CI

## Technical Approach

Single GitHub Actions workflow (`.github/workflows/ci.yml`) with one `test` job. Workflow triggers on `pull_request` (all branches) and `push` to `main`/`develop`. Steps: checkout → setup-node (Node 22 LTS, npm cache) → npm ci → npm run test:ci. Root `package.json` gets a new `test:ci` script (`vitest run`). No secrets, no coverage, no additional jobs. This maps directly to Approach 1 from the exploration and satisfies all 11 requirements / 17 scenarios in the delta spec.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| checkout@v4 + setup-node@v4 (pinned major) | v4 is current stable; pinning major prevents silent breaking changes while auto-receiving patches | **Use v4** — matches exploration evidence and GitHub Actions ecosystem convention |
| Node 22 LTS vs Node 24 | 22 LTS matches vitest 4 engines (`^20 \|\| ^22 \|\| >=24`), local v22.22.3, and firebase-admin ≥18; Node 24 is only needed for `functions/` job (out of scope) | **Node 22.x** — avoids importing `functions/` Node 24 requirement into the test job |
| `test:ci` script = `vitest run` vs `npm run test:run -w backend` | Direct `vitest run` is one less indirection; `test:run -w backend` routes through workspace. Both work identically from root. Direct is simpler and matches spec literal value. | **`vitest run`** — spec mandates this exact value; simplest path |
| `cache-dependency-path` explicit vs default | Default uses root `package-lock.json` which is correct. Explicit adds maintenance burden for same result. | **Default (omit parameter)** — root lockfile is the correct cache key; no workspace ambiguity |
| Job `timeout-minutes: 10` vs default (360 min) | Suite is ~1.5s; 10 min catches hung workflows without being aggressive. Default 6h is dangerous. | **10 minutes** — per spec requirement; safe guardrail |
| Permissions block | Default GITHUB_TOKEN permissions are sufficient for a read-only test job. Adding explicit `permissions:` is defensive but unnecessary for scope. | **Omit** — no secrets accessed, no write operations; keeping YAML minimal |

## Data Flow

    PR opened / push to main/develop
         │
         ▼
    GitHub Actions trigger
         │
         ▼
    ┌─────────────────────────────────┐
    │  Job: test (ubuntu-latest)      │
    │                                 │
    │  1. actions/checkout@v4         │
    │     (full clone, no fetch-depth)│
    │           │                     │
    │           ▼                     │
    │  2. actions/setup-node@v4       │
    │     node-version: 22.x          │
    │     cache: npm                  │
    │           │                     │
    │           ▼                     │
    │  3. npm ci                      │
    │     (root lockfile, workspaces) │
    │           │                     │
    │           ▼                     │
    │  4. npm run test:ci             │
    │     → vitest run (134 tests)    │
    │                                 │
    │  timeout-minutes: 10            │
    └─────────────────────────────────┘
         │
         ▼
    Exit 0 (pass) / non-zero (fail) → GitHub status check

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `.github/workflows/ci.yml` | Create | CI workflow: triggers, single `test` job, 4 steps |
| `package.json` (root) | Modify | Add `"test:ci": "vitest run"` to `scripts` |

## Interfaces / Contracts

### Root `package.json` scripts (after change)

```json
"scripts": {
  "dev": "npm run dev -w backend",
  "test": "npm run test -w backend",
  "test:ci": "vitest run",
  "build": "npm run build -w backend"
}
```

### Workflow YAML structure

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22.x
          cache: npm
      - run: npm ci
      - run: npm run test:ci
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Pre-push local | Verify workflow will pass on GitHub | `npm ci && npm run test:ci` from root — reproduces CI steps exactly |
| YAML validation | Workflow syntax is valid | `actionlint` or GitHub's workflow editor; push to branch and check Actions tab |
| CI integration | End-to-end workflow triggers and passes | Push to feature branch → open PR → verify `test` job runs green |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The workflow runs standard `npm` and `vitest` commands; no custom shell scripts, no subprocess spawning, no executable-file classification decisions.

## Migration / Rollout

No migration required. Two atomic file changes (create workflow, add script). First push to any branch with the workflow file triggers the pipeline. No feature flags, no phased rollout needed.

**Verification before merge**: After implementing, run locally:
```bash
npm ci && npm run test:ci
```
This reproduces the exact CI steps. If it passes locally, the workflow will pass on GitHub.

## Open Questions

- [ ] None — all decisions are resolved. Design is unambiguous and directly implementable.
