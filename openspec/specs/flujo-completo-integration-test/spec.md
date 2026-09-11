# Flujo Completo Integration Test Specification

## Purpose

Define integration tests for `cerrarMes(mesAnio, admin)` through all 4 stages — pending orders → snapshot → earnings → audit — with only Firestore mocked via `Module._cache`. Exercises real services, repos, job, and orchestrator.

## Requirements

### Requirement: FLUJO-FLOW-001 — Full pipeline, multiple categories

The test MUST verify `cerrarMes()` executes all 4 stages in order with 2+ categories.

#### Scenario: Clavo + Miel categories, one pending order each

- GIVEN a Firestore mock with one client having two pending paid orders (Clavo x2/$50, Miel x1/$100)
- AND Invertir/{categoria}/costos_fijos + costos_variables exist with valid numeric fields
- AND Total Productos and Cartones_vendidos collections do NOT exist yet
- WHEN `cerrarMes("Enero 2026", { uid: "admin-1", nombre: "Admin Uno" })` is called
- THEN stage 1 SHALL process both orders via `batch.set`/`batch.update`/`batch.commit`
- AND stage 2 SHALL read `Total Productos/Enero 2026/productos/` + `Cartones_vendidos/Enero 2026/productos/` subcollections
- AND stage 2 SHALL write `Historico_Mensual/Enero 2026` with both categories
- AND stage 3 SHALL call `cerrarGananciasPorCategoria` for Clavo then Miel
- AND stage 4 SHALL write `Cierres_contables/Enero 2026` + `AdminActions/Enero 2026` with admin nombre
- AND the return value SHALL contain `{ mesAnio, snapshot, ganancias }` with `ganancias.length === 2`

### Requirement: FLUJO-FLOW-002 — Single category pipeline

The test MUST verify the pipeline works with one category.

#### Scenario: Only Clavo, one pending order

- GIVEN one client, one pending paid order for Clavo x2/$50
- AND Invertir/Clavo costos exist
- WHEN `cerrarMes("Enero 2026", { uid: "admin-1", nombre: "Admin Uno" })` is called
- THEN `ganancias.length` SHALL be 1
- AND `ganancias[0].categoria` SHALL be "Clavo"
- AND `ganancias[0].gananciaNeta` SHALL be a number

### Requirement: FLUJO-EDGE-001 — No pending orders

The test MUST verify Stage 1 handles zero orders while Stages 2-4 still execute from pre-populated data.

#### Scenario: Zero pending, pre-populated Total Productos/Cartones_vendidos

- GIVEN Ventas has no pending orders (already processed)
- AND Total Productos/Enero 2026/productos/Clavo exists with `total > 0` and skus
- AND Cartones_vendidos/Enero 2026/productos/Clavo exists with `total > 0` and skus
- AND Invertir/Clavo costos exist
- WHEN `cerrarMes("Enero 2026", admin)` is called
- THEN `processPendingOrders` SHALL return `{ pedidosProcesados: 0, pedidosFallidos: 0 }`
- AND no order-batch commits SHALL occur
- AND stage 2 SHALL produce snapshot from pre-populated data
- AND stage 3 SHALL calculate earnings for Clavo
- AND stage 4 SHALL write audit records

### Requirement: FLUJO-EDGE-002 — Already-closed month

The test MUST verify `cerrarMes()` fails at Stage 2 when `Historico_Mensual/{mesAnio}` already exists.

#### Scenario: Historico_Mensual exists from previous run

- GIVEN `Historico_Mensual/Enero 2026` exists with a previous snapshot
- WHEN `cerrarMes("Enero 2026", admin)` is called
- THEN Stage 1 SHALL process pending orders (if any)
- AND Stage 2 SHALL throw: `"El histórico para Enero 2026 ya fue generado"`
- AND the orchestrator SHALL re-throw with stage prefix
- AND Stages 3-4 SHALL NOT execute

### Requirement: FLUJO-EDGE-003 — Empty Total Productos

The test MUST verify `cerrarMes()` handles empty inventory collections. Stage 3 iterates zero categories, Stage 4 records empty audit.

#### Scenario: Productos subcollection empty

- GIVEN `Total Productos/Enero 2026` document exists but its `productos/` subcollection is empty
- AND `Cartones_vendidos/Enero 2026` has empty `productos/` subcollection
- AND no pending orders
- WHEN `cerrarMes("Enero 2026", admin)` is called
- THEN stage 2 SHALL produce snapshot with empty `totalProductos`/`cartonesVendidos`
- AND stage 3 SHALL iterate zero categories (`ganancias = []`)
- AND stage 4 SHALL write audit with `totalCategorias: 0`, empty `ganancias`

### Requirement: FLUJO-ERR-001 — Empty mesAnio

The test MUST verify `cerrarMes()` throws immediately when `mesAnio` is empty.

#### Scenario: Empty mesAnio string

- GIVEN an empty `mesAnio` string
- WHEN `cerrarMes("", admin)` is called
- THEN the orchestrator SHALL immediately throw `"mesAnio es obligatorio"`
- AND no stage SHALL execute

### Requirement: FLUJO-ERR-002 — Admin without uid

The test MUST verify `cerrarMes()` fails at Stage 2 when `admin.uid` is missing.

#### Scenario: Admin object lacks uid field

- GIVEN pending paid orders exist
- AND admin = `{ nombre: "Test Admin" }` without `uid`
- WHEN `cerrarMes("Enero 2026", admin)` is called
- THEN Stage 1 SHALL execute and process pending orders
- AND Stage 2 SHALL throw `"admin.uid es obligatorio"`
- AND the orchestrator SHALL re-throw with stage prefix
- AND Stages 3-4 SHALL NOT execute

### Requirement: FLUJO-ERR-003 — Category without fixed costs (Invertir)

The test MUST verify Stage 3 fails when Invertir/{categoria}/costos_fijos does not exist.

#### Scenario: Missing Invertir for category

- GIVEN pending paid orders exist
- AND Total Productos and Cartones_vendidos are pre-populated for a category
- AND Invertir/{categoria} document does NOT exist
- WHEN `cerrarMes("Enero 2026", admin)` is called
- THEN Stage 1 SHALL complete
- AND Stage 2 SHALL generate snapshot successfully
- AND Stage 3 SHALL throw `"No existen costos fijos para {categoria}"`
- AND the orchestrator SHALL re-throw with stage prefix
- AND Stage 4 SHALL NOT execute

### Requirement: FLUJO-ERR-004 — Category without variable costs

The test MUST verify Stage 3 fails when variable costs for a non-Miel category are missing.

#### Scenario: Missing costos_variables for non-Miel category

- GIVEN pending paid orders exist
- AND all collections are pre-populated for "Clavo" category
- AND Invertir/Clavo/costos_fijos exists with valid numeric fields
- BUT Invertir/Clavo/costos_variables does NOT exist
- WHEN `cerrarMes("Enero 2026", admin)` is called
- THEN Stage 1 SHALL complete
- AND Stage 2 SHALL generate snapshot successfully
- AND Stage 3 SHALL throw `"No existen costos variables para Clavo"`
- AND the orchestrator SHALL re-throw with stage prefix
