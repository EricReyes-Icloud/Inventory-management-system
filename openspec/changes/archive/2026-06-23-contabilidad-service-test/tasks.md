# Tasks: contabilidad-service-test

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~315 (15 prod + ~300 test) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

```
Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
```

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | All changes (prod + test) | Single PR | Under budget, single scope |

## Phase 1: RED — Write Test Scenarios (TDD)

- [x] 1.1 Create `backend/tests/unit/services/contabilidad.test.ts` with `Module._cache` mock for `contabilidad.repository` following `ganancias.service.test.ts` pattern
- [x] 1.2 Write export surface tests: exactly 3 exports (`generarHistoricoMensual`, `obtenerCategoria`, `buildOperacionesContables`), all functions; delegation checks match repo references
- [x] 1.3 Write admin validation tests: missing `uid` and missing `nombre` each throw before any repo calls
- [x] 1.4 Write duplicate `mesAnio` test: existing snapshot → throws, `setHistoricoMensual` never called
- [x] 1.5 Write happy path (full snapshot with metadata), empty data (returns `{}`), missing SKUs (defaults to 0), and error propagation tests

## Phase 2: GREEN — Implement Validation Guards

- [x] 2.1 Add `admin.uid` and `admin.nombre` falsy guards at top of `generarHistoricoMensual` — throw `Error("admin.uid es obligatorio")` / `Error("admin.nombre es obligatorio")`
- [x] 2.2 Add duplicate `mesAnio` guard via `contabilidadRepo.getHistoricoMensual(mesAnio)` — throw if snapshot exists, before any category reads
