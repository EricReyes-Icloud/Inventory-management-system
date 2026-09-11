# Tasks: update-testing-docs

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~320 (Unit A ~120, Unit B ~200) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR, 2 thematic commits (Unit A, Unit B) |
| Delivery strategy | ask-on-risk (default) |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| A | Repository-layer docs current | PR 1 | `grep -c "repositories" README.md SYSTEM_DESIGN.md` → ≥1 each | N/A — docs-only, no runtime | Revert commit A |
| B | Testing/CI docs current | PR 1 | `grep -c "PENDIENTE" docs/testing/testing-strategy.md` → 0; `grep "Testing y CI" README.md` → found | N/A — docs-only, no runtime | Revert commit B |

## Phase 1: Unit A — Repository Layer

- [x] 1.1 README.md tree (105–119): add `repositories/` between Services and Firestore; do NOT touch "Arquitectura General" diagram block (R1)
- [x] 1.2 SYSTEM_DESIGN.md tree (31–49), layers (54–149), data-flow (156–168), Responsabilidades (196–222): add `repositories/`; remove "Posibilidad futura" (251–256); do NOT touch "Arquitectura actual" diagram (17–25) (R6)
- [x] 1.3 docs/architecture/arquitectura.md Sec. 3 (32–38) + Sec. 8 (108–117): add `repositories → Acceso a Firestore`; remove CI from "Escalabilidad Futura" (R7)
- [x] 1.4 docs/ia/coding-rules.md `lib/` (53–59) + "Reglas Futuras" (216–225): update access layer to `repositories/`; remove CI from future rules (R7)
- [x] 1.5 docs/decisions/technical decisions.md (after entry 9, line 118): append ADR 10 (repository pattern) and ADR 11 (CI/CD) — `### N. Title` + `**Contexto**`/`**Decisión**`/`**Consecuencias**` (R5)
- [x] 1.6 CHANGELOG.md: add `### Capa Repository` (PRs #4–8), `### Suite de Testing` (PR #21), `### CI/CD` (PR #22) under `## Agregado`; remove CI/CD from `## Planeado` (R4)
- [x] 1.7 ROADMAP.md Fase 9 (343–438) + status block (557–567): mark repo migration, testing, CI/CD as completed (R3)

## Phase 2: Unit B — Testing/CI

- [x] 2.1 docs/testing/testing-strategy.md: full rewrite per design outline (13 sections, educational Spanish, structure over exact counts); include repo suites + helpers + CI; remove PENDIENTE/"futuro cercano" (R2)
- [x] 2.2 README.md Testing section (122–137): replace with "Testing y CI" — `npm test`, `npm run test:ci`, suite overview, `.github/workflows/ci.yml` (R1)
- [x] 2.3 CONTRIBUTING.md Testing (376–384) + "Objetivos a largo plazo" (409–418): add test commands + CI PR gate; remove CI from long-term goals (R7)
- [x] 2.4 docs/ia/system-behavior.md "Comportamiento Futuro" (178–189): move CI/CD to a current-behavior section (R7)

## Phase 3: Verification

- [x] 3.1 Consistency: no remaining "Planeado/PENDIENTE/futuro" claims about testing, CI, or repository layer across the 10 files (proposal success criteria)
- [x] 3.2 Language audit: all 10 doc files in neutral/professional Spanish; technical terms in English only where established (R8)
- [x] 3.3 Scope guard: `git diff --name-only` — zero changes to DOMAIN_RULES.md, docs/database/*, docs/workflows/*, docs/api/api_documentation.md (R9)
- [x] 3.4 Diagram guard: `git diff README.md SYSTEM_DESIGN.md` shows no edits inside "Arquitectura General"/"Arquitectura actual" text blocks (deferred decision)