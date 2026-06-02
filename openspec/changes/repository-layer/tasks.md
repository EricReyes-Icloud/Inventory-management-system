# Tasks: Fase 2 — Ventas + Productos Repository

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~400-450 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes → 2 PRs |
| Suggested split | PR #1: productos.repository + PR #2: ventas.repository |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Base Branch |
|------|------|-----------|-------------|
| 1 | productos.repository.js + refactor routes/productos.js + tests | PR #1 | `feature/repository-layer-f2` (tracker) |
| 2 | ventas.repository.js + refactor routes/ventas.js + jobContableMensual.js + tests | PR #2 | PR #1 branch |

---

## PR #1: Repositorio de Productos

### Creación

- [x] 1.1 Crear `backend/src/repositories/productos.repository.js` con:
  - `getProducto(subcoleccion, docId)` → `Productos/Productos_ID/{subcoleccion}/{docId}`
  - `getAllProductos()` → listar `Productos` con sus subcolecciones
  - `buscarSubcoleccion(nombreSubcoleccion)` → `Productos/Productos_ID/{subcoleccion}` limit 1

### Refactor

- [x] 1.2 Refactorizar `backend/src/routes/productos.js`:
  - Reemplazar `db.collection("Productos").get()` → `productosRepo.getAllProductos()`
  - Eliminar `require("../lib/firestore")` — ya no se usa directo

### Tests

- [x] 1.3 Crear `backend/tests/unit/repositories/productos.repository.test.ts`:
  - Mockear `db` con Module._cache (estándar del proyecto)
  - 6 tests: getProducto (existe/no existe), getAllProductos (con datos/vacío), buscarSubcoleccion (encontrado/no encontrado)
- [x] 1.4 Verificar que los tests existentes (Fase 1) siguen pasando — 24 tests siguen en verde

---

## PR #2: Repositorio de Ventas

### Creación

- [x] 2.1 Crear `backend/src/repositories/ventas.repository.js` con:
  - `buscarClientePorNombre(nombreNormalizado)` → query `Clientes` collection
  - `getVenta(clienteId)` → `Ventas/{clienteId}`
  - `setVenta(clienteId, data)` → merge set `Ventas/{clienteId}`
  - `getMesesPedidos(clienteId)` → `Ventas/{clienteId}/Pedidos` (todos los meses)
  - `setPedidoMes(clienteId, mesAnio, data)` → merge set `Pedidos/{mesAnio}`
  - `getPedidos(clienteId, mesAnio)` → `Pedidos/{mesAnio}/pedidos`
  - `getPedidosPendientes(clienteId, mesAnio)` → pedidos con `where("estadoContable", "==", "pendiente")`
  - `crearPedido(clienteId, mesAnio, pedidoId, data)` → set dentro de pedidos
  - `getTodosClientesConVentas()` → `Ventas` collection (full list, para job contable)

### Refactor

- [x] 2.2 Refactorizar `backend/src/routes/ventas.js`:
  - Reemplazar `db.collection("Clientes").get()` → `ventasRepo.buscarClientePorNombre()`
  - Reemplazar `db.collection("Ventas")` calls → `ventasRepo.setVenta()`
  - Reemplazar `db.collection("Productos")` → `productosRepo.buscarSubcoleccion()` y `getProducto()`
  - Eliminar `require("../lib/firestore")` y `require("firebase-admin")`
- [x] 2.3 Refactorizar `backend/src/jobs/jobContableMensual.js`:
  - Reemplazar `db.collection("Ventas").get()` → `ventasRepo.getTodosClientesConVentas()`
  - Reemplazar nested Ventas/Pedidos acceso → `ventasRepo.getMesesPedidos()` y `getPedidosPendientes()`

### Tests

- [x] 2.4 Crear `backend/tests/unit/repositories/ventas.repository.test.ts`:
  - 12 tests: buscarClientePorNombre (3), getVenta (2), setVenta, getMesesPedidos, setPedidoMes, getPedidos, getPedidosPendientes, crearPedido, getTodosClientesConVentas
- [x] 2.5 Verificar que tests existentes (Fase 1 + PR #1) siguen pasando — 42 tests en verde

### Limpieza

- [x] 2.6 `require("../lib/firestore")` eliminado de `routes/productos.js` ✅ y `routes/ventas.js` ✅
- [ ] 2.7 jobContableMensual.js aún requiere `db` directamente para batch operations (necesario: db.batch() y db.doc() son APIs de firebase-admin, no acceso a colecciones de dominio). Se reevaluará en refactor futuro.

---

## Fase 3 — Admin Repository

### Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350-400 |
| 400-line budget risk | Low |
| Chained PRs recommended | Yes → 1 PR |
| Suggested split | PR único: admin.repository + refactor routes + service + tests |

Decision needed before apply: No
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR |
|------|------|-----------|
| 1 | admin.repository.js + refactor routes + service + tests | PR único |

---

### Creación

- [x] 3.1 Crear `backend/src/repositories/admin.repository.js` con las siguientes funciones, siguiendo el patrón functional de los repos existentes (importa `db` directo, NO recibe dependencias):

  **Lecturas — Admin (Firebase Auth)**
  - `getAdminByEmail(email)` → query `Admin` collection con `where("Email", "==", email).where("Activo", "==", true).where("Rol", "==", "admin").limit(1)` — usado en `adminAuth` middleware
  - `getAdminByRol(rol)` → query `Admin` collection filtrando por `Rol`

  **Lecturas — Invertir**
  - `getInversion(categoria)` → `Invertir/{categoria}` doc

  **Lecturas — Cierres contables**
  - `getCierresContables(mesAnio)` → `Cierres_contables/{mesAnio}` doc

  **Escrituras**
  - `setCierreContable(mesAnio, categoria, data)` → merge set en `Cierres_contables/{mesAnio}` con `{ [categoria]: data }`
  - `setAdminAction(mesAnio, categoria, data)` → merge set en `AdminActions/{mesAnio}` con `{ [categoria]: data }`

### Refactor

- [x] 3.2 Refactorizar `backend/src/routes/admin.contabilidad.routes.js`:
  - En `adminAuth()` middleware: reemplazar `db.collection("Admin").where(...)` → `adminRepo.getAdminByEmail(email)`
  - Eliminar `require("../lib/firestore")` y `require("firebase-admin")` (el repo maneja db internamente)
  - Mantener `admin.auth().verifyIdToken()` intacto (es Firebase Auth SDK, no Firestore)

- [x] 3.3 Refactorizar `backend/src/services/admin.actions.service.js`:
  - Reemplazar acceso directo a `db.collection("Total Productos")` y `db.collection("Cartones_vendidos")` → usar `contabilidadRepo.getTotalProductos()`, `contabilidadRepo.getCategoriasTotalProductos()`, etc.
  - Reemplazar `db.collection("Invertir")` → `adminRepo.getInversion(categoria)`
  - Reemplazar `db.collection("Cierres_contables")` → `adminRepo.setCierreContable(mesAnio, categoria, data)`
  - Reemplazar `db.collection("AdminActions")` → `adminRepo.setAdminAction(mesAnio, categoria, data)`
  - Reemplazar `categoriaTotalRef.collection("skus").get()` y loop de delete → delegar a contabilidadRepo (agregar métodos de limpieza si es necesario)
  - Eliminar `require("../lib/firestore")`

### Tests

- [x] 3.4 Crear `backend/tests/unit/repositories/admin.repository.test.ts`:
  - Mockear `db` con Module._cache (estándar del proyecto)
  - Tests para: getAdminByEmail (encontrado/no encontrado), getAdminByRol, getInversion, getCierresContables, setCierreContable, setAdminAction
  - Mínimo 8 tests

- [x] 3.5 Verificar que tests existentes (Fase 1 + Fase 2) siguen pasando después del refactor — 46 tests en verde (28 repo tests + 11 jobContable + 7 normalizarTexto/obtenerCategoria)

### Limpieza

- [x] 3.6 `require("../lib/firestore")` eliminado de `routes/admin.contabilidad.routes.js` ✅ y `services/admin.actions.service.js` ✅
- [x] 3.7 `require("firebase-admin")` mantenido en `routes/admin.contabilidad.routes.js` (necesario para `admin.auth().verifyIdToken()` — es Firebase Auth, no Firestore)` (reemplazado por admin.repository.js)
