# Delta for contable.repository

## ADDED Requirements

### Requirement: Repository Interface

The system MUST provide a `contable.repository.js` module that exposes methods to interact with Firestore collections related to accounting data. This repository MUST encapsulate all direct Firestore operations and provide a clean interface for the service layer.

The repository MUST expose the following methods:
- `getInvertir(categoria)`: Retrieves investment data for a given category
- `getCostosFijos(categoria)`: Retrieves fixed costs data for a given category
- `getCostosVariables(categoria)`: Retrieves variable costs data for a given category
- `getGanancias(mesAnio)`: Retrieves earnings data for a given month and year

#### Scenario: Retrieve Investment Data

- GIVEN a valid `categoria` parameter
- WHEN `getInvertir(categoria)` is called
- THEN the repository MUST return the document from `Invertir/{categoria}` collection
- AND the returned data MUST match the Firestore document structure

#### Scenario: Retrieve Fixed Costs Data

- GIVEN a valid `categoria` parameter
- WHEN `getCostosFijos(categoria)` is called
- THEN the repository MUST return the document from `Invertir/{categoria}/costos_fijos` subcollection
- AND the returned data MUST match the Firestore document structure

#### Scenario: Retrieve Earnings Data

- GIVEN a valid `mesAnio` parameter
- WHEN `getGanancias(mesAnio)` is called
- THEN the repository MUST return the document from `Ganancias/{mesAnio}` collection
- AND the returned data MUST match the Firestore document structure

### Requirement: Error Handling

The repository MUST implement consistent error handling for all methods. Errors from Firestore operations MUST be caught and wrapped in a standardized format before being thrown to the service layer.

#### Scenario: Invalid Category

- GIVEN an invalid `categoria` parameter
- WHEN any repository method is called with this parameter
- THEN the repository MUST return `null` or throw a standardized error
- AND the error MUST be catchable by the service layer

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