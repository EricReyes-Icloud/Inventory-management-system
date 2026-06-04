# Exploration: Historico_Mensual Usage & Inconsistencies

## Current State — Data Flow

```
                    ┌──────────────────────────────────────────┐
                    │     jobContableMensual.js (Cron Job)     │
                    │  Reads: Ventas/{clienteId}/Pedidos/...   │
                    │  Writes: Total Productos/{mesAnio}       │
                    │          Cartones_vendidos/{mesAnio}     │
                    └────────────────┬─────────────────────────┘
                                     │
                                     ▼
              ┌──────────────────────────────────────────┐
              │    Total Productos/{mesAnio}             │
              │    └─ productos/{categoria}/skus/{sku}   │
              │    Cartones_vendidos/{mesAnio}            │
              │    └─ productos/{categoria}/skus/{sku}   │
              └────────────────┬─────────────────────────┘
                               │
              ┌────────────────┴─────────────────┐
              │                                  │
              ▼                                  ▼
┌─────────────────────────┐       ┌─────────────────────────────┐
│ cierreMensual.service.js│       │ contabilidad.service.js     │
│ cerrarMesContable()     │       │ generarHistoricoMensual()   │
│ ⚠️ BROKEN: uses db     │       │ ✅ Uses repo methods        │
│    directly + undefined │       │                            │
│    contabilidadRepo ref │       │                            │
│                         │       │                            │
│ STRUCTURE WRITTEN:      │       │ STRUCTURE WRITTEN:         │
│ { totalProductos:       │       │ { totalProductos:          │
│     { total: N },       │       │     { categoria: {         │
│   cartonesVendidos:     │       │         total: N,          │
│     { total: N }        │       │         skus: { sku: N }   │
│ }                       │       │     }}                     │
└─────────────────────────┘       │   cartonesVendidos: { ... }│
                                  │ }                          │
                                  └─────────────┬───────────────┘
                                                │
                                                ▼
                                  ┌─────────────────────────────┐
                                  │   Historico_Mensual/{mes}   │
                                  │   (Expected by ganancias)   │
                                  │                             │
                                  │   .totalProductos.{cat}.total │
                                  │   .cartonesVendidos.{cat}.total│
                                  │   .totalProductos.{cat}.{sku} │
                                  └─────────────┬───────────────┘
                                                │
                                                ▼
                                  ┌─────────────────────────────┐
                                  │  ganancias.service.js       │
                                  │  cerrarGananciasPorCategoria│
                                  │  ⚠️ BROKEN: reads          │
                                  │  Historico_Mensual directly │
                                  │  + reads Invertir directly  │
                                  │  + undefined costosVarsRef  │
                                  │                             │
                                  │  Writes: Ganancias/{mes}   │
                                  │  Writes: Invertir/{cat}/    │
                                  │    historico_compras/{mes}  │
                                  └─────────────────────────────┘
```

## Collections Map

| Collection | Reads From | Writes To | Role |
|---|---|---|---|
| `Total Productos/{mesAnio}` | cierreMensual.service, contabilidad.service, admin.actions.service, contabilidad.repository | jobContableMensual (via contabilidad.repository.buildOperacionesContables) | **Live accumulator** — running totals for the current open month |
| `Cartones_vendidos/{mesAnio}` | cierreMensual.service, contabilidad.service, admin.actions.service, contabilidad.repository | jobContableMensual (via contabilidad.repository.buildOperacionesContables) | **Live accumulator** — running carton counts for the current open month |
| `Historico_Mensual/{mesAnio}` | ganancias.service.js (direct db call) | cierreMensual.service (BROKEN), contabilidad.service.generarHistoricoMensual | **Snapshot** — frozen copy of live accumulators at month-close |
| `Ganancias/{mesAnio}` | admin.actions.service (reads return value) | ganancias.service.js (direct db call) | **Derived** — calculated earnings per category per month |
| `Invertir/{categoria}` | admin.repository.getInversion | (admin UI) | **Configuration** — fixed/variable cost definitions per category |
| `Invertir/{categoria}/costos_fijos` | ganancias.service.js (direct db call) | (admin UI) | **Configuration** — fixed costs subcollection |
| `Invertir/{categoria}/costos_variables` | ganancias.service.js (direct db call) | (admin UI) | **Configuration** — variable costs subcollection |
| `Invertir/{categoria}/historico_compras` | (none currently) | ganancias.service.js (direct db call) | **Archive** — snapshot of variable costs at month-close |
| `Cierres_contables/{mesAnio}` | admin.repository.getCierresContables | admin.repository.setCierreContable | **Audit** — per-category closure records |
| `AdminActions/{mesAnio}` | (none currently) | admin.repository.setAdminAction | **Audit** — admin action log |

## Inconsistencies Found

### CRITICAL 1: `cierreMensual.service.js` is BROKEN

```js
// Line 2: imports db directly
const db = require("../lib/firestore");

// Line 53: calls contabilidadRepo which is NEVER imported
await contabilidadRepo.setHistoricoMensual(mesAnio, { ... });
```

This file uses `db.collection("Total Productos")` directly (lines 17-18) instead of `contabilidadRepo.getTotalProductos()`. It also calls `contabilidadRepo.setHistoricoMensual()` without importing the repository. **This function cannot run as-is — it will throw a ReferenceError.**

### CRITICAL 2: `ganancias.service.js` has undefined variable `costosVariablesRef`

```js
// Line 236:
await costosVariablesRef.set(resetData, { merge: true });
// ^ costosVariablesRef is NEVER defined anywhere in the function
```

This is a **runtime crash**. The variable `costosVariablesRef` is referenced but never assigned. This means the "reiniciar costos variables" step (resetting variable costs after earnings calculation) will fail every time.

### CRITICAL 3: Two different `Historico_Mensual` write paths with INCOMPATIBLE structures

**Path A** — `cierreMensual.service.js` (even if it worked):
```js
await contabilidadRepo.setHistoricoMensual(mesAnio, {
  totalProductos: totalSnap.data(),  // flat: { total: N }
  cartonesVendidos: cartonesSnap.data(),  // flat: { total: N }
  estado: "cerrado",
  generadoEn: new Date(),
});
```

**Path B** — `contabilidad.service.js`:
```js
await contabilidadRepo.setHistoricoMensual(mesAnio, {
  totalProductos,  // nested: { categoria: { total: N, skus: { sku: N } } }
  cartonesVendidos,  // nested: { categoria: { total: N, skus: { sku: N } } }
});
```

**Path C** — what `ganancias.service.js` EXPECTS to read:
```js
historico.totalProductos?.[categoria].total  // needs nested per-categoria
historico.cartonesVendidos?.[categoria]?.total  // needs nested per-categoria
```

**Only Path B produces the structure that `ganancias.service.js` expects to read.** Path A would write a flat structure that ganancias cannot parse.

### CRITICAL 4: `ganancias.service.js` uses direct Firestore access (not repository)

```js
const db = require("../lib/firestore");  // Line 2 — direct import

// Reads Historico_Mensual directly (line 22-25)
db.collection("Historico_Mensual").doc(mesAnio).get()

// Reads Invertir/costos_fijos directly (line 66-71)
db.collection("Invertir").doc(categoria).collection("costos_fijos")...

// Reads Invertir/costos_variables directly (line 113-118, 148-153)
// Writes Ganancias directly (line 201-204)
// Writes Invertir/historico_compras directly (line 212-223)
```

This service completely bypasses the repository layer. It directly touches 4 different Firestore paths: `Historico_Mensual`, `Ganancias`, `Invertir` (main + 2 subcollections + historico_compras).

### CRITICAL 5: `ventas.js` imports non-existent function

```js
const { calcularGananciasInterno } = require("../services/ganancias.service");
```

The `ganancias.service.js` file only exports `cerrarGananciasPorCategoria`. There is no `calcularGananciasInterno` function. **The `/calcular-ganancias` endpoint will crash at runtime.**

### MINOR 6: `admin.repository.js` doesn't expose Invertir subcollections

`admin.repository.js` has `getInversion(categoria)` for the main doc, but `ganancias.service.js` needs:
- `Invertir/{categoria}/costos_fijos/costos_fijos` (subcollection → doc)
- `Invertir/{categoria}/costos_variables/{producto}` (subcollection → doc)
- `Invertir/{categoria}/historico_compras/{mesAnio}` (subcollection → doc)

These subcollection reads are NOT exposed in any repository.

### MINOR 7: Two services generate Historico_Mensual but neither is clearly the canonical one

- `cierreMensual.service.cerrarMesContable()` — called from admin routes (but broken)
- `contabilidad.service.generarHistoricoMensual()` — never appears to be called from any route or job

Neither method is invoked by `jobContableMensual.js`. The job only writes to `Total Productos` and `Cartones_vendidos`. **Who triggers the snapshot into `Historico_Mensual`?** There is no clear caller.

## Affected Areas

### Must be modified in Fase 4:

| File | Why |
|---|---|
| `backend/src/repositories/contable.repository.js` | **NEW** — must handle `Invertir` subcollections (costos_fijos, costos_variables, historico_compras) and `Ganancias` reads/writes |
| `backend/src/services/ganancias.service.js` | **MAJOR REFACTOR** — replace all 6+ direct `db.collection()` calls with repository methods; fix `costosVariablesRef` bug; clarify `calcularGananciasInterno` |

### Should be fixed (blocking bugs):

| File | Issue |
|---|---|
| `backend/src/services/cierreMensual.service.js` | Broken: missing `contabilidadRepo` import; uses `db` directly instead of repo |
| `backend/src/routes/ventas.js` | Broken: imports non-existent `calcularGananciasInterno` |

### Already migrated (completed in Fases 1-3):

| File | Status |
|---|---|
| `backend/src/services/contabilidad.service.js` | ✅ Uses `contabilidadRepo` |
| `backend/src/services/admin.actions.service.js` | ✅ Uses `contabilidadRepo` + `adminRepo` |
| `backend/src/jobs/jobContableMensual.js` | ✅ Uses `ventasRepo` + `contabilidadRepo` (still uses `db` for batch) |
| `backend/src/repositories/contabilidad.repository.js` | ✅ Complete |
| `backend/src/repositories/admin.repository.js` | ✅ Complete (missing Invertir subcollections) |

## Recommendation

### For Fase 4 — `contable.repository.js` + `ganancias.service.js` refactor:

1. **Create `contable.repository.js`** with methods for:
   - `getCostosFijos(categoria)` → `Invertir/{categoria}/costos_fijos/costos_fijos`
   - `getCostosVariablesPorProducto(categoria, producto)` → `Invertir/{categoria}/costos_variables/{producto}`
   - `getCostosVariables(categoria)` → `Invertir/{categoria}/costos_variables/costos_variables`
   - `setGanancias(mesAnio, categoria, data)` → write to `Ganancias/{mesAnio}`
   - `setHistoricoCompras(categoria, mesAnio, data)` → write to `Invertir/{categoria}/historico_compras/{mesAnio}`
   - `resetCostosVariables(categoria, keys)` → zero out variable costs after close

2. **Refactor `ganancias.service.js`** to use `contable.repository` for ALL Firestore access. Fix the `costosVariablesRef` bug by using the new repository method.

3. **Fix `cierreMensual.service.js`** — either:
   - Add proper `contabilidadRepo` import and use it, OR
   - Deprecate it in favor of `contabilidad.service.generarHistoricoMensual()`

4. **Fix `ventas.js`** — either add `calcularGananciasInterno` to ganancias.service or remove the dead endpoint.

5. **Decide the canonical Historico_Mensual generation path** — currently unclear which method should be called and by whom. This is a data flow decision that should be resolved.

### What NOT to do:

- Do NOT change the Firestore data model or collection structure (out of scope per proposal)
- Do NOT move business logic into repositories — they stay as pure data access

## Risks

1. **Runtime crashes in production**: `cierreMensual.service.js` and `ganancias.service.js` have undefined variable references. These may have been "working" if these code paths were never actually executed, OR they may be causing silent failures.

2. **Structural mismatch risk**: If someone calls `cierreMensual.cerrarMesContable()` (Path A), it writes a flat structure to `Historico_Mensual` that `ganancias.service.js` cannot read. This would silently produce wrong earnings calculations.

3. **Missing caller for Historico_Mensual**: Neither service that generates the monthly snapshot appears to be called automatically. The monthly close may be incomplete or manual.

4. **Breaking the `/calcular-ganancias` endpoint**: If this endpoint is being used by the frontend, fixing the import will change its behavior. If it's dead code, removing it is safe.

5. **Invertir subcollection access is scattered**: Moving `ganancias.service.js` to use a repository changes WHERE the Firestore access happens. Need to ensure all 4 Invertir paths (main, costos_fijos, costos_variables, historico_compras) are covered by the new repository.

## Ready for Proposal

**No** — three blockers before proceeding:

1. The `costosVariablesRef` bug in `ganancias.service.js` (line 236) needs clarification: what was the intended behavior? Should it zero out the costos_variables document? Which document exactly?

2. The `calcularGananciasInterno` import in `ventas.js` (line 221) — is this dead code or should this function exist? What should it do?

3. The canonical path for generating `Historico_Mensual` needs to be decided: is it `cierreMensual.service.cerrarMesContable()` or `contabilidad.service.generarHistoricoMensual()`? And who calls it (admin route? cron job? both)?
