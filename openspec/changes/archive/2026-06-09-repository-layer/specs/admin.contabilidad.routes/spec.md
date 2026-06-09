# Delta for admin.contabilidad.routes

## MODIFIED Requirements

### Requirement: POST /admin/contabilidad/cerrar-mes

The route handler SHALL call `monthlyClosing.orchestrator.cerrarMes(mesAnio, adminUid)` instead of the removed `cierreMensual.cerrarMesContable(mesAnio)`. The `adminUid` SHALL be passed from `req.admin.uid` (populated by the `adminAuth` middleware).

(Previously: Called `cierreMensual.cerrarMesContable(mesAnio)` without `adminUid`)

#### Scenario: Route passes adminUid to orchestrator

- GIVEN an authenticated admin POST to `/admin/contabilidad/cerrar-mes` with `{ mesAnio }`
- WHEN the handler executes
- THEN it SHALL call `orchestrator.cerrarMes(mesAnio, req.admin.uid)`
- AND the response SHALL contain `{ ok: true, message, data }` with the orchestrator return value

#### Scenario: Orchestrator error returns 400

- GIVEN the orchestrator throws (e.g., month already frozen, missing data)
- WHEN the route handler catches it
- THEN the response SHALL be `{ ok: false, message: error.message }` with status 400
- AND the response shape SHALL be identical to the previous implementation

## REMOVED Requirements

### Requirement: cierreMensual Import

(Reason: The import `const { cerrarMesContable } = require("../services/cierreMensual.service")` is removed along with the file it references.)
(Migration: Replace with `const orchestrator = require("../services/monthlyClosing.orchestrator")`.)
