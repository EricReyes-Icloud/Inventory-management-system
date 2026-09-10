# Exploration: update-testing-docs

## Current State

The repository has two documented fronts that lag behind the real code:

**1. Testing documentation.** The real system ships a working suite of **16 test files / ~134 test cases** in `backend/tests/` (unit: utils x2, services x3, job x1, repositories x5; integration: ventas, jobContable; flow: flujoCompleto; helpers: paths, secrets-bootstrap), plus a live GitHub Actions pipeline in `.github/workflows/ci.yml` (PR + push to main/develop, Node 22, `npm ci` + `npm run test:ci`). However, `docs/testing/testing-strategy.md` still shows Job Contable, Services, Integration and Flow as `PENDIENTE`, and ROADMAP/CHANGELOG list CI/CD as "Planeado" (future) even though the CI workflow was committed on 2026-09-08 (`4c4f646`).

**2. Repository layer documentation.** The codebase evolved to a repository layer (`backend/src/repositories/` — 5 files: admin, contabilidad, contable, productos, ventas) that decouples Firestore access from business logic (migration completed per git history: "Phase 4 of the migration to the Repository layer is complete", `2a317a4`). Almost no document mentions it: SYSTEM_DESIGN.md describes a repository layer as a *future possibility*, README/SYSTEM_DESIGN architecture diagrams still show `Services → Firestore` directly, and README/arquitectura structure trees omit `repositories/`.

## Affected Areas

| Document | Why affected |
|---|---|
| `README.md` | Structure tree omits `repositories/`; architecture diagram lacks repository layer; Testing section has no test commands, no suite breakdown, no CI mention |
| `ROADMAP.md` | Fase 9 status block claims testing "En progreso" and CI/CD "Planeado" — both done; repository layer work (refactor) not recorded as a completed phase/priority |
| `SYSTEM_DESIGN.md` | Frames repository layer as "Posibilidad futura"; layer list + tree + data-flow diagram omit `repositories/` |
| `CHANGELOG.md` | CI/CD under "## Planeado"; no entries for repository layer migration, CI pipeline, or test-suite stabilization |
| `CONTRIBUTING.md` | Recommends testing before merge but documents no commands and no CI PR gate; CI listed as future goal |
| `docs/testing/testing-strategy.md` | **Most stale doc** — "Qué falta testear" list is entirely done; "Estado actual" diff shows Job/Services/Integration/Flow as PENDIENTE; no repositories tests, no helpers, no CI section (still "futuro cercano") |
| `docs/architecture/arquitectura.md` | Layer list (`routes/services/jobs/lib`) omits `repositories/`; CI/CD under "Escalabilidad Futura" |
| `docs/decisions/technical decisions.md` | No ADR entries for the repository-layer decision or the CI adoption |
| `docs/ia/coding-rules.md` | Describes `lib/` as the Firestore access layer; rules predate `repositories/` and should reference it |
| `docs/ia/system-behavior.md` | CI/CD listed under "Comportamiento Futuro Esperado" — now present |
| `docs/api/api_documentation.md` | (optional) "## Testing" section is generic; could reference concrete endpoint tests |

**Not affected:** `DOMAIN_RULES.md` (business rules, no testing/repo/CI content), `docs/database/database_schema.md`, `docs/database/modelo-datos.md`, `docs/workflows/*` (business flows, accurate enough), `docs/ia/business-context.md`, `docs/ia/project-goals.md` (generic objectives).

## Staleness Inventory (per document)

### 1. `README.md`
- Testing: **YES** — generic list only ("Procesamiento contable, Validaciones de pedidos, Reglas de inventario, Casos límite operativos"). No commands, no count, no CI.
- Repository: **NO** — architecture diagram: `Services Layer → Firebase Firestore` (repositories missing). Tree shows only `services/, routes/, utils/, tests/`.
- CI: **NO** mention.
- Missing: test commands (`npm test`, `npm run test:ci`), suite structure, CI workflow reference, `repositories/` in tree/diagram.

### 2. `ROADMAP.md`
- Testing: **YES** — Fase 9 "Prioridad 01 — Pruebas automatizadas" as *current work*; "Estado actual" says `Testing Automatizado: En progreso` — stale (suite exists, CI green).
- Repository: **NO** — Fase 9 "Prioridad 02": "Se planean mejoras orientadas a: … Desacoplamiento de Firestore" — stale; that migration is done.
- CI: **YES, STALE** — "Planes futuros: Implementar GitHub Actions" and `CI/CD: Planeado` in the final status block — workflow exists since 2026-09-08.

### 3. `SYSTEM_DESIGN.md`
- Testing: **YES** — "Estrategia de Testing" (Vitest, generic objectives); responsibilities table lists Tests generically. Accurate but thin.
- Repository: **PARTIAL, STALE** — "Acceso a datos desacoplado: … Posibilidad futura de migrar infraestructura a traves de una capa `repository`" — the layer already exists (`backend/src/repositories/`). Tree and data-flow diagram omit it.
- CI: **NO** mention.

### 4. `CHANGELOG.md`
- Testing: **YES, STALE** — "### Testing: Configuración inicial de Vitest / Inicio de testing automatizado"; "## En Progreso: Testing" — no entries for the completed suite (services, job, integration, flow, repositories tests, fix-test-suite).
- Repository: **NO** — "Refactorizado" only mentions separation from routes; repository-layer migration missing.
- CI: **YES, STALE** — "## Planeado: Infraestructura: CI/CD, GitHub Actions, Pipelines de integración" — already implemented; status block `CI/CD: Planeado`.

### 5. `CONTRIBUTING.md`
- Testing: **YES** — "Pruebas de Testing previas a la fusión" (generic checklist). No concrete commands; CI/gate not described.
- Repository: **NO**.
- CI: **PARTIAL, STALE** — "Objetivos a largo plazo: Integración continua completa / Pipelines automatizados" — CI now runs on every PR via GitHub Actions.

### 6. `docs/testing/testing-strategy.md` — MOST STALE
- Testing: **YES, HEAVILY STALE**:
  - "Qué ya está testeado" covers only `normalizarTexto` + `obtenerCategoria` (utils).
  - "Qué falta testear" — **all four priorities are now DONE**:
    - PRIORIDAD 1 jobContable.rules → exists (`tests/unit/job/jobContable.rules.test.ts`)
    - PRIORIDAD 2 contabilidad service → exists + 2 more service suites (`ganancias.service`, `monthlyClosing.orchestrator`)
    - PRIORIDAD 3 integration (`ventas`, `jobContable`) → both exist
    - PRIORIDAD 4 flow (`flujoCompleto`) → exists
  - "Estado actual" diff block: `- Job Contable → PENDIENTE / - Services → PENDIENTE / - Integration → PENDIENTE / - Flow → PENDIENTE` — **factually wrong today**.
- Repository: **NO** — no mention of the 5 repository test suites.
- CI: **YES, STALE** — "CI/CD (futuro cercano): Se integrará GitHub Actions…" — integrated (`.github/workflows/ci.yml`).
- Missing: helpers (`firestoreMock`), test commands, suite inventory (16 files / ~134 cases), repository-layer tests.

### 7. `docs/architecture/arquitectura.md`
- Testing: **NO**.
- Repository: **NO** — layers listed: `routes, services, jobs, lib` only.
- CI: **YES, STALE** — "Implementar CI/CD" under "8. Escalabilidad Futura" — done.
- Missing: repository layer, testing existence.

### 8. `docs/decisions/technical decisions.md`
- Testing: **YES** — decision 3 mentions "Permitir testing futuro" (historical, fine).
- Repository: **NO** — no ADR for the repository-pattern migration (a major decision).
- CI: **YES, STALE** — "9. Preparación para Escalabilidad: Implementar CI/CD" — done.
- Missing: ADR entries for repository layer + CI adoption.

### 9. `docs/ia/coding-rules.md`
- Testing: **YES** — "Reglas de Testing" (testeable/mocking/aislamiento) — accurate, generic.
- Repository: **NO** — `lib/` still described as the Firestore access layer ("Conexión Firestore, Configuración infraestructura"); "No duplicar lógica Firestore" rule predates `repositories/`.
- CI: **YES, STALE** — "Reglas Futuras Planeadas: … CI/CD" — now present.

### 10. `docs/ia/system-behavior.md`
- Testing: **YES** — "El sistema debe ser testeable" (general) — accurate.
- Repository: **NO**.
- CI: **YES, STALE** — "Comportamiento Futuro Esperado: CI/CD automatizado" — done.

### 11. `docs/api/api_documentation.md`
- Testing: **YES** — "Los endpoints críticos cuentan con testing automatizado" — generic but accurate; could name the actual endpoint suites (`ventas`, `jobContable`, `flujoCompleto`). Optional enhancement, not stale per se.
- Repository: **NO** — out of scope for an API doc.
- CI: **NO**.

### 12. `docs/database/*`, `docs/workflows/*`, `DOMAIN_RULES.md`, `docs/ia/business-context.md`, `docs/ia/project-goals.md`
- No testing/repository/CI staleness relevant to this change. Leave untouched.

## Approaches

1. **A: Update existing docs only (minimal footprint)**
   - Pros: Smallest diff; fast; respects review budget.
   - Cons: Leaves gaps (README has no testing/CI section, strategy doc needs near-rewrite anyway); "update only" still forces a full rewrite of testing-strategy.md so savings are illusory; no consolidated home for CI/testing info.
   - Effort: Medium

2. **B: Update existing docs + create one consolidated testing/CI section** *(recommended)*
   - Pros: Fixes every stale claim; adds a single canonical "Testing & CI" section (README) describing the real suite (16 files/~134 tests, commands, CI workflow); rewrites testing-strategy.md to reflect the completed matrix incl. repository tests; consistent with the openspec `ci-pipeline` spec already archived.
   - Cons: Touches ~10 files; needs care to keep quotes/language consistent; slightly larger diff than A.
   - Effort: Medium

3. **C: Full documentation refresh**
   - Pros: Coherent corpus; also fixes out-of-scope drift (API docs, DB docs, workflows).
   - Cons: Much larger diff; scope creep beyond the two fronts; review budget (400-line) risk; churn in docs that are already accurate.
   - Effort: High

## Recommendation

**Approach B.** The staleness is factual (future claims that are done, pending items that are done), so A's "minimal" path still requires rewriting testing-strategy.md and touching 5+ files — same surface, less structure. C adds churn without value for this change. B delivers: (1) every stale "Planeado/PENDIENTE/futuro" claim corrected, (2) `repositories/` added to architecture diagrams/trees/layer lists + an ADR in technical decisions, (3) one consolidated Testing & CI section (README) + a rewritten testing-strategy.md grounded in the 16-file/134-case reality, including the 5 repository test suites and the CI workflow. Suggest the proposal puts repo-layer doc updates in one task group and testing/CI doc updates in another, each with its own commit.

## Risks

- **Language consistency**: Docs are in Spanish; keep doc edits in neutral/professional Spanish, SDD artifacts (proposal/spec/etc.) in English per the artifact language contract.
- **Stale-count drift**: The 16 files / ~134 cases figure is a snapshot; verify at apply time and prefer describing *structure* over exact counts.
- **Leftover openspec folder**: `openspec/changes/repository-layer/` exists un-archived alongside `openspec/changes/archive/2026-06-09-repository-layer/` — reconcile before archive to avoid confusion.
- **Scope discipline**: Avoid rewriting DB/API/workflow docs that are already accurate; keep the diff focused on the two fronts.
- **Review budget**: ~10 files is within the 400-line budget only if edits stay surgical — flag chained PRs (docs per front) if the diff grows.

## Ready for Proposal

**Yes.** The orchestrator should tell the user: the change is well-scoped; testing docs are stale in 6 documents (strategy doc claims 4 pending areas that are done; 3 docs claim CI/CD is planned when the workflow exists), and the repository layer is absent from every architecture doc (SYSTEM_DESIGN even calls it a future possibility). Recommended path: Approach B — update ~10 docs + add a consolidated Testing & CI section in README + rewrite testing-strategy.md to the real suite inventory. No new standalone docs required.