# Behavioral Specification: contabilidad.service

## Purpose

Define the observable behavior of `contabilidad.service.js` for unit test verification. This service orchestrates monthly inventory snapshot generation, delegating all Firestore access to `contabilidad.repository`.

## Requirements

### Requirement: generarHistoricoMensual — Happy Path

When invoked with valid `mesAnio` and an `admin` object containing `uid` and `nombre`, the service MUST read Total Productos and Cartones_vendidos data, write a snapshot to Historico_Mensual with metadata, and return the aggregated result.

#### Scenario: Full snapshot generation

- GIVEN `mesAnio = "Enero 2026"` and `admin = { uid: "abc123", nombre: "Admin" }`
- WHEN `generarHistoricoMensual(mesAnio, admin)` is called
- THEN it MUST read categories via `getCategoriasTotalProductos` and `getCategoriasCartonesVendidos`
- AND it MUST read SKUs per category via `getSkusTotalProductos` and `getSkusCartonesVendidos`
- AND it MUST write via `setHistoricoMensual` with `estado: "cerrado"`, `generadoEn` (Date), `generadoPor: admin.uid`, `usuario: admin.nombre`
- AND it MUST return `{ totalProductos, cartonesVendidos }` with populated data

### Requirement: generarHistoricoMensual — Empty Data

When no product categories or carton categories exist for the given month, the service MUST return empty objects. A snapshot SHALL still be persisted.

#### Scenario: No data for mesAnio

- GIVEN both `getCategoriasTotalProductos` and `getCategoriasCartonesVendidos` return empty snapshots
- WHEN `generarHistoricoMensual("Enero 2026", admin)` is called
- THEN it MUST return `{ totalProductos: {}, cartonesVendidos: {} }`

### Requirement: generarHistoricoMensual — Missing SKUs Default to 0

When a category document exists but its SKU subcollection is empty, the service MUST default SKU values to 0 and preserve the category total.

#### Scenario: Category without SKU documents

- GIVEN `getCategoriasTotalProductos` returns a category `{ total: 100 }` but `getSkusTotalProductos` returns empty
- WHEN `generarHistoricoMensual("Enero 2026", admin)` is called
- THEN `totalProductos[categoria].skus` MUST be `{}` with `total: 100`

### Requirement: generarHistoricoMensual — Admin Validation

The service MUST validate the `admin` parameter before performing any repository reads. An invalid admin SHALL cause the operation to reject.

#### Scenario: Admin without uid

- GIVEN `admin = { nombre: "Test" }` (missing `uid`)
- WHEN `generarHistoricoMensual("Enero 2026", admin)` is called
- THEN it MUST throw an error

#### Scenario: Admin without nombre

- GIVEN `admin = { uid: "abc" }` (missing `nombre`)
- WHEN `generarHistoricoMensual("Enero 2026", admin)` is called
- THEN it MUST throw an error

### Requirement: generarHistoricoMensual — Duplicate mesAnio

When Historico_Mensual already contains a document for the given `mesAnio`, the service MUST reject the operation.

#### Scenario: Snapshot already exists for month

- GIVEN `getHistoricoMensual("Enero 2026")` returns an existing document
- WHEN `generarHistoricoMensual("Enero 2026", admin)` is called
- THEN it MUST throw an error
- AND `setHistoricoMensual` MUST NOT be called

### Requirement: Repository Error Propagation

When any `contabilidad.repository` method rejects, the error MUST propagate to the caller without being caught or swallowed.

#### Scenario: Repository throws

- GIVEN `getCategoriasTotalProductos` rejects with an error
- WHEN `generarHistoricoMensual("Enero 2026", admin)` is called
- THEN the error MUST propagate to the caller

### Requirement: Export Surface

The module SHALL expose exactly three functions.

#### Scenario: Export count and names

- GIVEN the module is required
- THEN `module.exports` MUST have exactly 3 keys: `generarHistoricoMensual`, `obtenerCategoria`, `buildOperacionesContables`
- AND each key MUST be a function

### Requirement: Delegation to Repository

`obtenerCategoria` and `buildOperacionesContables` SHALL be direct references to `contabilidad.repository` exports, not reimplementations.

#### Scenario: obtenerCategoria is delegated

- GIVEN the required module
- THEN `obtenerCategoria` MUST be the same function as `contabilidad.repository.obtenerCategoria`

#### Scenario: buildOperacionesContables is delegated

- GIVEN the required module
- THEN `buildOperacionesContables` MUST be the same function as `contabilidad.repository.buildOperacionesContables`
