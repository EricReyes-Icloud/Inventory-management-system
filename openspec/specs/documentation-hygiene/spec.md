# Documentation Hygiene Specification

## Purpose

Ensure user-facing docs reflect the repository layer, testing suite, and CI/CD pipeline. Documentation-only — no code changes.

## Requirements

### R1 — README Reflects Current Architecture

README.md MUST include `repositories/` in architecture diagram/tree and MUST contain a "Testing y CI" section with test commands and CI workflow reference.

#### Scenario: Diagram and tree include repositories

- GIVEN the README architecture diagram
- WHEN a developer reads it
- THEN `repositories/` appears between Services Layer and Firebase Firestore

#### Scenario: Testing & CI section present

- GIVEN the README
- WHEN a new developer reads the Testing section
- THEN `npm test` and `npm run test:ci` are listed
- AND `.github/workflows/ci.yml` is referenced

### R2 — Testing Strategy Is Educational

`docs/testing/testing-strategy.md` MUST be rewritten as an educational guide per test category. MUST NOT contain PENDIENTE or "futuro cercano" for implemented areas.

#### Scenario: No stale claims

- GIVEN the testing strategy document
- WHEN scanning status indicators
- THEN no category is marked PENDIENTE and CI is not "futuro cercano"

#### Scenario: Repository tests included

- GIVEN the testing strategy
- WHEN searching for repository coverage
- THEN repository test suites are described

### R3 — ROADMAP Status Corrected

ROADMAP.md MUST mark testing, CI/CD, and repo migration as completed.

#### Scenario: Status block accurate

- GIVEN the ROADMAP status block
- WHEN checking testing, CI/CD, repo rows
- THEN all three are completed (not "En progreso" or "Planeado")

### R4 — CHANGELOG Retroactive Entries

CHANGELOG.md MUST have entries for repo migration (PRs 4-8), test stabilization (PR 21), CI pipeline (PR 22). CI/CD MUST NOT be under "Planeado."

#### Scenario: Repo entry exists

- GIVEN the CHANGELOG
- WHEN searching for repo entries
- THEN a completed entry references PRs 4-8

#### Scenario: CI not under Planeado

- GIVEN the CHANGELOG "Planeado" section
- WHEN reviewing it
- THEN CI/CD is not listed there

### R5 — Technical Decisions Has ADRs

`docs/decisions/technical decisions.md` MUST have ADR entries for repository-pattern adoption and CI/CD adoption.

#### Scenario: Repository ADR present

- GIVEN the technical decisions doc
- WHEN searching for repository decisions
- THEN an ADR describes the adoption with rationale

#### Scenario: CI/CD ADR present

- GIVEN the technical decisions doc
- WHEN searching for CI decisions
- THEN an ADR describes the adoption with rationale

### R6 — SYSTEM_DESIGN Reflects Repository Layer

SYSTEM_DESIGN.md MUST list `repositories/` in layers, tree, and data-flow. MUST NOT contain "Posibilidad futura" for repositories.

#### Scenario: Repository layer present

- GIVEN SYSTEM_DESIGN layer list
- WHEN reading data access sections
- THEN `repositories/` is listed and no "Posibilidad futura" appears for it

### R7 — Supporting Docs Reflect Real Layers

CONTRIBUTING.md, `arquitectura.md`, `coding-rules.md`, `system-behavior.md` MUST reference repository layer and CI as current.

#### Scenario: CONTRIBUTING updated

- GIVEN CONTRIBUTING.md
- WHEN checking testing section
- THEN test commands and CI gate are listed, CI not under long-term goals

#### Scenario: Arquitectura updated

- GIVEN `arquitectura.md`
- WHEN checking layers
- THEN `repositories/` appears, CI not under "Escalabilidad Futura"

#### Scenario: Coding rules updated

- GIVEN `coding-rules.md`
- WHEN checking Firestore access
- THEN `repositories/` is the access layer, CI not under "Reglas Futuras"

#### Scenario: System behavior updated

- GIVEN `system-behavior.md`
- WHEN checking behavior sections
- THEN CI/CD is under current behavior

### R8 — Language Contract

User-facing docs MUST be in Spanish (neutral/professional). SDD artifacts MUST be in English.

#### Scenario: Spanish docs

- GIVEN any of the 10 doc files
- WHEN reading content
- THEN prose is in neutral/professional Spanish

### R9 — Out-of-Scope Untouched

`DOMAIN_RULES.md`, `docs/database/*`, `docs/workflows/*`, `docs/api/api_documentation.md` MUST NOT be modified.

#### Scenario: No accidental edits

- GIVEN any out-of-scope file
- WHEN checked via git diff
- THEN zero changes in this change set
