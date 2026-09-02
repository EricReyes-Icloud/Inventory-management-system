# jobContable Integration Test Specification

## Purpose

Define integration test scenarios for `processPendingOrders()` that verify the real interaction between the job (`jobContableMensual.js`), the ventas repository (`ventas.repository.js`), and the contabilidad repository (`contabilidad.repository.js`), with only the Firestore layer mocked via `Module._cache`.

## Requirements

### Requirement: INT-FLOW-001 — Happy path processes a single order

The integration test MUST verify that `processPendingOrders()` successfully processes one pending paid order across the real job → repos → Firestore mock pipeline.

#### Scenario: Single client, single month, single pending order

- GIVEN a Firestore mock with one client, one month, and one pending paid order with valid detalle
- WHEN `processPendingOrders()` is called
- THEN `ventasRepo.getTodosClientesConVentas()` SHOULD return the client
- AND `ventasRepo.getMesesPedidos()` SHOULD return the month
- AND `ventasRepo.getPedidosPendientes()` SHOULD return the order
- AND `contabilidadRepo.buildOperacionesContables()` SHOULD be called with the real implementation
- AND `db.batch()` SHOULD be called
- AND `batch.set` SHOULD be called with the built operations
- AND `batch.update` SHOULD mark the order as processed
- AND `batch.commit()` SHOULD be called
- AND the result MUST be `{ pedidosProcesados: 1, pedidosFallidos: 0 }`

### Requirement: INT-FLOW-002 — Happy path processes multiple orders across clients

The integration test MUST verify that `processPendingOrders()` handles multiple clients, each with a pending order, producing independent batches.

#### Scenario: Two clients, one order each

- GIVEN a Firestore mock with two clients, each with one month and one pending paid order
- WHEN `processPendingOrders()` is called
- THEN `batch.commit()` MUST be called twice (one per order)
- AND each order MUST have its batch.update called with `estadoContable: "procesado"`
- AND `buildOperacionesContables` MUST be called with the real implementation for each order
- AND the result MUST be `{ pedidosProcesados: 2, pedidosFallidos: 0 }`

### Requirement: INT-EDGE-001 — Empty clientes snapshot aborts early

The integration test MUST verify that `processPendingOrders()` returns immediately when no clients exist.

#### Scenario: No clients in database

- GIVEN a Firestore mock where `ventasRepo.getTodosClientesConVentas()` returns an empty snapshot
- WHEN `processPendingOrders()` is called
- THEN no batch operations MUST be created
- AND the result MUST be `{ pedidosProcesados: 0, pedidosFallidos: 0 }`

### Requirement: INT-EDGE-002 — Client with no months is skipped

The integration test MUST verify that a client without monthly subcollections is skipped without error.

#### Scenario: One client, no months

- GIVEN a Firestore mock with one client whose months subcollection is empty
- WHEN `processPendingOrders()` is called
- THEN the client MUST be skipped
- AND no batch operations MUST be created
- AND the result MUST be `{ pedidosProcesados: 0, pedidosFallidos: 0 }`

### Requirement: INT-EDGE-003 — Month with no pending orders is skipped

The integration test MUST verify that a month subcollection with no pending paid orders is skipped.

#### Scenario: One client, one month, no pending orders

- GIVEN a Firestore mock with one client and one month but zero pending orders
- WHEN `processPendingOrders()` is called
- THEN the month MUST be skipped
- AND no batch operations MUST be created
- AND the result MUST be `{ pedidosProcesados: 0, pedidosFallidos: 0 }`

### Requirement: INT-EDGE-004 — BuildOperacionesContables produces correct FieldValue increments

The integration test MUST verify that `contabilidadRepo.buildOperacionesContables()` generates the correct Firestore path structure and FieldValue.increment calls when called with real inventory data.

#### Scenario: Two product items in order detail

- GIVEN a Firestore mock with one client, one month, and one pending order with 2 product items (e.g., Clavo x2, Miel x1)
- WHEN `processPendingOrders()` is called
- THEN `batch.set` MUST be called with operations that include `FieldValue.increment` sentinel objects for quantity and subtotal fields
- AND the operation paths MUST follow the expected Firestore document structure for the inventory categories

### Requirement: INT-ERROR-001 — Invalid order detail is filtered by real job logic

The integration test MUST verify that the job's validation guards run correctly when integrated with real repositories.

#### Scenario: Order with empty detalle array

- GIVEN a Firestore mock with one client, one month, and one pending paid order with empty `detalle`
- WHEN `processPendingOrders()` is called
- THEN the order MUST be skipped
- AND no batch operations MUST be created
- AND the result MUST be `{ pedidosProcesados: 0, pedidosFallidos: 0 }`
