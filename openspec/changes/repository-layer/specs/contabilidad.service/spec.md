# Delta for contabilidad.service

## ADDED Requirements

### Requirement: Repository Integration

The `contabilidad.service.js` MUST integrate with `contabilidad.repository.js` to replace direct Firestore calls. The service MUST use repository methods for all data access operations.

#### Scenario: Service Uses Repository for Total Products

- GIVEN `contabilidad.service.js` needs total products data
- WHEN the service calls repository method `getTotalProductos(mesAnio)`
- THEN the service MUST receive the same data format as before
- AND the service MUST handle the data identically to previous implementation

#### Scenario: Service Handles Repository Errors

- GIVEN the repository throws an error
- WHEN the service calls any repository method
- THEN the service MUST catch the error
- AND the service MUST return an appropriate error response
- AND the service MUST NOT crash

## MODIFIED Requirements

### Requirement: Data Access Method

The `contabilidad.service.js` MUST replace all direct Firestore collection access with repository method calls. This includes operations on `Total Productos`, `Cartones_vendidos`, and `Historico_Mensual` collections.

(Previously: Service accessed Firestore collections directly via `require("../lib/firestore")`)

#### Scenario: Service Calls Repository Instead of Direct DB Access

- GIVEN a request for accounting data
- WHEN the service processes the request
- THEN the service MUST call repository methods
- AND the service MUST NOT call Firestore collections directly
- AND the response format MUST remain unchanged

## REMOVED Requirements

None