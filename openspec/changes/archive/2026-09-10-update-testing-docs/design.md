# Design: update-testing-docs

## Technical Approach

Documentation-only change updating 10 existing files across two fronts: (1) repository layer absence from architecture docs, (2) testing/CI staleness. No code changes. All user-facing prose in neutral/professional Spanish. SDD artifacts in English. Two commit units keep diffs reviewable within the 400-line budget.

## Architecture Decisions

### Decision: Two Commit Units (A: repo-layer, B: testing/CI)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Single commit | Simple but >400 lines likely, hard to review | Rejected |
| Per-file commits | 10 tiny commits, noisy history | Rejected |
| Two thematic groups | Each diff self-contained, reviewable, independently revertible | **Chosen** |

**Unit A** — Repository layer: README tree/diagram, SYSTEM_DESIGN layers/tree/dataflow, arquitectura layers, coding-rules Firestore reference, technical decisions ADRs, CHANGELOG repo entries, ROADMAP repo status. ~120 lines.

**Unit B** — Testing/CI: testing-strategy.md full rewrite, README Testing y CI section, CONTRIBUTING test commands + CI gate, system-behavior CI section, CHANGELOG test/CI entries, ROADMAP test/CI status. ~200 lines (testing-strategy rewrite is bulk).

### Decision: ADR Format for technical decisions.md

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Formal ADR template (Status/Context/Decision/Consequences) | Heavyweight, breaks existing casual tone | Rejected |
| Match existing `### N. Title` style | Consistent but lacks structured fields | Partially |
| Lightweight ADR with header metadata | Structured enough for traceability, stays concise | **Chosen** |

Format: `### N. Title` (continues existing numbering from 9), then body with explicit sub-sections `**Contexto**`, `**Decisión**`, `**Consecuencias**`. No "Status" field — all entries are accepted by definition. This matches the project's preference for concise docs while adding enough structure for future reference.

### Decision: Architecture Diagrams Deferred (Scope Constraint)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Update diagrams inline | Quick but produces legacy plain-text diagram | Rejected |
| Regenerate diagrams with archify skill in this session | Better but expands scope beyond written docs | Rejected |
| **Defer diagrams to next session with archify skill** | Diagrams stay stale this session; written text becomes current | **Chosen** (user decision) |

The architecture diagrams (the `text` blocks with arrows in README "Arquitectura General" and SYSTEM_DESIGN "Arquitectura actual") are NOT modified in this session. The user owns a separate skill (`archify`) that generates dynamic HTML/SVG architecture diagrams and will regenerate them in the following session. This change updates only written documentation: layer lists, trees, responsibilities, ADRs, status blocks, testing guides. The deferred diagram work is tracked in Engram (decision obs 523).

### Decision: CHANGELOG Entry Style

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Conventional-commits with dates/PRs | Precise but existing changelog has no dates or PR refs | Rejected |
| Match existing bullet-point style under Agregado | Consistent, fast | **Chosen** |

Three entries added under `## Agregado` as new sub-sections: `### Capa Repository`, `### Suite de Testing`, `### CI/CD`. Each uses bullet points describing what was done, referencing PRs parenthetically (e.g., "(PRs #4–8)"). CI/CD moved from `## Planeado` to `## Agregado`.

## File Changes

### Unit A — Repository Layer Docs

| File | Section(s) to Change | Lines ± | What |
|------|---------------------|---------|------|
| `README.md` | Tree (line 105–119) | +4 | Add `repositories/` to tree. DIAGRAM DEFERRED — do NOT touch "Arquitectura General" `text` block |
| `SYSTEM_DESIGN.md` | Tree (line 31–49), layer list (line 54–149), data-flow text (line 156–168), "Posibilidad futura" (line 251–256), Responsabilidades (line 196–222) | +18 | Add `repositories/` layer to tree/layers/data-flow text, remove "Posibilidad futura", add Repositories to responsibilities. DIAGRAM ("Arquitectura actual" `text` block, line 17–25) DEFERRED — do NOT touch |
| `docs/architecture/arquitectura.md` | Section 3 (line 32–38), Section 8 (line 108–117) | +4 | Add `repositories → Acceso a Firestore` to layer list; remove CI from "Escalabilidad Futura" |
| `docs/ia/coding-rules.md` | `lib/` section (line 53–59), "Reglas Futuras" (line 216–225) | +3 | Change `lib/` description to `repositories/` as Firestore access; remove CI from future rules |
| `docs/decisions/technical decisions.md` | Append after entry 9 (line 118) | +30 | Add ADR 10 (repository pattern) + ADR 11 (CI/CD adoption) |
| `CHANGELOG.md` | Under `## Agregado` (after line 110), `## Planeado` CI section (line 217–225) | +12, −6 | Add 3 entries under Agregado; remove CI/CD from Planeado |
| `ROADMAP.md` | Fase 9 sections (line 343–438), status block (line 557–567) | +6, −4 | Mark testing/CI/repo as completed; update status block |

### Unit B — Testing/CI Docs

| File | Section(s) to Change | Lines ± | What |
|------|---------------------|---------|------|
| `docs/testing/testing-strategy.md` | Full file rewrite | ~180 (replace 224) | Educational guide: intro, category-by-category walkthrough, CI section, commands |
| `README.md` | Testing section (line 122–137) | +25, −12 | Replace generic Testing with consolidated "Testing y CI" section |
| `CONTRIBUTING.md` | Testing section (line 376–384), "Objetivos a largo plazo" (line 409–418) | +10, −6 | Add concrete commands, CI gate; remove CI from long-term goals |
| `docs/ia/system-behavior.md` | "Comportamiento Futuro" (line 178–189) | +4, −1 | Move CI/CD from "Futuro" to a new "Comportamiento Actual" section |
| `CHANGELOG.md` | (already modified in Unit A) | 0 | No additional changes — test/CI entries already placed in Unit A's CHANGELOG edit |
| `ROADMAP.md` | (already modified in Unit A) | 0 | No additional changes |

## Content Outlines

### README "Testing y CI" Section (Spanish)

```
## Testing y CI

### Cómo ejecutar tests
- `npm test` — ejecutar suite completa
- `npm run test:ci` — ejecución para CI (sin watch)

### Suite de testing
- Unit tests: utils, services, jobs, repositories
- Integration tests: ventas, job contable
- Flow test: flujo completo (pedido → contabilidad)
- Helpers: mock de Firestore, utilidades de paths

### CI/CD
- GitHub Actions ejecuta tests en cada PR y push a main/develop
- Workflow: `.github/workflows/ci.yml`
- Node 22, `npm ci` + `npm run test:ci`
- Gate: PRs no se合并 sin tests pasando
```

### testing-strategy.md Outline (Spanish, Educational)

1. **Objetivo** — what this doc covers and why testing matters for this system
2. **Cómo ejecutar los tests** — commands, watch mode, CI mode
3. **Estructura de la suite** — directory layout (`backend/tests/` with unit/integration/flow/helpers)
4. **Unit Tests — Utils** — normalizarTexto, obtenerCategoria: what they test and why
5. **Unit Tests — Services** — contabilidad, ganancias, monthlyClosing: financial integrity
6. **Unit Tests — Jobs** — jobContable.rules: business rule protection
7. **Unit Tests — Repositories** — 5 suites testing Firestore access layer decoupling
8. **Integration Tests** — ventas + jobContable: endpoint validation with mocked Firestore
9. **Flow Tests** — flujoCompleto: end-to-end logical flow
10. **Helpers** — firestoreMock, paths: shared test infrastructure
11. **CI/CD** — GitHub Actions workflow, what it validates, PR gate
12. **Qué NO testear** — external SDK, Express internals, libraries (keep existing)
13. **Uso de IA en testing** — keep existing section, update tone

Each section: file name, what it covers (plain language), why that area matters (business rationale), key scenarios tested.

### CHANGELOG Entry Format

```markdown
### Capa Repository
- Migración de acceso directo a Firestore hacia capa `repositories/`
- Creación de módulos: admin, contabilidad, contable, productos, ventas (PRs #4–8)
- Desacoplamiento de services del acceso a datos

### Suite de Testing
- Suite completa de testing automatizado: ~16 archivos, unit/integration/flow
- Cobertura de services, jobs, repositories, integración y flujo completo (PR #21)

### CI/CD
- Pipeline de integración continua con GitHub Actions (PR #22)
- Ejecución automática de tests en PR y push a main/develop
```

## Language & Tone

- All 10 docs: neutral/professional Spanish. No slang, no regionalism. Present tense for current state, future tense only for genuinely planned items.
- Technical terms in English where the project already uses them (e.g., "repositories", "services", "Firestore", "CI/CD", "PR") — consistent with existing docs.
- testing-strategy.md educational tone: second-person ("vas a encontrar", "esto valida"), explanatory, avoids jargon without explanation.

## Verification Strategy

| Requirement | Grep / Check | Pass Criterion |
|-------------|-------------|----------------|
| R1 README repos + testing section | `grep -c "repositories" README.md` + `grep "Testing y CI" README.md` | ≥1 repo mention, section exists |
| R2 testing-strategy no PENDIENTE | `grep -c "PENDIENTE" docs/testing/testing-strategy.md` | = 0 |
| R3 ROADMAP status correct | `grep "Testing Automatizado" ROADMAP.md` + `grep "CI/CD" ROADMAP.md` | No "En progreso" or "Planeado" for these |
| R4 CHANGELOG entries | `grep "repositories\|PRs #4\|PR #21\|PR #22" CHANGELOG.md` | All three present; CI not under Planeado |
| R5 ADRs present | `grep "### 10\.\|### 11\." docs/decisions/technical decisions.md` | Both exist |
| R6 SYSTEM_DESIGN repos | `grep "repositories" SYSTEM_DESIGN.md` + `grep -c "Posibilidad futura" SYSTEM_DESIGN.md` | repos present, "Posibilidad futura" count = 0 for repository context |
| R7 Supporting docs | grep for `repositories` in arquitectura, coding-rules; `CI/CD` NOT in "Futuro" sections of coding-rules, system-behavior | Correct placement |
| R8 Language | Manual review: no English prose in doc files (technical terms OK) | Neutral Spanish |
| R9 Out-of-scope untouched | `git diff --name-only` | Zero changes to DOMAIN_RULES.md, docs/database/*, docs/workflows/* |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. Documentation-only; no data, no runtime, no feature flags.

## Open Questions

- None. All inputs read; all constraints fixed; design is actionable.
