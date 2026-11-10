# Feature: closed-month-contabilization-guard

**Objective:** Block accounting writes to `Total Productos` / `Cartones_vendidos` for a month that is already closed, and park the affected orders with a visible terminal state.
**Branch:** feat/backend-robustez | **Delivery:** ask-on-risk (single PR, forecast < 400 authored lines) | **Runner:** `npm run test:ci` (backend)

## Specs

- **S1 — Closed-month guard.** `processPendingOrders` MUST NOT emit any write to `Total Productos/{mesAnio}` or `Cartones_vendidos/{mesAnio}` when that month is closed. "Closed" means `Historico_Mensual/{mesAnio}` exists, because that document is the accounting freeze point (`contabilidad.service.js` writes `estado: "cerrado"` there and refuses to regenerate it). `Ganancias` is derived from that snapshot and may be partial, so it is not the primary signal.
- **S2 — Canonical month.** The guard MUST derive the target month with `obtenerMesAnio(fechaPedido)` from `backend/src/utils/fechas.js`, never with the Pedidos path key. The path key is produced by `toLocaleString("es-CO")` (`"Septiembre de 2025"`) while the accounting documents use `"Septiembre 2025"`; keying the guard to the path makes it read a document that never exists.
- **S3 — Parked order.** When the guard blocks an order, the job MUST commit exactly one atomic batch containing one `update` on that order and zero accounting operations, with:
  - `estadoContable: "rechazado_mes_cerrado"`
  - `contabilidadAplicada: false`
  - `motivoRechazo: "mes_cerrado"`
  - `mesCerradoObjetivo: <mesAnio canónico>`
  - `fechaRechazo: <Date>`
  - `pagado` left untouched.
- **S4 — Reported counters.** `processPendingOrders` MUST return `pedidosRechazados` in addition to `pedidosProcesados` and `pedidosFallidos`. Existing counter semantics stay unchanged.
- **S5 — Close fail-fast.** `cerrarMes` MUST fail before Stage 1 when `Historico_Mensual/{mesAnio}` already exists, with `error.code === "MES_YA_CERRADO"`. Today it only discovers this in Stage 2, after Stage 1 has already contabilized orders.
- **S6 — No snapshot with live debt.** `cerrarMes` MUST fail before Stage 2 when pending paid orders still exist for that month, with `error.code === "PEDIDOS_PENDIENTES"`.
- **S7 — Open-month regression.** For a month without `Historico_Mensual`, `processPendingOrders` MUST behave exactly as before: same accounting writes, same `estadoContable: "procesado"`, same counters.
- **S8 — Read-only audit.** A script MUST report, without writing anything, the months where a closed category (present in `Ganancias`) still has a non-zero live total in `Total Productos` or `Cartones_vendidos`. Closed categories are zeroed on purpose by `limpiarCategoriaTotal` / `limpiarCategoriaCartones`, so a non-zero total is the footprint of a post-close write. The script MUST require explicit invocation and MUST never run automatically.
- **S9 — No false "open" flag.** The accounting batch MUST NOT rewrite `estado: "abierto"` on `Total Productos` / `Cartones_vendidos`; that field currently "reopens" a closed month on every late contabilization and has no readers.

**Assumptions (not user requirements):**
- Month-level blocking is correct instead of per-category, because `cerrarGananciasPorCategoria` refuses to run without `Historico_Mensual`, so the snapshot is always frozen first; a late write can never reach `Ganancias` afterwards.
- Rejection is whole-order, not per-item, because an order is an atomic business event and a split would leave `contabilidadAplicada` ambiguous.
- Production audit execution is out of scope for this change; the script is delivered and the operator runs it.

## Tasks

- **T1** — `isMesCerrado` + guard + parked state + counter (S1, S2, S3, S4, S7, S9) — inline — **DONE** (integration 12/12; unit job mock updated for `isMesCerrado`)
- **T2** — `cerrarMes` fail-fast + Stage 2 pending-orders precheck (S5, S6) — inline — **DONE** (orchestrator 9/9, flow suite green, RED observed first)
- **T3** — read-only closed-month audit service + script (S8) — inline — **DONE** (6/6 unit tests, RED observed first)

## Log

- **L1 (2026-11-10, verbatim):** "No permitir que se agregen mas pedidos a Total Productos y Cartones vendidos si ese mes ya esta cerrado en Historico y Ganancias."
- **L2 (2026-11-10, verbatim):** "Si, estacionemoslo." — decision on the blocking policy: a paid order that lands on a closed month is parked as `rechazado_mes_cerrado` (visible, out of the pending queue, manual resolution) instead of failing the whole job.
- **L3 (2026-11-10):** `gentle-ai-explore` verdict REAL. Evidence: `jobContableMensual.js:52-106` has no closed-month check; `contabilidad.repository.js:169-246` derives its own month with `obtenerMesAnio(fechaPedido)`; `monthlyClosing.orchestrator.js:37` processes every client and every month in Stage 1; `contabilidad.service.js:27-30` refuses to regenerate the snapshot.
- **L4 (2026-11-10):** Senior proposal accepted. Three layers (guard at the write choke point, orchestrator freeze, structural hygiene) plus a read-only audit. `Risk: items 1 and 6` (data irreversibility, no test coverage).
- **L5 (2026-11-10):** T1 implemented and green — `npx vitest run tests/integration/jobContable.test.ts` → 12/12. Changed: `backend/src/jobs/jobContableMensual.js` (closed-month guard, parked state, `pedidosRechazados` counter), `backend/src/repositories/contabilidad.repository.js` (`isMesCerrado` + removed `estado:"abierto"` from the two main-document merges), `backend/tests/integration/jobContable.test.ts` (Historico-aware `db.doc` mock, `marcarMesCerrado`, 5 new guard tests, counters updated). T2 RED tests written in `backend/tests/unit/services/monthlyClosing.orchestrator.test.ts` (mock exports `assertMesNoCerrado` / `assertSinPedidosPendientes` + 2 failing tests); the service and orchestrator implementation is NOT written yet. Nothing committed. Session stopped on user request before compaction.
- **L6 (2026-11-10):** T2 + T3 implemented. T2: `assertMesNoCerrado` / `assertSinPedidosPendientes` exported from `contabilidad.service.js` (typed `code` preserved by calling them outside the stage `try` blocks), wired before Stage 1 and Stage 2 in `monthlyClosing.orchestrator.js`. RED observed first (module missing), then orchestrator 9/9. Fixed collateral: unit job mock gained `isMesCerrado`, `contabilidad.test.ts` export list + 6 new precheck tests, flow mock now applies `batch.update` payloads and filters the collectionGroup by pending+paid, FLUJO-EDGE-002 now asserts the pre-Stage-1 fail-fast. T3: `auditClosedMonths.service.js` (read-only), `getTodasGanancias` in `contable.repository.js`, explicit script `scripts/audit-closed-months.js`, 6 unit tests (RED observed first). Full suite: `npm run test:ci` → 30 files / 318 tests green.
