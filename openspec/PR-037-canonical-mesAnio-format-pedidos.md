# PR-037: Canonical mesAnio Format in Pedidos Path

## Description

This PR unifies the month-year format (`mesAnio`) used across the codebase by changing the Pedidos collection path to use the canonical `"Mes AAAA"` format (e.g., `"Septiembre 2025"`) instead of the locale-specific `"Mes de AAAA"` format (e.g., `"Septiembre de 2025"`).

Previously, two competing producers existed:
- **Accounting layer** (`Total Productos`, `Cartones_vendidos`, `Historico_Mensual`, `Ganancias`): used `obtenerMesAnio(fecha)` → `"Septiembre 2025"`
- **Pedidos layer** (`Ventas/{clienteId}/Pedidos/{mesAnio}`): used `fecha.toLocaleString("es-CO")` → `"Septiembre de 2025"`

The accounting pipeline already derived the target month from `fechaPedido` via `obtenerMesAnio`, so the mismatch only affected the Pedidos document path. This created a latent risk: queries crossing Pedidos and accounting collections would silently fail to match, and `validateMesAnio` rejected the "de" format.

## Changes Made

### Bug Fixes

- **`backend/src/services/ventas.service.js`**
  - Added import: `const { obtenerMesAnio } = require("../utils/fechas");`
  - Replaced `toLocaleString("es-CO", { month: "long", year: "numeric" })` with `obtenerMesAnio(fecha)` for the `mesAnioKey` used in `setPedidoMes` and `getPedidos` calls
  - Removed the manual capitalization logic (`mesAnio.charAt(0).toUpperCase() + mesAnio.slice(1)`) since `obtenerMesAnio` already returns properly capitalized month names

## Impact

- **New Pedidos documents** are now written under the canonical path format (e.g., `Ventas/{clienteId}/Pedidos/Septiembre 2025/pedidos/...`), matching the accounting collections' document IDs
- **Job contable (`processPendingOrders`)** is unaffected — it already derived the accounting month from `fechaPedido` via `obtenerMesAnio`
- **Historical Pedidos documents** under the old `"Septiembre de 2025"` path remain in Firestore but are orphaned from new queries; no migration is performed (acceptable per team decision)
- **`validateMesAnio`** now accepts the format natively written by the Pedidos layer
- **Backward compatibility**: Read operations (`getPedidos`, `getMesesPedidos`) receive the `mesAnio` parameter from callers, so they work with whatever format is passed; new writes use the canonical format

## Notes

### Verification
- Full backend test suite passes: 318 tests green
- Key integration tests validated:
  - `tests/integration/ventas.test.ts` — 15 tests (happy path, validation, rate limiting)
  - `tests/integration/ventas.validation.test.ts` — price validation scenarios
  - `tests/integration/jobContable.test.ts` — 12 tests including `INT-GUARD-002` (guard keys on `obtenerMesAnio`)
  - `tests/unit/services/contabilidad.test.ts` — 16 tests
  - `tests/unit/repositories/contabilidad.repository.test.ts` — 12 tests

### Follow-up (deferred)
- If historical reporting on pre-fix months is needed, a one-off migration script can be written to copy `Ventas/{clienteId}/Pedidos/{mesConDe}/pedidos/*` → `Ventas/{clienteId}/Pedidos/{mesSinDe}/pedidos/*` and delete empty parent documents
- The two competing producers are now unified; `mesAnio` has a single source of truth: `obtenerMesAnio`

### Related
- PR-036 (closed-month-contabilization-guard) documented this discrepancy as an open follow-up; this PR resolves it
- `odd/tasks/closed-month-contabilization-guard.md` references the mismatch in S2 and open follow-ups