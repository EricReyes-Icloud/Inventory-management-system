# PR-033: Admin Routes Quality Improvements

## Description

This PR addresses three technical debt issues in the admin routes:

1. **Route prefix inconsistency**: `admin.button.routes.js` was mounted at `/admin` while all other admin routes use `/api/admin`.
2. **Superficial validation**: `mesAnio` parameter was only checked for presence, not format. Values like `"banana"` or `"2026-13"` would only fail later in the service layer.
3. **Error message leakage**: Internal error messages from Firestore/infrastructure were exposed to clients, risking information disclosure.

The fix adds proper input validation, error type differentiation, and safe error messaging while maintaining backward compatibility.

---

## Changes Made

### Features
- **``backend/src/utils/fechas.js``** — Added `validateMesAnio(mesAnio)` function that validates the format "Mes AAAA" (e.g., "Junio 2026"), checking for valid Spanish month names and integer years between 2000-2100.
- **``backend/src/lib/errorHandler.js``** — Added new module with `safeErrorMessage(error)` that returns user-safe messages. Validates errors against an allowlist of business error codes and returns "Error interno del servidor" for infrastructure errors.

### Refactors
- **``backend/src/index.js``** — Changed route mount from `"/admin"` to `"/api/admin"` for consistency with other admin routes.
- **``backend/src/routes/admin.button.routes.js``** — Integrated `validateMesAnio` for input validation and `safeErrorMessage` for error handling. Split validation into: (1) `mesAnio` format, (2) `categoria` presence/non-empty.
- **``backend/src/routes/admin.contabilidad.routes.js``** — Replaced superficial `!mesAnio` check with `validateMesAnio(mesAnio)`. Updated error handling to use `safeErrorMessage`.
- **``backend/src/services/admin.actions.service.js``** — Added `code` property to all business errors thrown by `cerrarCategoria` (e.g., `"NO_EXISTE_TOTAL_PRODUCTOS"`, `"CATEGORIA_SIN_VENTAS"`).

### Tests
- **``backend/tests/integration/admin.routes.test.ts``** — Updated all test URLs from `/admin/cerrar-categoria` to `/api/admin/cerrar-categoria`. Added 6 new test cases:
  - Rejects `mesAnio` values like `"banana"` with proper format error (S2)
  - Rejects `mesAnio` values like `"2026-13"` with month validation error (S2)
  - Rejects missing `categoria` with proper error message (S2)
  - Returns generic "Error interno del servidor" for infrastructure errors, never exposing stack traces (S3)
  - Returns domain error messages for known business errors (S3)

---

## Impact

- **Route consolidation**: All admin endpoints now consistently use `/api/admin` prefix, improving API consistency and reducing cognitive load for developers.
- **Better input validation**: Invalid month/year formats are rejected at the API boundary with clear error messages, improving developer experience and reducing debugging time.
- **Security improvement**: Infrastructure errors (Firebase connection issues, etc.) no longer leak internal details to clients. Only validated business errors reach the response.
- **Backward compatibility**: The route change from `/admin` to `/api/admin` affects external consumers. If there are external integrators using `POST /admin/cerrar-categoria`, they need to update to `POST /api/admin/cerrar-categoria`. No database migrations required.

---

## Notes

### How to verify
```bash
cd backend
npm test tests/integration/admin.routes.test.ts
```

Suite should pass: 14/14 tests in admin.routes.test.ts, 296/296 total.

### Known follow-up
- Consider extracting the error allowlist (`ALLOWED_ERROR_CODES`) to a shared configuration if other services need similar safe error handling.
- The `validateMesAnio` function could be reused in other routes that accept `mesAnio` (e.g., any route dealing with monthly accounting data).

### Related
- Depends on: None
- Related issues: Deuda técnica - admin.button.routes.js