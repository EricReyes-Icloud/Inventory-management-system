# Design: Repository Layer

## 1. Arquitectura General

```
┌─────────────────────────────────────────────────────────┐
│                       ROUTES                            │
│  ventas.js  productos.js  admin.contabilidad.routes.js  │
└──────────────────┬──────────────────────────────────────┘
                   │  require()
                   ▼
┌─────────────────────────────────────────────────────────┐
│                      SERVICES                           │
│  contabilidad.service.js   cierreMensual.service.js     │
│  admin.actions.service.js  ganancias.service.js         │
└──────────────────┬──────────────────────────────────────┘
                   │  require()
                   ▼
┌─────────────────────────────────────────────────────────┐
│                    REPOSITORIES    ← NUEVA CAPA         │
│  contabilidad.repository.js  ventas.repository.js       │
│  productos.repository.js     contable.repository.js     │
│  admin.repository.js                                    │
└──────────────────┬──────────────────────────────────────┘
                   │  require()
                   ▼
┌─────────────────────────────────────────────────────────┐
│                   LIB (FIREBASE)                        │
│  lib/firestore.js  ← Único punto de acceso a Firestore  │
└─────────────────────────────────────────────────────────┘
```

**Principio**: los SERVICES importan REPOSITORIES, los REPOSITORIES importan `firestore.js`.
Los ROUTES pueden seguir importando SERVICES directamente (no cambian).

## 2. Patrón de Diseño: Repository Funcional

**Decisión: Funcional > Clases** por:

| Razón | Detalle |
|---|---|
| Proyecto CommonJS | module.exports functions > class + new |
| Simplicidad | Sin this, sin bind, sin herencia |
| Testabilidad | vi.spyOn(repo, "fn") directo sobre el objeto exportado |
| Cohesión | Cada función hace una cosa, fácil de entender |

Cada repository:
- Importa `db` desde `../lib/firestore` (NO recibe db como parámetro)
- Exporta funciones sueltas agrupadas por dominio
- Usa `FieldValue` de firebase-admin cuando necesita increments/serverTimestamps

## 3. Diseño del Piloto: `contabilidad.repository.js`

### Contrato de funciones

```js
const db = require("../lib/firestore");
const { FieldValue } = require("firebase-admin/firestore");

// ─── PATH BUILDERS ───
// Centralizados para consistencia y fácil modificación

function pathTotalProductos(mesAnio)    { return `Total Productos/${mesAnio}`; }
function pathCartonesVendidos(mesAnio)  { return `Cartones_vendidos/${mesAnio}`; }
function pathHistoricoMensual(mesAnio)  { return `Historico_Mensual/${mesAnio}`; }

// ─── LECTURAS ───

/**
 * Obtiene el documento de Total Productos para un mes.
 * @param {string} mesAnio - "Enero 2026"
 * @returns {Promise<FirebaseFirestore.DocumentSnapshot | null>}
 */
async function getTotalProductos(mesAnio) { ... }

/**
 * Obtiene el documento de Cartones Vendidos para un mes.
 */
async function getCartonesVendidos(mesAnio) { ... }

/**
 * Obtiene el documento del Histórico Mensual para un mes.
 */
async function getHistoricoMensual(mesAnio) { ... }

/**
 * Obtiene todas las categorías (subdocs) de Total Productos para un mes.
 * @returns {Promise<FirebaseFirestore.QuerySnapshot>}
 */
async function getCategoriasTotalProductos(mesAnio) { ... }

/**
 * Obtiene todos los SKUs de una categoría en Total Productos.
 */
async function getSkusTotalProductos(mesAnio, categoria) { ... }

// Ídem para Cartones_vendidos...
async function getCategoriasCartonesVendidos(mesAnio) { ... }
async function getSkusCartonesVendidos(mesAnio, categoria) { ... }

// ─── BATCH OPERATIONS ───

/**
 * Construye las operaciones atómicas para contabilizar items.
 * Es la migración directa de calcularOperacionesTotalesYCartones()
 * del service actual, pero devolviendo { ref, data, options }[].
 * 
 * @param {Array} items - detalle del pedido
 * @param {Date} fechaPedido
 * @returns {Array<{ref: string, data: object, options: {merge: boolean}}>}
 */
function buildOperacionesContables(items, fechaPedido) { ... }

/**
 * Ejecuta un batch de operaciones atómicamente.
 * @param {Array<{ref: string, data: object, options?: object}>} operaciones
 * @returns {Promise<void>}
 */
async function executeBatch(operaciones) { ... }
```

### Migración: `calcularOperacionesTotalesYCartones` → `buildOperacionesContables`

La función actual vive en `contabilidad.service.js` y construye un array de operaciones con paths hardcodeados. La mudamos **identica** a `contabilidad.repository.js` porque:

1. Es lógica de acceso a datos (conoce paths de colecciones, usa `FieldValue`)
2. El service se queda solo con lógica de negocio (validar pedidos, orquestar)
3. La función `executeBatch()` se agregará como nuevo método del repo

### Ejecución batch en jobContableMensual

Actualmente `jobContableMensual.js` hace:
```js
const operaciones = calcularOperacionesTotalesYCartones(detalle, fecha);
const batch = db.batch();
for (const op of operaciones) {
  batch.set(db.doc(op.ref), op.data, op.options);
}
batch.update(pedidoRef, { estadoContable: "procesado", ... });
await batch.commit();
```

Con el repository:
```js
const operaciones = contabilidadRepo.buildOperacionesContables(detalle, fecha);
// Agregar update del pedido al batch desde el job (lógica de negocio)
await contabilidadRepo.executeBatch(operaciones);
// O mejor: el job recibe las ops y hace el batch él mismo
```

Decisión de diseño: **`executeBatch()` recibe el array de ops y el ref de pedido**, o el **job sigue armando el batch** y solo pide las ops al repo. Por ahora dejamos que el job arme el batch (menos cambio), y el repo solo expone `buildOperacionesContables()` y las funciones de lectura.

## 4. Estrategia de Inyección de Dependencias para Tests

### Repositorios reales: importan `db` directo

```js
const db = require("../lib/firestore");
```

### Tests de servicios: mockean el repository

```js
const contabilidadRepo = require("../../src/repositories/contabilidad.repository");
vi.spyOn(contabilidadRepo, "getTotalProductos").mockResolvedValue({...});
```

Esto **elimina la necesidad de `Module._cache`** porque el service ya no importa `firestore.js` directo. El mock se hace sobre el repository, no sobre firebase-admin.

### Tests de repositorios: integración con Firestore emulator

Los métodos del repository se testean contra el emulador de Firestore (futuro). Por ahora, tests unitarios básicos con mocks de `db`.

## 5. Estructura de Directorios

```
backend/src/
├── repositories/                    ← NUEVO
│   ├── contabilidad.repository.js   ← PILOTO
│   ├── ventas.repository.js
│   ├── productos.repository.js
│   ├── contable.repository.js
│   └── admin.repository.js
├── services/
│   ├── contabilidad.service.js      ← MODIFICADO (usa repo)
│   ├── cierreMensual.service.js     ← FUTURO
│   ├── admin.actions.service.js     ← FUTURO
│   └── ganancias.service.js         ← FUTURO (refactor completo después)
├── jobs/
│   └── jobContableMensual.js        ← MODIFICADO (usa repo)
├── routes/                          ← SIN CAMBIOS
├── lib/
│   └── firestore.js                 ← SIN CAMBIOS
└── index.js                         ← SIN CAMBIOS
```

**Regla de naming**: `{dominio}.repository.js` — PascalCase multicomponente, .repository.js sufijo.

## 6. Migración Incremental: Fases

### Fase 1 (este cambio) — PILOTO
1. Crear `repositories/contabilidad.repository.js` con:
   - `pathTotalProductos`, `pathCartonesVendidos`, `pathHistoricoMensual`
   - `getTotalProductos(mesAnio)`, `getCartonesVendidos(mesAnio)`, `getHistoricoMensual(mesAnio)`
   - `getCategoriasTotalProductos(mesAnio)`, `getSkusTotalProductos(mesAnio, categoria)`
   - `getCategoriasCartonesVendidos(mesAnio)`, `getSkusCartonesVendidos(mesAnio, categoria)`
   - `buildOperacionesContables(items, fechaPedido)` — desde contabilidad.service.js
   - `executeBatch(operaciones)`
2. Refactorizar `contabilidad.service.js`:
   - Reemplazar acceso directo a `db.collection()` por llamadas al repo
   - Mover `calcularOperacionesTotalesYCartones` → al repo como `buildOperacionesContables`
3. Refactorizar `jobContableMensual.js`:
   - Usar `contabilidadRepo.buildOperacionesContables()`
   - Usar `contabilidadRepo.executeBatch()` o mantener batch inline
4. Refactorizar `cierreMensual.service.js`:
   - Usar `contabilidadRepo.getTotalProductos()`, `getCartonesVendidos()`, `getHistoricoMensual()`
5. Ajustar tests: reemplazar `Module._cache` por `vi.spyOn`

### Fase 2 — VENTAS + PRODUCTOS
- Crear `ventas.repository.js`, `productos.repository.js`
- Refactorizar `routes/ventas.js`, `routes/productos.js`

### Fase 3 — ADMIN
- Crear `admin.repository.js`
- Refactorizar `routes/admin.contabilidad.routes.js`, `services/admin.actions.service.js`

### Fase 4 — CONTABLE (ganancias.service.js)
- Crear `contable.repository.js`
- Refactorizar `ganancias.service.js` (esto incluye replantear la lógica con colecciones reales)

## 7. Plan de Testing

| Nivel | Qué testea | Cómo | Herramienta |
|---|---|---|---|
| Unitario (servicios) | Servicios usan repo correctamente | `vi.spyOn(repo, "fn")` | Vitest |
| Unitario (repo) | Lógica de construcción de paths/ops | Función pura, sin mock | Vitest |
| Integración (repo) | Lectura/escritura real Firestore | Firestore emulator | Vitest + emulator |

Para el piloto nos enfocamos en:
- Tests unitarios del service mockeando el repo (eliminar `Module._cache`)
- Tests puros de `buildOperacionesContables` (no toca DB, solo construye objetos)
- Tests de regresión: los 11 tests existentes deben seguir pasando

## 8. Riesgos y Mitigaciones

| Riesgo | Mitigación |
|---|---|
| Batch operations pierden atomicidad | `executeBatch()` usa `db.batch()` internamente, misma atomicidad que hoy |
| Import circular entre repos | Prohibido: repos no se importan entre sí. Si necesitan datos de otro dominio, el service orquesta |
| Performance regression | Los repositories llaman a Firestore exactamente igual que hoy. Sin overhead adicional |
| Romper tests existentes | Migrar por fases, mantener tests viejos hasta que la fase esté completa |
| Categorías y SKUs paths incorrectos | `path*()` builders centralizados en el repo, un solo lugar a modificar |
