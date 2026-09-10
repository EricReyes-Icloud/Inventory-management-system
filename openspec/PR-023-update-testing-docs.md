# Sync Documentation with Current System State (Fase 4)

## Description

The written documentation had drifted from the real state of the system on two fronts. First, the repository layer (`backend/src/repositories/`, introduced across PRs #4–8) was absent from the architecture and planning docs — `README.md`, `SYSTEM_DESIGN.md`, `docs/architecture/arquitectura.md` and `docs/ia/coding-rules.md` still described Firestore access as a `lib/` concern. Second, testing and CI/CD were complete (a 134-test suite and a GitHub Actions pipeline, PRs #21–22), but `ROADMAP.md`, `CHANGELOG.md` and `docs/testing/testing-strategy.md` still presented them as "En progreso" or "Planeado", and the testing guide still listed pending work that had already been delivered.

This PR closes Fase 4 of the roadmap: syncing written documentation with the real state of the system. Ten documentation files were updated across two fronts — repository layer and testing/CI — including an ADR entry for each (Patrón Repository and CI/CD adoption), retroactive changelog entries, refreshed roadmap status blocks, and a full rewrite of `docs/testing/testing-strategy.md` as an educational guide explaining what each test file covers and why.

Documentation only — no source code, configuration, or workflow files were touched. The test suite remains green, verified at 134/134 passing across 16 test files. SDD artifacts for the cycle are archived under `openspec/changes/archive/2026-09-10-update-testing-docs/` with a capability spec at `openspec/specs/documentation-hygiene/`.

## Changes Made

### Documentation — repository layer

- `README.md` — added the `repositories/` entry to the backend folder tree.
- `SYSTEM_DESIGN.md` — new "Capa de repositorios" section describing CRUD operations and decoupling from business logic; subsequent layers renumbered (3 → 8); the data-flow listing now reads `Routes → Services → Repositories → Firebase Firestore`; `lib/` scope narrowed to infrastructure configuration; "Acceso a datos desacoplado" section updated to reference the `repositories/` layer.
- `docs/architecture/arquitectura.md` — added `repositories` to the layer list; removed "Implementar CI/CD" from future capabilities (already implemented).
- `docs/ia/coding-rules.md` — new `repositories/` section defining its sole responsibility (Firestore access, CRUD); `lib/` responsibilities narrowed to infrastructure configuration and Firebase initialization; removed "CI/CD" from the future implementation list.
- `docs/decisions/technical decisions.md` — appended ADR 10 (Adopción del Patrón Repository, covering the per-module repositories for admin, contabilidad, contable, productos and ventas) and ADR 11 (Adopción de CI/CD con GitHub Actions, triggering the test suite on every PR and push to `main`/`develop`).

### Documentation — testing and CI/CD

- `docs/testing/testing-strategy.md` — fully rewritten as an educational guide (Spanish): explains how to run the suite (`npm test`, `npm run test:ci`, per-file runs), the suite structure under `backend/tests/` (unit — utils/services/job/repositories, integration, flow, helpers), what each test file covers and why it matters, the CI/CD workflow and PR gate, what not to test, and AI usage in testing.
- `CONTRIBUTING.md` — pre-merge section now requires running the test suite with concrete commands and documents the CI gate ("Los Pull Requests no se pueden mergear si los tests no pasan"); future directions list updated (dropped CI items, added automated deploys, linting, coverage).
- `README.md` — "Testing" section replaced with "Testing y CI": run commands, suite composition (unit/integration/flow/helpers), and the GitHub Actions workflow (`.github/workflows/ci.yml`, Node 22, `npm ci` + `npm run test:ci`).
- `docs/ia/system-behavior.md` — new "Comportamiento Actual" section documenting the CI/CD pipeline and the repository layer as current behavior; removed "CI/CD automatizado" from future expected behavior.

### Documentation — roadmap and changelog status

- `ROADMAP.md` — "Trabajo actual"/"Planes futuros" replaced with an "Estado" block (testing suite completed, ~16 test files) and an "Integración CI/CD" block (completed); status legend updated: Testing Automatizado, Capa Repository and CI/CD marked Completado, CI/CD removed from Planeado.
- `CHANGELOG.md` — retroactive entries added for Capa Repository (PRs #4–8), Suite de Testing (PR #21) and CI/CD (PR #22); CI/CD removed from the "Planeado" infrastructure list; stale "En Progreso — Testing" section and a deprecated Firestore decoupling bullet removed; status legend finalized (Testing Automatizado, Capa Repository, CI/CD = Completado).

### Specs

- `openspec/specs/documentation-hygiene/spec.md` — new SDD capability spec for this documentation cycle.
- `openspec/changes/archive/2026-09-10-update-testing-docs/` — archived SDD change record (exploration, proposal, design, tasks, apply progress, verify and archive reports).

## Impact

- Documentation now matches the system: the repository layer, the 134-test suite and the CI/CD pipeline are described as implemented, with no stale "pending" claims in `ROADMAP.md` or `CHANGELOG.md`.
- New contributors get accurate onboarding: run commands and the CI gate in `CONTRIBUTING.md` and `README.md`, plus a per-test-file explanation of coverage and intent in `docs/testing/testing-strategy.md`.
- ADR 10 and ADR 11 give traceability for the repository pattern and CI/CD adoption decisions.
- No runtime impact: no code was changed and the developer workflow is unaffected. The suite was re-verified green — 134/134 tests passing across 16 test files in ~1.8s.
- `docs/testing/testing-strategy.md` now reads as neutral-process documentation (AI decision wording aligned with the project's guidance on AI usage).

## Notes

- How to verify: run `npm run test:ci` from the repo root — expect 134/134 tests passing (16 files), exit 0. No other verification needed since nothing beyond documentation changed.
- Follow-up: visual architecture diagrams for `README.md` and `SYSTEM_DESIGN.md` are deferred to a future session using a dedicated diagram skill. This PR intentionally updates textual documentation only — no diagram rendering was added.