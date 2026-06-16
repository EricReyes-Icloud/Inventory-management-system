# Delta for monthly-closing-orchestrator

## MODIFIED Requirements

### Requirement: Pipeline Entry Point

The system MUST expose `cerrarMes(mesAnio, admin)` as the sole entry point for admin-triggered month closing. `mesAnio` SHALL be a string like `"Enero 2026"`. `admin` SHALL be an object with at minimum `{ uid, nombre }` where `uid` is the Firebase Auth UID and `nombre` is the human-readable admin display name.

(Previously: Exposed `cerrarMes(mesAnio, adminUid)` where `adminUid` was a string)

#### Scenario: Happy path — full pipeline with admin nombre in audit

- GIVEN a valid `mesAnio` with pending processed data and a valid `admin` object `{ uid, nombre }`
- WHEN `cerrarMes(mesAnio, admin)` is called
- THEN the pipeline SHALL execute in order: pending orders → snapshot → earnings → audit
- AND the function SHALL return `{ mesAnio, snapshot, ganancias, audit }` with non-null values
- AND the audit record SHALL contain a `generadoPor` field set to `admin.nombre`

#### Scenario: Missing mesAnio throws early

- GIVEN `mesAnio` is `null`, `undefined`, or empty
- WHEN `cerrarMes(mesAnio, admin)` is called
- THEN the function SHALL throw an error with message `"mesAnio es obligatorio"`

### Requirement: Pipeline Ordering

The orchestrator MUST execute stages in strict sequence: (1) process pending orders via `jobContableMensual.processPendingOrders()`, (2) `contabilidadService.generarHistoricoMensual(mesAnio, admin.uid)`, (3) `gananciasService.cerrarGananciasPorCategoria(mesAnio)`, (4) `adminActionsService.registrarCierre(mesAnio, admin.uid, snapshot, ganancias)`. The orchestrator SHALL additionally extract `admin.nombre` and pass it to stage 4 for storage as the audit trail field `generadoPor`. Each stage SHALL await the previous one before starting.

(Previously: Stages 2 and 4 used a plain `adminUid` string. Stage 4 did not receive `admin.nombre`.)

#### Scenario: Pending orders processed before snapshot

- GIVEN there are unprocessed order items for the month
- WHEN `cerrarMes` reaches stage 1
- THEN `jobContableMensual.processPendingOrders()` SHALL be called
- AND only after it resolves SHALL stage 2 begin

### Requirement: Idempotency

The orchestrator MUST be safe to re-run for the same `mesAnio`. Re-execution SHALL overwrite the existing `Historico_Mensual` snapshot, recalculate earnings from the frozen snapshot, and merge-set the audit record (non-destructive update). The `generadoPor` field SHALL be updated on re-run to reflect the current admin's `nombre`.

(Previously: No `generadoPor` field was updated on re-run.)

#### Scenario: Re-run overwrites snapshot and updates generadoPor

- GIVEN `Historico_Mensual/{mesAnio}` already exists from a previous run by a different admin
- WHEN `cerrarMes(mesAnio, currentAdmin)` is called again
- THEN stage 2 SHALL overwrite the document with new `estado`/`generadoEn`/`generadoPor`
- AND stage 3 SHALL recalculate earnings from the new snapshot
- AND the audit record's `generadoPor` SHALL be updated to `currentAdmin.nombre`
- AND no duplicate audit records SHALL be created (merge-set)

## REMOVED Requirements

None.
