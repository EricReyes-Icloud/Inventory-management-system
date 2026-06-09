# Delta for cierreMensual.service

## REMOVED Requirements

### Requirement: cerrarMesContable Entry Point

(Reason: The file `backend/src/services/cierreMensual.service.js` has two blocking bugs — it uses `db` directly instead of the repository AND references an undefined `contabilidadRepo` variable. Its sole function `cerrarMesContable(mesAnio)` is functionally duplicated by `contabilidad.service.generarHistoricoMensual()`. The proposal deletes this file and absorbs its intent into the orchestrator pipeline.)
(Migration: All references to `cierreMensual.cerrarMesContable()` SHALL be replaced with `orchestrator.cerrarMes(mesAnio, adminUid)`. The route `POST /admin/contabilidad/cerrar-mes` SHALL call the orchestrator instead.)

| Consumer | Current call | Replacement |
|---|---|---|
| `admin.contabilidad.routes.js` | `cierreMensual.cerrarMesContable(mesAnio)` | `orchestrator.cerrarMes(mesAnio, adminUid)` |

### Requirement: Flat Schema Historico_Mensual Writer

(Reason: The flat `{ totalProductos: { total: N } }` schema written by this service is incompatible with the nested `{ totalProductos: { categoria: { total: N, skus: {...} } } }` schema that `ganancias.service.js` expects. The nested schema writer in `contabilidad.service.js` is the canonical one.)
(Migration: No migration needed — the flat schema was never successfully written because the file is broken. The canonical nested schema in `contabilidad.service.js` is the only active writer.)

### Requirement: Module Exports

(Reason: `cierreMensual.service.js` and its exports are deleted along with the file.)
(Migration: Remove the `require("../services/cierreMensual.service")` line from `admin.contabilidad.routes.js`. No other file imports this module.)
