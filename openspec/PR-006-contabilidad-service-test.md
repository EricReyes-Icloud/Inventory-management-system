# PR #6 — Validation guards and unit tests for contabilidad.service

## Description

The `generarHistoricoMensual` function in `contabilidad.service.js` had no input validation or idempotency protection. Missing `admin.uid` or `admin.nombre` would silently produce a malformed snapshot with broken metadata. Re-running the same `mesAnio` would overwrite the existing historical record with no warning — a data-loss vector.

This PR adds three validation guards at the top of `generarHistoricoMensual` (run before any Firestore read) and introduces a full unit test suite at `backend/tests/unit/services/contabilidad.test.ts` with 10 tests covering exports, validation, duplicate rejection, happy path, empty data, missing SKUs, and error propagation.

## Changes Made

### Features

- **`backend/src/services/contabilidad.service.js`** — Added 3 validation guards to `generarHistoricoMensual`:
  - `admin.uid` presence check — throws `"admin.uid es obligatorio"` if missing
  - `admin.nombre` presence check — throws `"admin.nombre es obligatorio"` if missing
  - Duplicate `mesAnio` guard — calls `contabilidadRepo.getHistoricoMensual(mesAnio)` before any category reads, throws `"El histórico para {mesAnio} ya fue generado"` if a snapshot already exists

### Dev tooling

- **`backend/tests/unit/services/contabilidad.test.ts`** — New test file with 10 tests:
  - Exports surface (3 exports, 2 delegation checks)
  - Admin validation (missing uid, missing nombre)
  - Duplicate `mesAnio` rejection
  - Happy path full snapshot with metadata verification
  - Empty data returns `{}`
  - Missing SKUs defaults to `{}`
  - Error propagation from repository layer

## Impact

- **Data integrity**: Re-running `generarHistoricoMensual` for an existing month now fails fast with a clear error instead of silently overwriting the record.
- **Metadata correctness**: Admin uid and nombre are validated before any writes, preventing malformed snapshots.
- **Test coverage**: 10/10 tests passing with full coverage of the exported surface — guards, success path, edge cases, and error propagation.
- **Backward compatible**: No public API changes. All existing callers already pass well-formed admin objects (the route middleware provides `{ uid, nombre, email }`). No changes to orchestrator, routes, or existing tests.

## Notes

- Run tests with: `npx vitest run tests/unit/services/contabilidad.test.ts`
- Strict TDD was followed: tests written first (RED), then guards implemented (GREEN).
- The `getHistoricoMensual` method already existed in the repository layer — it was used by `ganancias.service.js` and only needed the guard wiring.
