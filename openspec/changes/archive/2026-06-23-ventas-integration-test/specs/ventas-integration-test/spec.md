# Ventas Integration Test Specification

## Purpose

Define the integration test behaviors for the `POST /pedido-libre` endpoint in `backend/src/routes/ventas.js`. This spec covers validation, error paths, and the complete successful order flow at the HTTP layer.

## Requirements

### Requirement: Missing client returns 400

The system MUST reject requests without a `cliente` field in the request body with status 400 and error code `cliente_requerido`.

#### Scenario: Cliente field is absent

- GIVEN a POST to `/pedido-libre` with body `{ "mensaje": "2 miel" }`
- WHEN the request is processed
- THEN the response SHALL have status 400
- AND the response body SHALL contain `{ "error": "cliente_requerido" }`

### Requirement: Invalid message returns 400

The system MUST reject requests where `mensaje` is missing, empty, or not a string with status 400 and error code `mensaje_requerido`.

#### Scenario: Mensaje field is absent

- GIVEN a POST to `/pedido-libre` with body `{ "cliente": "Test" }`
- WHEN the request is processed
- THEN the response SHALL have status 400
- AND the response body SHALL contain `{ "error": "mensaje_requerido" }`

#### Scenario: Mensaje is an empty string

- GIVEN a POST to `/pedido-libre` with body `{ "cliente": "Test", "mensaje": "" }`
- WHEN the request is processed
- THEN the response SHALL have status 400
- AND the response body SHALL contain `{ "error": "mensaje_requerido" }`

### Requirement: Client not found returns 404

The system MUST return status 404 with error `cliente_no_encontrado` when the normalized client name does not match any Firestore document.

#### Scenario: Unknown client name

- GIVEN a valid request with `cliente` that does not exist in Firestore
- WHEN the system queries for the client
- THEN the response SHALL have status 404
- AND the response body SHALL contain `cliente_no_encontrado`

### Requirement: No interpreted products returns 400

The system MUST return status 400 with error `ningun_producto_identificado` when the interpretation service returns no products.

#### Scenario: Empty interpretation result

- GIVEN a valid client that exists
- AND the interpretation service returns an empty array
- WHEN the request is processed
- THEN the response SHALL have status 400
- AND the response body SHALL contain `{ "error": "ningun_producto_identificado" }`

### Requirement: Product not found in Firestore returns 400

The system MUST return status 400 with error `producto_no_encontrado` when an interpreted product does not exist in the Firestore subcollection.

#### Scenario: Interpreted product missing from inventory

- GIVEN a valid client that exists
- AND the interpretation service returns `[{ "producto": "Miel", "cantidad": 2 }]`
- AND the product lookup returns no matching Firestore document
- WHEN the request is processed
- THEN the response SHALL have status 400
- AND the response body SHALL contain `producto_no_encontrado`

### Requirement: Successful order returns 200

The system MUST create a pedido, persist it to Firestore, and return status 200 with the pedido details when validation, client lookup, interpretation, and inventory lookup all succeed.

#### Scenario: Complete happy path flow

- GIVEN a valid client that exists in Firestore
- AND the interpretation service returns `[{ "producto": "Miel", "cantidad": 2 }]`
- AND the product exists in Firestore with a valid price
- WHEN a POST to `/pedido-libre` is made with `{ "cliente": "Test", "mensaje": "2 miel" }`
- THEN the response SHALL have status 200
- AND the response body SHALL contain `pedidoId`, `clienteId`, `clienteNombre`, `total`, and `tipoPedido: "libre"`
- AND `estadoContable` SHALL be `"pendiente"`
- AND the Firestore ventas repository methods SHALL have been called for persistence
