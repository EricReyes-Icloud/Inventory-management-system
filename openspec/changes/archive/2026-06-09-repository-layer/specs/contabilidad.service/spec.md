# Delta for contabilidad.service

## ADDED Requirements

### Requirement: Sole Writer of Historico_Mensual

The system MUST ensure `contabilidad.service.generarHistoricoMensual()` is the ONLY writer of `Historico_Mensual` documents. The broken `cierreMensual.service.js` SHALL be deleted. No other service SHALL write to this collection.

#### Scenario: Only one writer exists after migration

- GIVEN the codebase after migration
- WHEN searching for `setHistoricoMensual` calls
- THEN only `contabilidad.service.js` SHALL call it
- AND `cierreMensual.service.js` SHALL NOT exist

### Requirement: Metadata Fields on Historico_Mensual

`generarHistoricoMensual(mesAnio, adminUid)` SHALL include three additive metadata fields in the snapshot payload:
- `estado`: string — MUST be `"cerrado"`
- `generadoEn`: `Timestamp` — MUST be `admin.firestore.Timestamp.now()` or `new Date()`
- `generadoPor`: string — MUST be the `adminUid` parameter passed from the orchestrator

These fields SHALL be merged into the document alongside `totalProductos` and `cartonesVendidos`. The existing `contabilidad.repository.setHistoricoMensual()` already writes `estado` and `generadoEn`; `generadoPor` is the new addition.

(Previously: No `generadoPor` field; `adminUid` was not part of the function signature)

#### Scenario: Snapshot includes generadoPor

- GIVEN `generarHistoricoMensual("Enero 2026", "abc123")` is called
- WHEN the snapshot is written to Firestore
- THEN `Historico_Mensual/Enero 2026` SHALL contain `generadoPor: "abc123"`
- AND `estado` SHALL be `"cerrado"`
- AND `generadoEn` SHALL be a valid Date/Timestamp

#### Scenario: Metadata does not break existing readers

- GIVEN existing code reads `historico.totalProductos[categoria].total`
- WHEN the new metadata fields are present on the document
- THEN the existing read pattern SHALL continue to work unchanged
- AND the new fields SHALL be additive-only

## MODIFIED Requirements

None (existing `contabilidad.service/spec.md` requirements remain valid).

## REMOVED Requirements

None.
