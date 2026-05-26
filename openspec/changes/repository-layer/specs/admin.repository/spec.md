# Delta for admin.repository

## ADDED Requirements

### Requirement: Repository Interface

The system MUST provide a `admin.repository.js` module that exposes methods to interact with Firestore collections related to administrative data. This repository MUST encapsulate all direct Firestore operations and provide a clean interface for the service layer.

The repository MUST expose the following methods:
- `getAdminActions(mesAnio, categoria)`: Retrieves admin actions data for a given month/year and category
- `getCierresContables(mesAnio, categoria)`: Retrieves accounting closures data for a given month/year and category
- `getAdminByEmail(email)`: Retrieves admin data by email
- `getAdminByRol(rol)`: Retrieves all admins with a specific role

#### Scenario: Retrieve Admin Actions Data

- GIVEN valid `mesAnio` and `categoria` parameters
- WHEN `getAdminActions(mesAnio, categoria)` is called
- THEN the repository MUST return the document from `AdminActions/{mesAnio}/{categoria}` subcollection
- AND the returned data MUST match the Firestore document structure

#### Scenario: Retrieve Accounting Closures Data

- GIVEN valid `mesAnio` and `categoria` parameters
- WHEN `getCierresContables(mesAnio, categoria)` is called
- THEN the repository MUST return the document from `Cierres_contables/{mesAnio}/{categoria}` subcollection
- AND the returned data MUST match the Firestore document structure

#### Scenario: Retrieve Admin by Email

- GIVEN a valid `email` parameter
- WHEN `getAdminByEmail(email)` is called
- THEN the repository MUST return the document from `Admin` collection where email matches
- AND the returned data MUST match the Firestore document structure

### Requirement: Error Handling

The repository MUST implement consistent error handling for all methods. Errors from Firestore operations MUST be caught and wrapped in a standardized format before being thrown to the service layer.

#### Scenario: Invalid Admin Query

- GIVEN invalid query parameters
- WHEN any repository method is called with these parameters
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