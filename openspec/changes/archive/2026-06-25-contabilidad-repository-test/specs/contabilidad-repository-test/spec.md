# contabilidad-repository-test Specification

## Purpose

Tests for `contabilidad.repository.js`: SKU categorization, atomic batch ops, category cleanup for Total Productos and Cartones Vendidos.

## Requirements

### Requirement: obtenerCategoria

The system MUST return a product's category from its SKU name using the dictionary. It MUST select the longest match when multiple match, and return null when none match. Names MUST be normalized before comparison (accents, case, spaces).

#### Scenario: Returns category for matching SKU

- GIVEN a SKU name "Miel * 100"
- WHEN `obtenerCategoria("Miel * 100")` is called
- THEN it returns "Miel"

#### Scenario: Returns most specific match

- GIVEN a name matching both "Canela" and "Canela_molida"
- WHEN `obtenerCategoria` is called
- THEN it returns "Canela_molida"

#### Scenario: Returns null when no match

- GIVEN a SKU name "Producto Sin Categoria"
- WHEN `obtenerCategoria` is called
- THEN it returns null

#### Scenario: Handles accented and uppercased names

- GIVEN a SKU "MIEL 100gr con acentos"
- WHEN `obtenerCategoria` is called
- THEN it returns "Miel"

### Requirement: buildOperacionesContables

The system MUST validate inputs and build atomic batch ops for Total Productos and Cartones Vendidos. Each item generates ops for category, SKU, and totals using `FieldValue.increment`. Items without category MUST be skipped silently.

#### Scenario: Throws on empty items

- GIVEN `items` is an empty array or not an array
- WHEN `buildOperacionesContables(items, new Date())` is called
- THEN it throws "Items invalidos para contabilidad"

#### Scenario: Throws on invalid fechaPedido

- GIVEN valid items but `fechaPedido` is a string
- WHEN `buildOperacionesContables(items, "not-a-date")` is called
- THEN it throws "fechaPedido invalida"

#### Scenario: Builds all ops for categorized items

- GIVEN items with valid category, subtotal and cantidad
- WHEN `buildOperacionesContables` is called
- THEN ops include docs principales, categoria+sku (Total y Cartones), totalGeneral increments, serverTimestamp

#### Scenario: Uses FieldValue.increment for totals

- GIVEN an item with `subtotal: 1500` and `cantidad: 5`
- WHEN ops are built
- THEN Total Productos ops use `increment(1500)` and Cartones ops use `increment(5)`

#### Scenario: Skips items without category

- GIVEN an item whose SKU returns null from `obtenerCategoria`
- WHEN `buildOperacionesContables` is called
- THEN the item is skipped and no error is thrown

#### Scenario: Includes serverTimestamp on main docs

- GIVEN valid items and date
- WHEN ops are built
- THEN the main document operations include `actualizadoEn: FieldValue.serverTimestamp()`

### Requirement: executeBatch

The system MUST execute batch writes atomically via `db.batch()`.

#### Scenario: Writes all operations and commits

- GIVEN an array of operations
- WHEN `executeBatch(ops)` is called
- THEN `batch.set()` is called per operation and `batch.commit()` is called once

#### Scenario: Propagates commit errors

- GIVEN `batch.commit()` rejects
- WHEN `executeBatch(ops)` is called
- THEN the error is propagated to the caller

### Requirement: executeBatchWithUpdates

The system MUST execute a batch with set and update operations.

#### Scenario: Applies sets and updates then commits

- GIVEN a `sets` array and an `updates` array
- WHEN `executeBatchWithUpdates(sets, updates)` is called
- THEN `batch.set()` for each set, `batch.update()` for each update, `batch.commit()` called

### Requirement: limpiarCategoriaTotal

The system MUST delete all SKUs in a Total Productos category and reset total to 0.

#### Scenario: Deletes SKUs and resets total

- GIVEN a category with 2 SKU documents
- WHEN `limpiarCategoriaTotal(mesAnio, categoria)` is called
- THEN it reads the SKUs, calls `batch.delete()` on each, sets `total: 0` on the category doc, and commits

#### Scenario: Handles empty category

- GIVEN a category with 0 SKU documents
- WHEN `limpiarCategoriaTotal(mesAnio, categoria)` is called
- THEN it still resets `total: 0` and commits

### Requirement: limpiarCategoriaCartones

The system MUST delete all SKUs in a Cartones Vendidos category and reset total to 0 (same logic as `limpiarCategoriaTotal`).

#### Scenario: Deletes SKUs and resets total

- GIVEN a category with SKU documents
- WHEN `limpiarCategoriaCartones(mesAnio, categoria)` is called
- THEN it reads SKUs, calls `batch.delete()` on each, sets `total: 0`, and commits
