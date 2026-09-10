# Proposal: update-testing-docs

## Intent

Documentation lags behind reality on two fronts: (1) testing docs claim CI/CD is "Planeado" and four test areas are "PENDIENTE" when the suite has 16 files / ~134 cases and a live GitHub Actions pipeline, and (2) the repository layer (`backend/src/repositories/`, 5 files) is absent from every architecture doc — SYSTEM_DESIGN.md even calls it a "Posibilidad futura." This blocks new-developer onboarding and undermines the user's learning path.

## Scope

### In Scope

Update **10 documents** to reflect the real current state:

| # | File | Key Fixes |
|---|------|-----------|
| 1 | `README.md` | Add `repositories/` to tree/diagram; add Testing & CI section (commands, suite overview, CI workflow) |
| 2 | `ROADMAP.md` | Mark testing phases complete; mark CI/CD done; record repository migration as completed |
| 3 | `SYSTEM_DESIGN.md` | Add repository layer to layer list, tree, data-flow diagram; remove "Posibilidad futura" framing |
| 4 | `CHANGELOG.md` | Retroactive entries: repo migration (PRs 4–8), test-suite stabilization (PR 21), CI pipeline (PR 22) |
| 5 | `CONTRIBUTING.md` | Add concrete test commands; describe CI PR gate; remove "objetivos a largo plazo" CI item |
| 6 | `docs/testing/testing-strategy.md` | **Full rewrite** as educational guide — what each test file covers and WHY, plain language for someone learning testing; include repo tests, helpers, CI section |
| 7 | `docs/architecture/arquitectura.md` | Add `repositories/` to layer list; move CI out of "Escalabilidad Futura" |
| 8 | `docs/decisions/technical decisions.md` | Add ADR: repository-pattern adoption; Add ADR: CI/CD adoption |
| 9 | `docs/ia/coding-rules.md` | Reference `repositories/` as Firestore access layer; remove CI from "Reglas Futuras" |
| 10 | `docs/ia/system-behavior.md` | Move CI/CD from "Comportamiento Futuro" to current behavior |

### Out of Scope

- `DOMAIN_RULES.md`, `docs/database/*`, `docs/workflows/*`, `docs/ia/business-context.md`, `docs/ia/project-goals.md` — accurate, no staleness
- `docs/api/api_documentation.md` — generic testing mention is accurate; optional enhancement deferred
- No new standalone documentation files (Approach B: update existing + consolidated README section)
- `openspec/changes/repository-layer/` un-archived folder — flagged as a separate cleanup task

## Capabilities

### New Capabilities

None — this is a documentation-only change; no spec-level behavior is introduced.

### Modified Capabilities

None — existing specs remain accurate. The change corrects documentation, not system behavior.

## Approach

**Approach B** (from exploration): Update ~10 existing docs + rewrite `testing-strategy.md` as an educational guide + add consolidated Testing & CI section in README.

**Language contract**: All user-facing docs in Spanish (neutral/professional register). SDD artifacts (this proposal, future specs/design/tasks) in English per artifact language contract.

**Commit unit grouping** (for review budget):
- **Group 1 — Repository layer docs**: README tree/diagram, SYSTEM_DESIGN, arquitectura, coding-rules, technical decisions (ADRs), CHANGELOG repo entries, ROADMAP repo phase
- **Group 2 — Testing & CI docs**: testing-strategy.md (full rewrite), README Testing & CI section, CONTRIBUTING, system-behavior, CHANGELOG test/CI entries, ROADMAP test/CI status

Each group stays under 400 lines; if combined diff exceeds budget, split into chained PRs.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `README.md` | Modified | Structure tree, architecture diagram, Testing & CI section |
| `ROADMAP.md` | Modified | Phase status blocks, future-plans section |
| `SYSTEM_DESIGN.md` | Modified | Layer list, tree, data-flow diagram, "futuro" framing |
| `CHANGELOG.md` | Modified | 3 retroactive entries |
| `CONTRIBUTING.md` | Modified | Test commands, CI gate description |
| `docs/testing/testing-strategy.md` | Modified (rewrite) | Full educational rewrite against real suite |
| `docs/architecture/arquitectura.md` | Modified | Layer list, CI section |
| `docs/decisions/technical decisions.md` | Modified | 2 new ADR entries |
| `docs/ia/coding-rules.md` | Modified | Repository reference, CI rules |
| `docs/ia/system-behavior.md` | Modified | CI from future to current |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Stale test counts (16 files / ~134 cases drift) | Med | Verify exact counts at apply time; describe structure over exact numbers |
| Scope creep into accurate docs | Low | Explicit out-of-scope list; validate each edit against staleness inventory |
| 400-line review budget exceeded | Med | Two commit groups; chained PRs if diff grows |
| `openspec/changes/repository-layer/` confusion | Low | Flag in proposal; defer to separate cleanup task |
| Language inconsistency across 10 files | Low | All doc edits in neutral/professional Spanish; cross-check terminology |

## Rollback Plan

Each commit group is independent. `git revert` the last commit of either group to undo that front's changes. The `testing-strategy.md` rewrite can be reverted as a single commit. No database, API, or runtime changes — rollback is purely file-level.

## Dependencies

- None. All test files, CI workflow, and repository layer already exist in the codebase.

## Success Criteria

- [ ] Every "Planeado/PENDIENTE/futuro" claim about testing, CI, or repository layer is corrected
- [ ] `testing-strategy.md` reads as an educational guide explaining what each test covers and why
- [ ] `technical decisions.md` contains ADR entries for repository pattern and CI adoption
- [ ] `CHANGELOG.md` has retroactive entries for repo migration, test stabilization, and CI pipeline
- [ ] `README.md` has a consolidated Testing & CI section with real commands and suite overview
- [ ] `repositories/` appears in all architecture trees, diagrams, and layer lists
