# PR-036: Prevent accounting writes into a closed month

## Description

A paid order could still be booked into `Total Productos` and `Cartones_vendidos` after its accounting month had already been closed. `processPendingOrders` processed every pending order it found, with no check against the closed-period state, and Stage 1 of `cerrarMes` iterated over all clients and all months. The practical consequence was silent corruption: the monthly snapshot in `Historico_Mensual` is frozen at close time and `Ganancias` is derived from that snapshot, so a late write never reaches `Ganancias` again and never appears in any report. It just leaves the live totals disagreeing with the closed books, permanently, with no trace pointing at when or why.

This PR adds the guard at the write choke point and freezes the close pipeline. A paid order whose period is already closed is no longer booked and no longer fails the job: it is parked with the terminal state `rechazado_mes_cerrado`, which takes it out of the pending queue and leaves it visible for manual resolution. The close flow now refuses to run on a month that is already closed, and refuses to generate a snapshot while the month still has pending paid orders. Both prechecks fire before the stages that would have caused damage, and carry typed error codes (`MES_YA_CERRADO`, `PEDIDOS_PENDIENTES`) so callers can branch on them.

The definition of "closed" is the existence of `Historico_Mensual/{mesAnio}`, because that document is the accounting freeze point: it is written with `estado: "cerrado"` and `generarHistoricoMensual` refuses to regenerate it. `Ganancias` is explicitly not used as the signal, since a per-category close can leave it partial while the snapshot is already frozen. A read-only audit script is included to find any month already corrupted by a post-close write, so existing damage can be located before this guard is relied upon.

## Changes Made

### Bug fixes

- **`backend/src/jobs/jobContableMensual.js`**
  - Added the closed-month guard in `processPendingOrders`. The target month is derived with `obtenerMesAnio(fechaPedido)`, never from the `Pedidos` path key. The path key is produced by `toLocaleString("es-CO")` (`"Septiembre de 2025"`) while the accounting documents use `"Septiembre 2025"`, so a guard keyed on the path would read a document that never exists and silently never fire.
  - Parked orders are written in a single atomic batch containing one `update` and zero accounting operations: `estadoContable: "rechazado_mes_cerrado"`, `contabilidadAplicada: false`, `motivoRechazo: "mes_cerrado"`, `mesCerradoObjetivo`, `fechaRechazo`. `pagado` is left untouched.
  - Added the `pedidosRechazados` counter to the return value and to the closing log line. `pedidosProcesados` and `pedidosFallidos` keep their previous semantics.
  - Closed-month lookups are memoized per month for the duration of a run, so the guard costs one `Historico_Mensual` read per month instead of one per order.

- **`backend/src/repositories/contabilidad.repository.js`**
  - Added `isMesCerrado(mesAnio)` — the single authoritative definition of a closed period, based on `Historico_Mensual` existence.
  - Removed `estado: "abierto"` from the main-document merges in `crearOperacionDocumentoPrincipal` and `crearOperacionCartonesPrincipal`. That field was rewritten on every late contabilization, effectively "reopening" closed months, and had no readers anywhere in the codebase.

- **`backend/src/services/monthlyClosing.orchestrator.js`**
  - Wired `assertMesNoCerrado` before Stage 1 and `assertSinPedidosPendientes` before Stage 2. Both are called outside the stage `try` blocks on purpose: the stage handlers wrap the message in a generic `Error` and would drop the typed `code`.

### Features

- **`backend/src/services/contabilidad.service.js`**
  - Added `assertMesNoCerrado(mesAnio)` — throws with `code = "MES_YA_CERRADO"` when `Historico_Mensual/{mesAnio}` exists.
  - Added `assertSinPedidosPendientes(mesAnio)` — throws with `code = "PEDIDOS_PENDIENTES"` and the pending count when paid orders for that month are still unbooked. Filters `getTodosPedidosPendientesGlobal()` by `obtenerMesAnio(fechaPedido)`, handling Firestore `Timestamp` via `toDate()`.

- **`backend/src/services/auditClosedMonths.service.js`** (new)
  - Read-only `auditClosedMonths()`. For every month present in `Ganancias`, it reads the live category totals and reports any that are non-zero. Closing a category zeroes its live totals through `limpiarCategoriaTotal` / `limpiarCategoriaCartones`, so a non-zero total on a closed category is the exact footprint of a post-close write. Returns findings as `{ mesAnio, categoria, totalLive, cartonesLive }`.

- **`backend/scripts/audit-closed-months.js`** (new)
  - Explicit-invocation wrapper for the audit. Exits `0` when clean, `1` when findings exist, `2` on error. Never registered in `package.json` scripts and never called from the app or the closing pipeline.

- **`backend/src/repositories/contable.repository.js`**
  - Added `getTodasGanancias()` — read-only collection read used by the audit.

### Tests

- **`backend/tests/integration/jobContable.test.ts`** — `Historico_Mensual`-aware `db.doc` mock plus `marcarMesCerrado` helper; 5 new guard tests: blocked write, canonical-month keying against a non-canonical path, parked payload shape and `pagado` untouched, open-month behavior unchanged, and no `estado` written on the main documents. Existing counter assertions updated.
- **`backend/tests/unit/services/monthlyClosing.orchestrator.test.ts`** — new precheck wiring: `cerrarMes` rejects with `MES_YA_CERRADO` before Stage 1, and with `PEDIDOS_PENDIENTES` before Stage 2, with the downstream stages asserted not called.
- **`backend/tests/unit/services/contabilidad.test.ts`** — 6 tests for the two prechecks: typed codes, month filtering that ignores other months, `Timestamp` handling.
- **`backend/tests/unit/services/auditClosedMonths.service.test.ts`** — new, 6 tests with mocked repositories, including an explicit negative assertion that no write function is ever called.
- **`backend/tests/flow/flujoCompleto.test.ts`** — `FLUJO-EDGE-002` now asserts the fail-fast happens before Stage 1.
- **`backend/tests/helpers/firestoreMock.ts`** — the mock now applies `batch.update` payloads and filters the `collectionGroup` query by pending and paid, so parked-order state is observable in tests.

### Documentation

- **`odd/tasks/closed-month-contabilization-guard.md`** (new) — feature specification (S1-S9), task breakdown (T1-T3) and decision log.

## Impact

**Behavior change.** Booking a late order into a closed month is no longer possible: the order is parked as `rechazado_mes_cerrado` instead. That state is terminal and leaves the pending queue, so parked orders require manual resolution — they will not be picked up by a later run. An operator now has to decide, per order, whether to reopen the month or adjust the books by hand.

`cerrarMes` on an already-closed month now fails immediately with `MES_YA_CERRADO` instead of proceeding through Stage 1 and surfacing a generic error later. This is strictly safer but is a contract change for any caller that treated a re-run as an idempotent retry: re-running a full close is now an explicit error. Per-category closures remain re-writable through merge, as before.

`cerrarMes` on a month that still has pending paid orders now fails with `PEDIDOS_PENDIENTES` before the snapshot is generated, instead of freezing a snapshot that excludes those orders. Callers must run the accounting job first, or accept that the month is not ready to close.

**Backward compatibility.** `processPendingOrders` returns an additional field. Existing consumers that destructure `pedidosProcesados` and `pedidosFallidos` keep working. For any month without a `Historico_Mensual` document, behavior is byte-for-byte unchanged: same accounting writes, same `estadoContable: "procesado"`, same counters.

`estado: "abierto"` is no longer written on `Total Productos` / `Cartones_vendidos`. A codebase-wide search for readers of that field returns nothing, so no consumer is affected. Documents that already carry the field keep it; it simply stops being rewritten.

**Risk.** This touches irreversible accounting data (High-risk item 1) and, before the guard existed, no test would have caught a post-close write (item 6). Both are pinned by tests now. The guard is fail-open in one specific case: if the parked-order write itself fails, the order is counted as failed and stays in the pending queue, so it will be retried on the next run rather than lost.

## Notes

**Verification performed.**
- Full backend suite: `cd backend && npm run test:ci` — 30 files, 318 tests, all green.
- Independent read-only verification against specs S1-S9 returned PASS on all nine with no defects.
- Native RDD review was declined for this candidate by the maintainer.

**How to test.**
```bash
cd backend
npx vitest run tests/integration/jobContable.test.ts
npx vitest run tests/unit/services/monthlyClosing.orchestrator.test.ts
npx vitest run tests/unit/services/contabilidad.test.ts
npx vitest run tests/unit/services/auditClosedMonths.service.test.ts
```

**Recommended first action after deploy.** Run the audit against production before trusting the guard, to find months already corrupted by earlier post-close writes:
```bash
cd backend && node scripts/audit-closed-months.js
```
This is read-only and exits `1` if it finds anything. Executing it against production was deliberately left out of scope for this PR: the operator runs it explicitly.

**Known follow-ups (not addressed here).**
- `mesAnio` has two competing producers in the codebase: `obtenerMesAnio` (`"Septiembre 2025"`) and `toLocaleString("es-CO")` at pedido creation (`"Septiembre de 2025"`). This PR guards against the mismatch but does not unify the producers; `validateMesAnio` still accepts only the first form.
- There is no writer of `pagado: true` in `backend/src` — the paid flag is flipped outside this codebase (console or script). The realistic corruption vector is exactly that: an order created before the close and flagged paid afterwards. This guard closes it, but the missing in-code ownership of `pagado` is worth addressing separately.
- Parked orders have no UI yet. They are visible in Firestore with `motivoRechazo` and `mesCerradoObjetivo`, but resolving one is currently a manual document edit.
- Production `Historico_Mensual` persists `skus` maps of numbers, while the `Miel` branch of `cerrarGananciasPorCategoria` reads a `productos` map of totals and cartones. That pre-existing data-shape drift is out of scope here.

**Commits in this PR.**
- `cef3e52` fix(contabilidad): guard closed months in pending-order accounting
- `6de8572` feat(contabilidad): fail fast before closing an already-closed month
- `c86b290` feat(contabilidad): add read-only closed-month audit

**Dependencies.** None. This PR builds on `jobContable-optimization` (PR-031), which introduced `getTodosPedidosPendientesGlobal()`; both the guard and `assertSinPedidosPendientes` rely on it.
