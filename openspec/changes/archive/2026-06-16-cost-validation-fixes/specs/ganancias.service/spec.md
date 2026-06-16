# Delta for ganancias.service

## ADDED Requirements

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

## MODIFIED Requirements

None.

## REMOVED Requirements

None.
