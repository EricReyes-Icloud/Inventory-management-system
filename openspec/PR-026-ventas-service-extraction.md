# PR-026-ventas-service-extraction

## Description

This change removes the self-HTTP call from the WhatsApp order path by extracting the free-order (`pedido-libre`) logic into `backend/src/services/ventas.service.js` and having the WhatsApp brain call that service directly. A validated configuration module (`backend/src/config.js`) is introduced and consumed by `backend/src/index.js` to centralize PORT handling. Finally, `backend/src/whatsapp/index.js` is updated to report registration failures to the customer with a safe error message, avoiding false confirmations when order registration fails.

The main motivation is to eliminate unnecessary network hops (axios/localhost self-call), make the order logic testable and reusable, centralize validated environment configuration, and ensure customers are correctly informed on failure without leaking internal errors.

## Changes Made

### Features
- `backend/src/config.js`: Added validated PORT configuration module.
- `backend/src/services/ventas.service.js`: New service to encapsulate `pedido-libre` order logic (registration/processing) extracted from the route.

### Configuration
- `backend/src/index.js`: Use `config.port` instead of ad-hoc PORT handling.
- `backend/tests/unit/config.test.ts`: Added unit tests for the validated config module.

### Refactors
- `backend/src/routes/ventas.js`: Thin adapter over the new `ventas.service.js`; moved business logic out of the route layer.
- `backend/src/brain/inturis.js`: Call the ventas service directly (drop axios and localhost:4000 self-HTTP call). Interpretation happens once.
- `backend/tests/integration/ventas.test.ts`: Updated to cache/use the service appropriately for integration testing.

### Bug fixes
- `backend/src/whatsapp/index.js`: On WhatsApp order registration failure, report to the customer: `"⚠️ No pudimos registrar tu pedido..."` instead of sending a false confirmation.

## Impact

- **Behavior**: WhatsApp flow no longer makes an internal HTTP call to register orders; failures now produce a safe customer-facing error message and do not result in false confirmations.
- **Architecture**: Business logic for `pedido-libre` is separated from transport (routes/brain/whatsapp), improving testability and reuse.
- **Configuration**: PORT is centralized and validated via `config.js`.
- **Backward compatibility**: Public API contract and customer-facing copy preserved where specified; internal call path removed (no external API changes).
- **Risks**: High-risk areas touched (public API contract, customer-facing copy). Changes verified by passing tests (198/198).

## Notes

- **Tests**: All tests passing (198/198).
- **Removed**: axios usage and localhost:4000 self-call from source.
- **Verification**: Failed WhatsApp orders now return the error message `"⚠️ No pudimos registrar tu pedido..."`; interpretation occurs once in the direct service call path.
