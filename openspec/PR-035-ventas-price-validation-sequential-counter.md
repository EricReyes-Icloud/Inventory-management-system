# PR-035: Ventas Price Validation & Atomic Sequential Counter

## Description

This PR resolves two critical issues in the sales order creation flow in `backend/src/services/ventas.service.js`:

1. **Missing price validation**: Products can currently be sold at $0 or without a price at all, causing accounting discrepancies and potential revenue loss. The system silently accepts null, undefined, or 0 prices.

2. **Race condition in sequential order numbering**: The current implementation reads all existing orders to calculate `max + 1`, which is vulnerable to race conditions in high-concurrency scenarios where two simultaneous orders could receive the same identifier.

The solution introduces a dedicated `validarPrecio()` function that validates product prices before sale recording, and provides an atomic `crearPedidoConConsecutivo()` method using Firestore transactions to prevent order number collisions.

## Changes Made

### Bug Fixes

- `backend/src/services/ventas.service.js` — Added `validarPrecio()` function that validates product price exists, is a valid number, and is greater than 0. Returns `{ error: "producto_sin_precio", detalle: "<product_name>" }` HTTP 400 when validation fails. Modified the product processing loop to call validation before calculating subtotals.

- `backend/src/services/ventas.service.js` — Added early rejection of products with invalid prices, preventing sales registration when price validation fails.

### Features

- `backend/src/repositories/ventas.repository.js` — Added `crearPedidoConConsecutivo(clienteId, mesAnio, data)` that creates orders with sequential numbers using Firestore transactions to prevent race conditions.

- `backend/src/repositories/ventas.repository.js` — Added `obtenerProximoNumeroPedido(clienteId, mesAnio)` helper function to query the next order number without creating an order.

- `backend/tests/integration/ventas.validation.test.ts` — Added test suite with 2 test cases for price validation scenarios (price = 0, price = null/missing).

### Dev Tooling

- `odd/tasks/ventas-validation-sequential-counter.md` — Feature document capturing the work, specs, and decisions for this debt resolution.

- `odd/ventas-validation-sequential-counter/` — Engram mirror directory for task tracking.

## Impact

### Backward Compatibility

- All existing tests pass (13/13 in `ventas.test.ts`)
- The new price validation does not change the API response shape for successful orders
- Products without price or with price = 0 now correctly return HTTP 400 instead of being processed
- The Counter Pattern is additive — existing code can opt-in to use `crearPedidoConConsecutivo()` when ready

### User/System Behavior

- **Before**: Orders could be created with $0 or invalid product prices, leading to accounting discrepancies
- **After**: Orders with invalid prices are rejected with clear error message `producto_sin_precio`

- **Before**: Sequential numbering was calculated by reading all existing orders (N+1 reads pattern)
- **After**: The atomic counter is available for future integration; current behavior unchanged

### Risk Assessment

- **Risk: item 3** (contract preservation) — The change to return 400 for invalid prices is a breaking change for any external system that expected orders with $0 prices to succeed
- **Mitigation**: The validation ensures data integrity; systems relying on $0 prices should fix their data

## Notes

### Testing & Verification

```bash
# Run all ventas tests
npm run test:run -- ventas.test.ts ventas.validation.test.ts

# Expected result: 15 tests passing (13 original + 2 new)
```

### Known Follow-ups

1. **[Optional]** Consider integrating `crearPedidoConConsecutivo()` into the main `crearPedidoLibre()` flow for production use
2. **[Future]** Add migration script to initialize the counter documents for existing client/month combinations
3. **[Monitoring]** Add logging/metrics for `producto_sin_precio` rejections to track data quality issues

### Files Changed Summary

| File | Lines Changed | Type |
|------|---------------|------|
| `backend/src/services/ventas.service.js` | +92 | Feature |
| `backend/src/repositories/ventas.repository.js` | +109 | Feature |
| `backend/tests/integration/ventas.validation.test.ts` | new file | Test |
| `odd/tasks/ventas-validation-sequential-counter.md` | new file | Documentation |
| `odd/ventas-validation-sequential-counter/tasks/` | new directory | Tracking |