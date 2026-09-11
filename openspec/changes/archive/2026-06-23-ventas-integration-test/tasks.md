# Tasks: Ventas Integration Test — POST /pedido-libre

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~185 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Infrastructure

- [x] 1.1 Add `supertest` to `devDependencies` in `backend/package.json` and run `npm install`
- [x] 1.2 Create `backend/tests/integration/ventas.test.ts` with Vitest imports, Module augmentation, inline `createApp()` helper, and shared mock scaffolding for `firestore.js` and `inturis.js` via `Module._cache`

## Phase 2: Test Scenarios

- [x] 2.1 Write validation scenarios: missing `cliente` → 400 `cliente_requerido`; absent and empty `mensaje` → 400 `mensaje_requerido` (no mocks needed)
- [x] 2.2 Write "client not found" scenario: mock `Clientes.get()` → empty snapshot → 404 `cliente_no_encontrado`
- [x] 2.3 Write "no interpreted products" scenario: mock `interpretarPedido` → `[]` → 400 `ningun_producto_identificado`
- [x] 2.4 Write "product not found" scenario: mock `buscarSubcoleccion("Miel")` returns doc, `getProducto` returns null → 400 `producto_no_encontrado`
- [x] 2.5 Write "happy path" scenario: all mocks configured for success (client found, `interpretarPedido` returns products, product exists with price, pedidos list empty), assert 200 with `pedidoId`, `clienteId`, `clienteNombre`, `total`, `tipoPedido`, `estadoContable`, and verify `crearPedido` was called

## Phase 3: Verification

- [x] 3.1 Run `npm run test:run -- tests/integration/ventas.test.ts` and confirm all scenarios pass
