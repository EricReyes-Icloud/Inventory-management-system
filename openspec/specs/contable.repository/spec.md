# Delta for contable.repository

## ADDED Requirements

### Requirement: Repository Interface

The system MUST provide a `contable.repository.js` module that encapsulates all direct Firestore access for `Ganancias` and `Invertir` subcollections. The repository SHALL import `db` directly (`require("../lib/firestore")`) following the existing repository pattern in this project.

The repository MUST expose the following methods:

| Method | Firestore Path | Type |
|--------|---------------|------|
| `getInvertir(categoria)` | `Invertir/{categoria}` | Read |
| `getCostosFijos(categoria)` | `Invertir/{categoria}/costos_fijos/costos_fijos` | Read |
| `getCostosVariables(categoria)` | `Invertir/{categoria}/costos_variables/costos_variables` | Read |
| `getCostosVariablesPorProducto(categoria, producto)` | `Invertir/{categoria}/costos_variables/{producto}` | Read |
| `getGanancias(mesAnio)` | `Ganancias/{mesAnio}` | Read |
| `setGanancias(mesAnio, data)` | `Ganancias/{mesAnio}` | Merge write |
| `setHistoricoCompras(categoria, mesAnio, data)` | `Invertir/{categoria}/historico_compras/{mesAnio}` | Merge write |
| `resetCostosVariables(categoria)` | `Invertir/{categoria}/costos_variables/costos_variables` | Write (zero all fields) |
| `setCostosVariablePorProducto(categoria, producto, data)` | `Invertir/{categoria}/costos_variables/{producto}` | Merge write |

#### Scenario: Read methods return Firestore snapshots

- GIVEN a valid `categoria` and/or `mesAnio`
- WHEN any read method is called
- THEN the method SHALL return the Firestore document or `null` if not found

#### Scenario: Write methods use merge semantics

- GIVEN a write call with `data`
- WHEN `setGanancias` or `setHistoricoCompras` is invoked
- THEN the repository SHALL use `{ merge: true }` to avoid overwriting sibling fields

#### Scenario: resetCostosVariables zeros all fields

- GIVEN an existing costos_variables document with numeric fields
- WHEN `resetCostosVariables(categoria)` is called
- THEN each numeric field in the document SHALL be set to `0`
- AND the field count and field names SHALL be preserved

### Requirement: Error Handling

The repository SHALL wrap Firestore errors in an `Error` with a descriptive message. `get` methods SHALL return `null` for missing documents rather than throwing.

#### Scenario: Document not found returns null

- GIVEN a document does not exist at the target path
- WHEN a read method is called
- THEN the method SHALL return `null` (not throw)

## MODIFIED Requirements

### ~~Requirement: Testability~~ (REMOVED — see below)

(Previously: Repositories should accept dependencies as parameters for mock injection)

The existing project convention is that repositories import `db` directly at module scope. The testability requirement is REMOVED — testing is done by mocking `../lib/firestore` at the module level using `jest.mock` or `proxyquire`, not through constructor injection.

## REMOVED Requirements

### Requirement: Testability — Dependency Injection

(Reason: Contradicts existing project convention. All repositories in this project import `db` directly. Test mocks apply at the module level via `jest.mock("../lib/firestore")`.)
(Migration: Tests SHALL mock `../lib/firestore` at module load time. No constructor/method-level injection is needed.)
