# Apply Progress: update-testing-docs

## Completed Tasks

### Phase 1: Unit A — Repository Layer (Committed: 71f2bc9)

- [x] 1.1 README.md tree: added `repositories/` between Services and Firestore
- [x] 1.2 SYSTEM_DESIGN.md: added repositories layer to tree, layers, data-flow text, responsibilities; removed "Posibilidad futura"
- [x] 1.3 arquitectura.md: added `repositories → Acceso a Firestore` to layer list; removed CI from "Escalabilidad Futura"
- [x] 1.4 coding-rules.md: updated `lib/` to `repositories/` as Firestore access; removed CI from future rules
- [x] 1.5 technical decisions.md: appended ADR 10 (repository pattern) + ADR 11 (CI/CD adoption)
- [x] 1.6 CHANGELOG.md: added Capa Repository, Suite de Testing, CI/CD under Agregado; removed CI from Planeado
- [x] 1.7 ROADMAP.md: marked testing/CI/repo as completed in status block

### Phase 2: Unit B — Testing/CI (Committed: f3671a5)

- [x] 2.1 testing-strategy.md: full educational rewrite (~180 lines, 13 sections)
- [x] 2.2 README.md: replaced Testing section with "Testing y CI" consolidated section
- [x] 2.3 CONTRIBUTING.md: added concrete test commands + CI gate; removed CI from long-term goals
- [x] 2.4 system-behavior.md: moved CI/CD from "Futuro" to current-behavior section

### Phase 3: Verification

- [x] 3.1 Consistency: no remaining PENDIENTE/futuro claims about testing, CI, or repository layer
- [x] 3.2 Language audit: all 10 doc files in neutral/professional Spanish
- [x] 3.3 Scope guard: zero changes to out-of-scope files (DOMAIN_RULES.md, docs/database/*, docs/workflows/*)
- [x] 3.4 Diagram guard: README "Arquitectura General" and SYSTEM_DESIGN "Arquitectura actual" text blocks show zero diff

## Verification Evidence (R1–R9)

| Requirement | Check | Result |
|-------------|-------|--------|
| R1 README repos + testing | `grep -c "repositories" README.md` → 2; `grep "Testing y CI" README.md` → found | PASS |
| R2 testing-strategy no PENDIENTE | `grep -c "PENDIENTE" docs/testing/testing-strategy.md` → 0 | PASS |
| R3 ROADMAP status | `grep "Testing Automatizado" ROADMAP.md` → Completado; `grep "CI/CD" ROADMAP.md` → Completado | PASS |
| R4 CHANGELOG entries | `grep "repositories\|PRs #4\|PR #21\|PR #22" CHANGELOG.md` → all present; CI not under Planeado | PASS |
| R5 ADRs present | `grep "### 10\.\|### 11\." docs/decisions/technical decisions.md` → both exist | PASS |
| R6 SYSTEM_DESIGN repos | `grep -c "repositories" SYSTEM_DESIGN.md` → 3; `grep -c "Posibilidad futura" SYSTEM_DESIGN.md` → 0 | PASS |
| R7 Supporting docs | `grep "repositories" arquitectura.md` → found; `grep "repositories" coding-rules.md` → found; CI/CD not in "Futuro" sections | PASS |
| R8 Language | All doc files in neutral/professional Spanish; technical terms in English where established | PASS |
| R9 Out-of-scope untouched | `git diff --name-only HEAD~2` → only 10 expected files | PASS |

## Work Unit Evidence

| Evidence | Value |
|----------|-------|
| Focused test command | `grep -c "repositories" README.md SYSTEM_DESIGN.md` → ≥1 each |
| Runtime harness | N/A — docs-only, no runtime |
| Rollback boundary | Revert commits 71f2bc9 (Unit A) or f3671a5 (Unit B) |

## Commits

- `71f2bc9` docs: update repository layer documentation across architecture and planning docs
- `f3671a5` docs: rewrite testing strategy and update CI/CD documentation
