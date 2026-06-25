# Tasks: contabilidad-repository-test

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~420 |
| 400-line budget risk | Medium (just over) |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Decision needed before apply | No |

```
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: single
400-line budget risk: Medium (just over)
```

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | All test scenarios | Single PR | 16 scenarios, single file, ~420 lines |

---

## Phase 1: Test Infrastructure — Setup, Helpers, Global Mocks

File: `backend/tests/unit/repositories/contabilidad.repository.test.ts`

This phase creates the test file scaffold, shared Firestore test doubles, `Module._cache` pre-seeding, and cleanup. Every subsequent phase depends on this infrastructure.

- [x] **1.1 — Create file with imports and TypeScript declarations**
  Import `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach` from `"vitest"`, plus `Module` and `path`. Add `declare module "module" { interface Module { _cache: ... } }`. Resolve `projectRoot = process.cwd()` and define all cache paths:
  - `firestorePath` → `src/lib/firestore.js`
  - `firebaseAdminPath` → `firebase-admin/firestore` (resolved via `require.resolve`)
  - `fechasPath` → `src/utils/fechas.js`
  - `repoPath` → `src/repositories/contabilidad.repository.js`
  
  Declare mutable let bindings: `mockDb`, `mockBatch`, `mockDocRef`, `mockFieldValue`, `contabilidadRepo`.

  **Effort**: S — ~12 lines

- [x] **1.2 — Create shared Firestore test double builders**

  Write pure factory functions (hoisted or inline) that return minimal mock objects:
  - `buildMockDocRef(overrides = {})` → `{ get: vi.fn(), set: vi.fn(), collection: vi.fn(() => ({ ... })) }`
  - `buildMockDocSnap(exists, data)` → `{ exists, data: () => data, ref: { ... } }`
  - `buildMockQuerySnap(docs)` → `{ docs, forEach: vi.fn(fn => docs.forEach(fn)), size: docs.length, empty: docs.length === 0 }`
  - `buildMockBatch(overrides = {})` → `{ set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit: vi.fn() }`
  - `mockFieldValue` → `{ increment: vi.fn(v => ({ __increment: v })), serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })) }`

  All mocks return `this` from `vi.fn()` where Firestore chainability is needed.

  **Effort**: M — ~40 lines

- [x] **1.3 — Implement top-level `beforeEach` with `Module._cache` pre-seeding**

  Execution order:
  1. `mockDocRef = buildMockDocRef()`
  2. `mockBatch = buildMockBatch()`
  3. `mockDb = { doc: vi.fn(() => mockDocRef), batch: vi.fn(() => mockBatch), _mockDocRef: mockDocRef }`
  4. `Module._cache[firestorePath] = { exports: mockDb, loaded: true }`
  5. `Module._cache[firebaseAdminPath] = { exports: { FieldValue: mockFieldValue }, loaded: true }`
  6. `Module._cache[fechasPath] = { exports: { obtenerMesAnio: vi.fn(() => "Enero 2026") }, loaded: true }`
  7. `delete Module._cache[repoPath]` (force fresh require)
  8. `contabilidadRepo = require("../../../src/repositories/contabilidad.repository")`
  
  Note: `diccionario.js` and `normalizarTexto.js` are NOT cached — they load real for `obtenerCategoria` logic.

  **Effort**: M — ~30 lines

- [x] **1.4 — Implement `afterEach` with cleanup**

  Delete all seeded cache entries:
  - `delete Module._cache[firestorePath]`
  - `delete Module._cache[firebaseAdminPath]`
  - `delete Module._cache[fechasPath]`
  - `delete Module._cache[repoPath]`
  - `vi.restoreAllMocks()`

  **Effort**: S — ~10 lines

---

## Phase 2: `obtenerCategoria` Tests — Pure Logic (Real Dependencies)

These tests import `normalizarTexto` and `diccionarioCategorias` as **real** dependencies — they test the actual matching algorithm against the real dictionary. No Firestore mocks needed within each `it` block; the global `beforeEach` setup is sufficient.

- [x] **2.1 — Returns category for matching SKU**
  ```
  GIVEN "Miel * 100"
  WHEN obtenerCategoria("Miel * 100")
  THEN returns "Miel"
  ```
  Assert exact string match to dictionary key. Verifies basic substring matching after normalization.

  **Effort**: S — ~15 lines

- [x] **2.2 — Returns most specific (longest) match**
  ```
  GIVEN "Canela molida" (matches both "Canela" and "Canela_molida")
  WHEN obtenerCategoria("Canela molida")
  THEN returns "Canela_molida"
  ```
  This validates the sort-by-descending-length logic in the function — the longest matching dictionary key wins.

  **Effort**: S — ~15 lines

- [x] **2.3 — Returns null when no match (with console.warn spy)**
  ```
  GIVEN "Producto Sin Categoria"
  WHEN obtenerCategoria("Producto Sin Categoria")
  THEN returns null AND console.warn is called with "⚠️ SKU sin categoría definida: Producto Sin Categoria"
  ```
  Use `vi.spyOn(console, 'warn').mockImplementation(() => {})` to silence and assert the warning. Restored by `vi.restoreAllMocks()` in afterEach.

  **Effort**: S — ~20 lines

- [x] **2.4 — Handles accented and uppercased names**
  ```
  GIVEN "MIEL 100gr con acentos"
  WHEN obtenerCategoria("MIEL 100gr con acentos")
  THEN returns "Miel"
  ```
  Tests the full normalization pipeline: lowercase, NFD decomposition, accent stripping, symbol removal (`*` conversion via `de` → `*`), space compaction, trim.

  **Effort**: S — ~15 lines

---

## Phase 3: `buildOperacionesContables` Tests — Batch Construction Logic

These tests use the global `beforeEach` mocks (`mockFieldValue`, mocked `obtenerMesAnio`). `obtenerCategoria` runs REAL so the categorization paths are tested end-to-end. Items use real SKU names from the dictionary.

- [ ] **3.1 — Throws on empty items**
  ```
  GIVEN items = [] OR items = "string"
  WHEN buildOperacionesContables(items, new Date())
  THEN throws Error("Items inválidos para contabilidad")
  ```
  Test both null/undefined/string/empty-array cases with `expect().toThrow()`.

  **Effort**: S — ~18 lines

- [ ] **3.2 — Throws on invalid fechaPedido**
  ```
  GIVEN items = [{ nombre: "Miel * 100", subtotal: 1500, cantidad: 5 }]
  WHEN buildOperacionesContables(items, "not-a-date")
  THEN throws Error("fechaPedido inválida")
  ```
  Also test `undefined` and `null` as fechaPedido.

  **Effort**: S — ~15 lines

- [ ] **3.3 — Builds all ops for categorized items**
  ```
  GIVEN 3 items with valid SKU names (e.g., "Miel * 100", "Canela * 100 pequeña", "Clavo * 100")
  WHEN buildOperacionesContables(items, new Date("2026-01-15"))
  THEN returns array with exactly:
    - 2 main doc ops (Total Productos + Cartones Vendidos)
    - 6 ops per categorized item (cat total, sku total, totalGeneral; cat carton, sku carton, totalGeneral)
    - Total: 20 ops
  ```
  Assert each operation has `ref` (string path), `data` (object), and `options` (`{ merge: true }`). Validate path structure uses `"Total Productos/Enero 2026"`, `"Cartones_vendidos/Enero 2026"`.

  **Effort**: L — ~50 lines

- [ ] **3.4 — Uses FieldValue.increment for totals**
  ```
  GIVEN item with subtotal: 1500, cantidad: 5
  WHEN buildOperacionesContables([item], new Date())
  THEN:
    - Total Productos category total uses increment(1500)
    - Total Productos SKU total uses increment(1500)
    - Total Productos totalGeneral uses increment(1500)
    - Cartones Vendidos category total uses increment(5)
    - Cartones Vendidos SKU total uses increment(5)
    - Cartones Vendidos totalGeneral uses increment(5)
  ```
  Inspect the `data` field of each operation — all should contain `FieldValue.increment(n)`. The mock returns `{ __increment: n }` for assertion.

  **Effort**: M — ~30 lines

- [ ] **3.5 — Skips items without category**
  ```
  GIVEN items = [
    { nombre: "Miel * 100", subtotal: 1500, cantidad: 5 },
    { nombre: "Producto Inexistente", subtotal: 500, cantidad: 2 }
  ]
  WHEN buildOperacionesContables(items, new Date())
  THEN returns exactly 8 ops (2 main + 6 for Miel)
    - No ops generated for the uncategorized item
    - No error thrown
  ```

  **Effort**: M — ~25 lines

- [ ] **3.6 — Includes serverTimestamp on main docs**
  ```
  GIVEN valid items and date
  WHEN buildOperacionesContables(items, new Date())
  THEN the first two ops (main docs) have:
    - op.data.creadoEn === { __serverTimestamp: true }
    - op.data.actualizadoEn === { __serverTimestamp: true }
  ```
  Assert the exact mockFieldValue.serverTimestamp() return value.

  **Effort**: S — ~20 lines

---

## Phase 4: `executeBatch` and `executeBatchWithUpdates` Tests — Batch Execution

These tests exercise the actual batch write flow — `db.batch()` returns `mockBatch`, and each op calls `batch.set()` or `batch.update()`. The `mockBatch.commit()` controls success/error.

- [x] **4.1 — Writes all operations and commits**
  ```
  GIVEN an array of 2 operations
  WHEN executeBatch(operaciones)
  THEN:
    - batch.set called exactly 2 times (once per op)
    - batch.set called with db.doc(op.ref), op.data, op.options
    - db.doc called with op.ref for each op
    - batch.commit called exactly once
  ```
  Verify the `db.doc(mockDocRef)` → `batch.set(ref, data, options)` chain. Assert `db.doc` was invoked with the correct ref string from each op.

  **Effort**: M — ~25 lines

- [x] **4.2 — Propagates commit errors**
  ```
  GIVEN mockBatch.commit = vi.fn().mockRejectedValue(new Error("Firestore error"))
  WHEN executeBatch(operaciones)
  THEN the promise rejects with the same error
  ```
  Use `await expect(executeBatch(ops)).rejects.toThrow("Firestore error")`.

  **Effort**: S — ~18 lines

- [x] **4.3 — Applies sets and updates then commits**
  ```
  GIVEN:
    sets = [{ ref: "path/to/set", data: { a: 1 }, options: { merge: true } }]
    updates = [{ ref: "path/to/update", data: { b: 2 } }]
  WHEN executeBatchWithUpdates(sets, updates)
  THEN:
    - batch.set called once with db.doc(sets[0].ref), data, options
    - batch.update called once with db.doc(updates[0].ref), data
    - batch.commit called once
  ```

  **Effort**: M — ~25 lines

---

## Phase 5: `limpiarCategoria` Tests — Category Cleanup

These tests read subcollections via `mockDocRef.collection("skus").get()` and write deletes/sets via `mockBatch`. The `limpiarCategoriaCartones` mirrors `limpiarCategoriaTotal` with different Firestore paths.

- [ ] **5.1 — `limpiarCategoriaTotal` deletes SKUs and resets total**

  ```
  GIVEN mesAnio = "Enero 2026", categoria = "Miel"
    mockDocRef.collection("skus").get() resolves to 2 docs
  WHEN limpiarCategoriaTotal("Enero 2026", "Miel")
  THEN:
    - db.doc("Total Productos/Enero 2026").collection("productos").doc("Miel") called
    - .collection("skus").get() called to fetch SKUs
    - batch.delete called 2 times (once per SKU doc.ref)
    - batch.set called once with categoriaRef, { total: 0, actualizadoEn: expect.any(Date) }, { merge: true }
    - batch.commit called once
  ```

  **Effort**: M — ~30 lines

- [ ] **5.2 — `limpiarCategoriaTotal` handles empty category**

  ```
  GIVEN mockDocRef.collection("skus").get() resolves to empty snapshot
  WHEN limpiarCategoriaTotal("Enero 2026", "Miel")
  THEN:
    - batch.delete NOT called (forEach on empty docs array is no-op)
    - batch.set called once to reset total: 0
    - batch.commit called once
  ```

  **Effort**: S — ~20 lines

- [ ] **5.3 — `limpiarCategoriaCartones` deletes SKUs and resets total**
  ```
  GIVEN mesAnio = "Enero 2026", categoria = "Canela"
    mockDocRef.collection("skus").get() resolves to 2 docs
  WHEN limpiarCategoriaCartones("Enero 2026", "Canela")
  THEN:
    - db.doc("Cartones_vendidos/Enero 2026").collection("productos").doc("Canela") called
    - Same batch.delete + batch.set + batch.commit flow as limpiarCategoriaTotal
  ```

  **Effort**: M — ~25 lines

---

## Dependencies Between Tasks

```
Phase 1 (Infrastructure)
├── 1.1 (imports + types)
├── 1.2 (helpers & test doubles)
├── 1.3 (beforeEach — Module._cache pre-seed)
└── 1.4 (afterEach — cleanup)
         │
         ├── Phase 2 (obtenerCategoria) ◄── pure logic, real deps only
         │   ├── 2.1, 2.2, 2.3, 2.4  (parallelizable)
         │
         ├── Phase 3 (buildOperacionesContables) ◄── needs mockFieldValue + mocked fechas
         │   ├── 3.1, 3.2, 3.3, 3.4, 3.5, 3.6  (sequential within phase)
         │
         ├── Phase 4 (executeBatch*) ◄── needs mockBatch + mockDb
         │   ├── 4.1, 4.2, 4.3  (sequential)
         │
         └── Phase 5 (limpiarCategoria*) ◄── needs mockBatch + mockDocRef subcollections
             ├── 5.1, 5.2, 5.3  (sequential)
```

**Key dependency rules:**
- Phase 1 is a hard prerequisite for all other phases.
- Phases 2–5 are **independent of each other** — each tests different exported functions with different mocking requirements. They can be implemented in any order after Phase 1.
- Within each phase, tasks should be implemented sequentially (each test builds on the describe block structure of the previous).

---

## Effort Summary

| Task | Description | Est. Lines | Complexity |
|------|-------------|-----------|------------|
| 1.1 | Imports + TypeScript declarations | ~12 | Low |
| 1.2 | Shared helper factories | ~40 | Medium |
| 1.3 | `beforeEach` with Module._cache | ~30 | Medium |
| 1.4 | `afterEach` cleanup | ~10 | Low |
| 2.1 | obtenerCategoria — matching SKU | ~15 | Low |
| 2.2 | obtenerCategoria — most specific match | ~15 | Low |
| 2.3 | obtenerCategoria — null + console.warn | ~20 | Low |
| 2.4 | obtenerCategoria — accented/uppercased | ~15 | Low |
| 3.1 | buildOperacionesContables — empty items throw | ~18 | Low |
| 3.2 | buildOperacionesContables — invalid fechaPedido | ~15 | Low |
| 3.3 | buildOperacionesContables — all ops for categorized | ~50 | High |
| 3.4 | buildOperacionesContables — FieldValue.increment | ~30 | Medium |
| 3.5 | buildOperacionesContables — skips uncategorized | ~25 | Medium |
| 3.6 | buildOperacionesContables — serverTimestamp | ~20 | Low |
| 4.1 | executeBatch — writes and commits | ~25 | Medium |
| 4.2 | executeBatch — propagates error | ~18 | Low |
| 4.3 | executeBatchWithUpdates — sets + updates + commit | ~25 | Medium |
| 5.1 | limpiarCategoriaTotal — deletes + resets | ~30 | Medium |
| 5.2 | limpiarCategoriaTotal — empty category | ~20 | Low |
| 5.3 | limpiarCategoriaCartones — deletes + resets | ~25 | Medium |
| | **Total** | **~458** | |

> **Note**: The total (~458) is a generous upper bound including whitespace and comments. The design target of ~420 lines is achievable with concise assertions. The estimate accounts for the complexity of `buildOperacionesContables`'s 6-ops-per-item structure and the nested mock chain setup for `limpiarCategoria`.

---

## Implementation Notes

1. **Mock `.collection()` chainability**: `mockDocRef.collection()` must return an object with `doc()`, `get()`, `collection()` methods that recursively return `mockDocRef`-like objects. The `buildMockDocRef` helper handles this via `collection: vi.fn(() => ({ doc: vi.fn(() => mockDocRef), get: vi.fn() }))`.

2. **`batch.delete(doc.ref)` in limpiarCategoria**: The `skusSnap.docs` array contains documents with a `.ref` property (Firestore `DocumentReference`). In the mock, each doc in `buildMockQuerySnap` should have `ref: {}` (any truthy value works since `batch.delete` is mocked).

3. **`console.warn` in obtenerCategoria null case**: Use `vi.spyOn(console, 'warn')` in test 2.3. It is automatically restored by `vi.restoreAllMocks()` in afterEach.

4. **Edge cases beyond spec** (from design doc, implement as sub-assertions within existing tests):
   - `obtenerCategoria`: empty string, plural variants (`clavos` → `clavo`), `subtotal: 0` / `cantidad: 0` generating `increment(0)`
   - `executeBatch`: empty `operaciones` array — batch created with 0 sets, still commits
   - `limpiarCategoria`: `skusSnap.forEach` on empty snapshot is harmless
