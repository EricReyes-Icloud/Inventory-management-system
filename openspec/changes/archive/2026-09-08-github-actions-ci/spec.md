# Delta for CI Pipeline

## ADDED Requirements

### Requirement: CI Workflow File

The system SHALL have a GitHub Actions workflow file at `.github/workflows/ci.yml` that defines a single `test` job.

#### Scenario: Workflow file exists with correct structure

- GIVEN the repository has a `.github/workflows/ci.yml` file
- WHEN the file is parsed as YAML
- THEN it contains a `test` job definition
- AND the job runs on `ubuntu-latest`
- AND the job uses `actions/checkout@v4` as its first step

### Requirement: CI Triggers

The workflow SHALL trigger on `pull_request` events (all branches) and `push` events to `main` or `develop` branches.

#### Scenario: PR triggers CI

- GIVEN a developer opens a pull request targeting any branch
- WHEN the pull request event fires
- THEN the `test` job is triggered

#### Scenario: Push to main triggers CI

- GIVEN code is pushed to the `main` branch
- WHEN the push event fires
- THEN the `test` job is triggered

#### Scenario: Push to develop triggers CI

- GIVEN code is pushed to the `develop` branch
- WHEN the push event fires
- THEN the `test` job is triggered

#### Scenario: Push to feature branch does NOT trigger CI

- GIVEN code is pushed to a feature branch (not `main` or `develop`)
- WHEN the push event fires
- THEN the `test` job is NOT triggered

### Requirement: Node.js Setup

The job SHALL use `actions/setup-node@v4` to install Node.js 22 LTS with npm dependency caching enabled.

#### Scenario: Node 22 installed with cache

- GIVEN the `test` job starts
- WHEN `actions/setup-node@v4` executes
- THEN Node.js version 22.x is installed
- AND npm cache is configured (cache parameter set to `npm`)

### Requirement: Dependency Installation

The job SHALL run `npm ci` from the repository root to install dependencies deterministically.

#### Scenario: npm ci from root succeeds

- GIVEN the job has checked out the code and set up Node.js
- WHEN `npm ci` is executed from the repository root
- THEN the command exits with code 0
- AND all workspace dependencies are installed (backend only; frontend workspace is absent and ignored)

### Requirement: Test Execution

The job SHALL execute the test suite using the `test:ci` script from root `package.json`, which runs `vitest run` (non-watch mode). The job MUST exit with code 0 on pass and non-zero on failure.

#### Scenario: All tests pass

- GIVEN dependencies are installed
- WHEN `npm run test:ci` is executed from the root
- THEN vitest runs the full test suite (134 tests)
- AND all tests pass
- AND the command exits with code 0

#### Scenario: Test failure causes job failure

- GIVEN dependencies are installed
- WHEN `npm run test:ci` is executed and any test fails
- THEN the command exits with non-zero code
- AND the GitHub Actions job is marked as failed

### Requirement: CI Script in Root package.json

Root `package.json` SHALL contain a `test:ci` script with the value `vitest run`. This script is the canonical CI entry point and MUST NOT use watch mode.

#### Scenario: test:ci script exists

- GIVEN the repository root `package.json` is read
- WHEN the `scripts` section is inspected
- THEN a `test:ci` key exists
- AND its value is `vitest run`

#### Scenario: test:ci does not use watch mode

- GIVEN the `test:ci` script is `vitest run`
- WHEN vitest receives the `run` flag
- THEN vitest executes once and exits (no watch/interactive mode)

### Requirement: Job Timeout

The job SHALL have a timeout of 10 minutes to prevent hung workflows.

#### Scenario: Job has timeout configured

- GIVEN the workflow YAML is parsed
- WHEN the `test` job is inspected
- THEN `timeout-minutes` is set to 10

### Requirement: No Secrets Required

The test suite SHALL run without any repository secrets or environment variables. Tests must use existing mock infrastructure (`Module._cache` mocks, `firestore.js` fallback) to achieve green.

#### Scenario: Green run without secrets

- GIVEN the repository has no `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_PROJECT_ID` secrets configured
- WHEN `npm run test:ci` executes
- THEN all 134 tests pass
- AND no credential-related errors occur

### Requirement: Local Test Script Unchanged

The root `test` script in `package.json` SHALL remain as its current watch-capable value (`npm run test -w backend`). The CI change MUST NOT modify local development behavior.

#### Scenario: npm test still uses watch mode locally

- GIVEN a developer runs `npm test` from the root in an interactive terminal
- WHEN vitest starts
- THEN it enters watch mode (the developer can see file-watching behavior)

### Requirement: Workflow Simplicity

The workflow SHALL contain a single job (`test`). No additional jobs (lint, build, functions, coverage) SHALL be defined in this workflow. Future jobs are out of scope for this change.

#### Scenario: Single job in workflow

- GIVEN the workflow YAML is parsed
- WHEN the `jobs` section is inspected
- THEN exactly one job named `test` exists
- AND no other jobs are defined

### Requirement: Checkout Depth

The checkout step SHALL use the default depth (full clone) to ensure vitest can resolve all test files correctly.

#### Scenario: Full checkout performed

- GIVEN the `test` job starts
- WHEN `actions/checkout@v4` executes
- THEN no `fetch-depth` parameter is set (defaults to full clone)

## MODIFIED Requirements

None — this change adds a new capability. No existing specs are modified.

## REMOVED Requirements

None — no existing requirements are removed.

## RENAMED Requirements

None — no existing requirements are renamed.
