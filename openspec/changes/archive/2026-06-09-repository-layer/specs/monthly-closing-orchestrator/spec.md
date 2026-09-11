# Monthly Closing Orchestrator Specification

## Purpose

The monthly-closing orchestrator provides a single `cerrarMes(mesAnio, adminUid)` entry point that coordinates the 4-stage pipeline: process pending orders → snapshot earnings → calculate per-category gains → record audit trail. It makes the closing flow idempotent and recoverable by re-execution.

## Requirements

### Requirement: Pipeline Entry Point

The system MUST expose `cerrarMes(mesAnio, adminUid)` as the sole entry point for admin-triggered month closing. `mesAnio` SHALL be a string like `"Enero 2026"`. `adminUid` SHALL be the Firebase Auth UID from the verified admin token.

#### Scenario: Happy path — full pipeline executes

- GIVEN a valid `mesAnio` with pending processed data and a valid `adminUid`
- WHEN `cerrarMes(mesAnio, adminUid)` is called
- THEN the pipeline SHALL execute in order: pending orders → snapshot → earnings → audit
- AND the function SHALL return `{ mesAnio, snapshot, ganancias, audit }` with non-null values

#### Scenario: Missing mesAnio throws early

- GIVEN `mesAnio` is `null`, `undefined`, or empty
- WHEN `cerrarMes(mesAnio, adminUid)` is called
- THEN the function SHALL throw an error with message `"mesAnio es obligatorio"`

### Requirement: Pipeline Ordering

The orchestrator MUST execute stages in strict sequence: (1) process pending orders via `jobContableMensual.processPendingOrders()`, (2) `contabilidadService.generarHistoricoMensual(mesAnio, adminUid)`, (3) `gananciasService.cerrarGananciasPorCategoria(mesAnio)`, (4) `adminActionsService.registrarCierre(mesAnio, adminUid, snapshot, ganancias)`. Each stage SHALL await the previous one before starting.

#### Scenario: Pending orders processed before snapshot

- GIVEN there are unprocessed order items for the month
- WHEN `cerrarMes` reaches stage 1
- THEN `jobContableMensual.processPendingOrders()` SHALL be called
- AND only after it resolves SHALL stage 2 begin

### Requirement: Idempotency

The orchestrator MUST be safe to re-run for the same `mesAnio`. Re-execution SHALL overwrite the existing `Historico_Mensual` snapshot, recalculate earnings from the frozen snapshot, and merge-set the audit record (non-destructive update).

#### Scenario: Re-run overwrites snapshot

- GIVEN `Historico_Mensual/{mesAnio}` already exists from a previous run
- WHEN `cerrarMes(mesAnio, adminUid)` is called again
- THEN stage 2 SHALL overwrite the document with new `estado`/`generadoEn`/`generadoPor`
- AND stage 3 SHALL recalculate earnings from the new snapshot
- AND no duplicate audit records SHALL be created (merge-set)

### Requirement: Error Handling

If any stage throws, the orchestrator MUST catch the error, log the failed stage, and re-throw a descriptive error. The caller SHALL receive a clear failure message. Partial writes from a failed stage SHALL be recoverable by re-running `cerrarMes` for the same `mesAnio`.

#### Scenario: Snapshot stage fails

- GIVEN `contabilidadService.generarHistoricoMensual` throws
- WHEN the orchestrator catches it
- THEN the error SHALL be logged with stage identifier `"snapshot"`
- AND the error SHALL be re-thrown with the original message
- AND earnings/audit stages SHALL NOT execute

#### Scenario: Re-run recovers from partial failure

- GIVEN the pipeline failed at stage 3 after stage 2 wrote a snapshot
- WHEN the admin re-invokes `cerrarMes(mesAnio, adminUid)`
- THEN stages 1-2 SHALL succeed again (idempotent)
- AND stage 3 SHALL recalculate earnings from the (possibly updated) snapshot
