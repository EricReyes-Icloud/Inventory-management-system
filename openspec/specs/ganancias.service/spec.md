# Delta for ganancias.service

## ADDED Requirements

### Requirement: Mandatory Variable Costs Validation

The system MUST validate that `costos_variables` exist for the given category BEFORE proceeding with earnings calculation. This validation SHALL apply uniformly to ALL categories, including "Miel". If `costos_variables` are not provided (document does not exist), the service MUST throw an error and SHALL NOT calculate earnings.

(Previously: For category "Miel", variable costs per product were treated as optional — if the document did not exist, the service silently skipped it and continued calculation. This was a bug.)

#### Scenario: Variable costs missing for normal category

- GIVEN `cerrarGananciasPorCategoria()` is called with a non-Miel category
- AND the `costos_variables` document does not exist for that category in `Invertir/{categoria}/costos_variables/`
- WHEN the validation step executes
- THEN the service MUST throw an error with message `"No existen costos variables para {categoria}"`
- AND earnings calculation SHALL NOT proceed

#### Scenario: Variable costs missing for Miel product

- GIVEN `cerrarGananciasPorCategoria()` is called with category "Miel"
- AND a specific product (e.g., "Frascos", "Botellas", "Copas") has no `costos_variables` document in `Invertir/Miel/costos_variables/{producto}`
- WHEN the validation step executes for that product
- THEN the service MUST throw an error with message `"No existen costos variables para {producto} en categoria Miel"`
- AND earnings calculation SHALL NOT proceed

### Requirement: Repository-Only Data Access

The system MUST replace all direct `db.collection()` calls in `ganancias.service.js` with calls to `contable.repository.js`. The service SHALL import `contableRepo` and use its methods for ALL Firestore reads and writes.

Explicit mapping:

| Current direct call | Repository replacement |
|---|---|
| `db.collection("Historico_Mensual").doc(mesAnio).get()` | `contabilidadRepo.getHistoricoMensual(mesAnio)` (already exists in contabilidad.repository.js) |
| `db.collection("Invertir").doc(categoria).collection("costos_fijos")...` | `contableRepo.getCostosFijos(categoria)` |
| `db.collection("Invertir").doc("Miel").collection("costos_variables").doc(nombreProducto).get()` | `contableRepo.getCostosVariablesPorProducto(categoria, nombreProducto)` |
| `db.collection("Invertir").doc(categoria).collection("costos_variables").doc("costos_variables").get()` | `contableRepo.getCostosVariables(categoria)` |
| `db.collection("Ganancias").doc(mesAnio).set(...)` | `contableRepo.setGanancias(mesAnio, data)` |
| `db.collection("Invertir").doc(categoria).collection("historico_compras").doc(mesAnio).set(...)` | `contableRepo.setHistoricoCompras(categoria, mesAnio, data)` |

#### Scenario: Service reads via repository only

- GIVEN `ganancias.service.js` needs historical data, fixed costs, or variable costs
- WHEN `cerrarGananciasPorCategoria(mesAnio)` executes
- THEN every Firestore read SHALL go through a `contableRepo.*` method
- AND zero `db.collection()` or `db.doc()` calls SHALL be present in the module

## MODIFIED Requirements

### Requirement: Costos Variables Reset

The service MUST reset per-category variable costs after successful earnings calculation. The buggy line `await costosVariablesRef.set(resetData, { merge: true })` SHALL be replaced with `await contableRepo.resetCostosVariables(categoria)`.

(Previously: Referenced undefined `costosVariablesRef` variable — would throw ReferenceError at runtime)

#### Scenario: Reset uses repository method

- GIVEN earnings calculation succeeds for a category
- WHEN the reset step executes
- THEN `contableRepo.resetCostosVariables(categoria)` SHALL be called
- AND the function SHALL NOT reference any undefined variable

### Requirement: Export Surface

The service SHALL export exactly `{ cerrarGananciasPorCategoria }`. The non-existent export `calcularGananciasInterno` SHALL NOT be present.

(Previously: `routes/ventas.js` imported `calcularGananciasInterno` which was never defined in the service)

#### Scenario: Only cerrarGananciasPorCategoria is exported

- GIVEN the module is required
- WHEN checking `module.exports`
- THEN only `cerrarGananciasPorCategoria` SHALL be exported
- AND `calcularGananciasInterno` SHALL NOT exist

### Requirement: Cost Value Validation Threshold

The system MUST validate that ALL individual cost values in `costos_fijos` and `costos_variables` are strictly greater than zero. The validation SHALL reject values where `v <= 0` (zero or negative). This replaces the previous threshold of `v < 0` which incorrectly allowed zero values.

#### Scenario: Zero fixed or variable cost is rejected

- GIVEN a `costos_fijos` or `costos_variables` document has a field with value `0`
- WHEN `cerrarGananciasPorCategoria(mesAnio)` executes the cost loop validation
- THEN the service MUST throw a validation error
- AND earnings calculation SHALL NOT proceed

#### Scenario: Negative cost is rejected

- GIVEN a `costos_fijos` or `costos_variables` document has a field with a negative value
- WHEN `cerrarGananciasPorCategoria(mesAnio)` executes the cost loop validation
- THEN the service MUST throw a validation error
- AND earnings calculation SHALL NOT proceed

#### Scenario: All-positive costs pass validation

- GIVEN ALL field values in both `costos_fijos` and `costos_variables` are positive numbers (> 0)
- WHEN `cerrarGananciasPorCategoria(mesAnio)` executes the cost loop validation
- THEN the validation SHALL pass
- AND earnings calculation SHALL continue to completion

### Requirement: Variable Costs Are Period Costs (Not Multiplied)

The system MUST treat variable costs as direct period costs. Variable costs from `costos_variables` documents SHALL be summed directly as total costs for the period, and SHALL NOT be multiplied by the quantity of cartons or any other multiplicative factor.

#### Scenario: Variable costs summed as period total

- GIVEN `costos_variables` returns `{ Frascos: 50, Botellas: 30, Copas: 20 }` (costs per product type)
- WHEN earnings calculation processes variable costs
- THEN the total variable cost SHALL be `50 + 30 + 20 = 100` (direct sum)
- AND the result SHALL NOT multiply any of these values by carton quantities

## REMOVED Requirements

None.
