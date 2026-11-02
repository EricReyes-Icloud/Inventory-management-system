# Feature: Optimizar getAllProductos() N+1 → Parallel Reads

**Objective:** Refactorizar `productos.repository.getAllProductos()` que hace consultas N+1 a Firestore, reemplazándolas por reads paralelos con límite de concurrencia, manteniendo el contrato de respuesta idéntico (R-CONTRATO-EXT del spec catalog-single-source).

**Branch:** feat/backend-robustez
**Delivery:** ask-on-risk
**Runner:** npm run test:ci
**Status:** complete

## Specs

- **S1 (N+1 problem):** `getAllProductos()` realiza 1 query principal + N queries secuenciales para subcolecciones. Con 24 categorías y ~50 subcategories cada una, >1000 reads por request.
- **S2 (Parallel reads):** Implementar `Promise.all` con batch de 10 para leer subcolecciones en paralelo, reduciendo tiempo total de ejecución mientras mantiene consistencia de resultados.
- **S3 (Contract preservation):** El endpoint `GET /api/productos` debe regresar exactamente el mismo formato: `[{id, subcolecciones: {<nombre>: [{id, Precio carton, Precio unidad, Peso unidad, Precio a dar tienda}]}}]` (R-CONTRATO-EXT).
- **S4 (Tests):** Agregar test de performance que verifique que el número de lecturas no excede 2x el número de subcolecciones (cualquier exceso es un regression). Suite existente 296/296 debe seguir pasando.

## Tasks

- **T1** — Redactar test de performance para `getAllProductos()` que mida reads. Route: inline. Commit.
- **T2** — Refactorizar `getAllProductos()` con `Promise.all` + batch de 10. Route: inline. Commit.
- **T3** — Ejecutar suite de tests comprobando contrato de respuesta (14/14 en admin.routes, 296/296 total). Route: inline.

## Log

- **L1** — 2026-11-03: Propuesta senior aprobada para optimizar N+1 de getAllProductos() manteniendo R-CONTRATO-EXT.
- **L2** — Creado feature document en `odd/tasks/optimizarr-getallproductos.md`.

## Risk

**Risk: none** — Cambio de rendimiento, contrato de respuesta inalterado, todos los tests existentes pasan.
- **L3** — **Commit 1:** `test(repo): add getAllProductos parallel-reads test (S4)`
- **Commit 2:** `refactor(repo): parallelize getAllProductos reads with Promise.all (S2-S3)`
- **Commit 3:** `test: verify contract preservation, suite 297/297` (S4)
