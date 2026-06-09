# Delta for contabilidad.repository

## ADDED Requirements

### Requirement: Repository Interface

The system MUST provide a `contabilidad.repository.js` module that exposes methods to interact with Firestore collections related to accounting data. This repository MUST encapsulate all direct Firestore operations and provide a clean interface for the service layer.

The repository MUST expose the following methods:
- `getTotalProductos(mesAnio)`: Retrieves total products data for a given month and year
- `getCartonesVendidos(mesAnio)`: Retrieves cardboard sales data for a given month and year  
- `getHistoricoMensual(mesAnio)`: Retrieves monthly historical data for a given month and year
- `getCierresContables(mesAnio)`: Retrieves accounting closures data for a given month and year

#### Scenario: Retrieve Total Products Data

- GIVEN a valid `mesAnio` parameter (e.g., "2023-10")
- WHEN `getTotalProductos(mesAnio)` is called
- THEN the repository MUST return the document from `Total Productos/{mesAnio}` collection
- AND the returned data MUST match the Firestore document structure

#### Scenario: Retrieve Cartones Vendidos Data

- GIVEN a valid `mesAnio` parameter (e.g., "2023-10")
- WHEN `getCartonesVendidos(mesAnio)` is called
- THEN the repository MUST return the document from `Cartones_vendidos/{mesAnio}` collection
- AND the returned data MUST match the Firestore document structure

#### Scenario: Handle Non-existent Data

- GIVEN an invalid `mesAnio` parameter (e.g., "2025-99")
- WHEN any repository method is called with this parameter
- THEN the repository MUST return `null` or throw a standardized error
- AND the error MUST be catchable by the service layer

### Requirement: Error Handling

The repository MUST implement consistent error handling for all methods. Errors from Firestore operations MUST be caught and wrapped in a standardized format before being thrown to the service layer.

#### Scenario: Firestore Connection Error

- GIVEN Firestore is unavailable
- WHEN any repository method is called
- THEN the repository MUST throw an error with a clear message
- AND the error MUST include the original Firestore error details

### Requirement: Testability

The repository MUST be designed to be easily testable. All methods MUST be pure functions that accept dependencies as parameters, allowing for easy mocking during testing.

#### Scenario: Mock Firestore Dependency

- GIVEN a mocked Firestore instance is passed to the repository
- WHEN repository methods are called
- THEN the methods MUST use the mocked instance instead of the real Firestore
- AND the behavior MUST be predictable for testing purposes

## MODIFIED Requirements

None

## REMOVED Requirements

None