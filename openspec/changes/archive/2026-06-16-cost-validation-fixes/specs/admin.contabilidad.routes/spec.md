# Delta for admin.contabilidad.routes

## MODIFIED Requirements

### Requirement: POST /admin/contabilidad/cerrar-mes

The route handler SHALL call `monthlyClosing.orchestrator.cerrarMes(mesAnio, req.admin)` passing the full admin object (containing `.uid` and `.nombre`) instead of just `req.admin.uid`. The `req.admin` object SHALL be populated by the `adminAuth` middleware from the `Usuarios/Usuarios/Admin/{Admin}` document.

(Previously: Called `orchestrator.cerrarMes(mesAnio, adminUid)` passing `req.admin.uid` only)

#### Scenario: Route passes full admin object to orchestrator

- GIVEN an authenticated admin POST to `/admin/contabilidad/cerrar-mes` with `{ mesAnio }`
- WHEN the handler executes
- THEN it SHALL call `orchestrator.cerrarMes(mesAnio, req.admin)`
- AND `req.admin` SHALL contain at minimum `{ uid, nombre }`
- AND the response SHALL contain `{ ok: true, message, data }` with the orchestrator return value

#### Scenario: Orchestrator error returns 400

- GIVEN the orchestrator throws (e.g., month already frozen, missing data)
- WHEN the route handler catches it
- THEN the response SHALL be `{ ok: false, message: error.message }` with status 400
- AND the response shape SHALL be identical to the previous implementation

## REMOVED Requirements

None.
