# Design: contabilidad-repository-test

## Technical Approach

Vitest unit tests for `contabilidad.repository.js` using the project's `Module._cache` mocking pattern. Three tiers of dependency control: (1) pure-logic functions (`obtenerCategoria`) use real `diccionarioCategorias` and `normalizarTexto` to test actual matching; (2) batch-building (`buildOperacionesContables`) uses real `obtenerCategoria` internally but mocked `FieldValue` and `obtenerMesAnio`; (3) Firestore-dependent functions (`executeBatch`, `limpiarCategoria*`) mock only `firestore.js` + `FieldValue`. 16 scenarios from spec, ~420 lines.

## Architecture Decisions

### Decision: Module._cache Mocking Over `vi.mock()`

| Option | Tradeoff |
|--------|----------|
| **Module._cache pre-seed** (chosen) | Project convention matching `contable.repository.test.ts`. Avoids `vi.mock()` hoisting conflicts with CJS `require()`. Covers firestore, firebase-admin, fechas. |
| `vi.mock()` factory | Hoisting issues with CJS + TS paths. Not established in project. |
| Dependency injection | Would refactor all repos. Out of scope. |

### Decision: Real Dependencies for Pure Logic

| Option | Tradeoff |
|--------|----------|
| **REAL `normalizarTexto` + `diccionarioCategorias`** (chosen) | `obtenerCategoria` IS the matching algorithm — testing with real deps covers actual edge cases (accents, longest match, plural handling). Mutually coupled with `buildOperacionesContables` tests. |
| Mock both | Blind test: only verifies mock returns, not real matching behavior. Misses regression on dictionary or normalization changes. |

### Decision: Mock `FieldValue` at Module._cache Level

| Option | Tradeoff |
|--------|----------|
| **Module._cache mock for `firebase-admin/firestore`** (chosen) | Prevents loading real Firebase in unit tests. Returns identifiable objects (`__increment: val`) for assertion. |
| Real import | Requires Firebase Admin init. Expensive, slow, not unit-test. |
| `vi.mock("firebase-admin/firestore")` | Hoisting conflicts with CJS require path resolution. |

### Decision: Single `beforeEach` with All Mocks

| Option | Tradeoff |
|--------|----------|
| **Top-level beforeEach mocks all deps** (chosen) | Simple, consistent. Unused mocks don't interfere. `normalizarTexto` and `diccionario` are NOT mocked — loaded real. |
| Per-describe nested beforeEach | More granular but harder to maintain. Mock interactions between sibling describe blocks cause confusion. |

## Mocking Strategy

### Module._cache Dependencies

| Module | Path | Mock Strategy |
|--------|------|--------------|
| `firestore.js` | `src/lib/firestore.js` | MOCK — `mockDb` with `doc()`, `batch()` |
| `firebase-admin/firestore` | `node_modules/firebase-admin/firestore` | MOCK — `FieldValue.increment` returns `{ __increment: val }`, `serverTimestamp` returns `{ __serverTimestamp: true }` |
| `fechas.js` | `src/utils/fechas.js` | MOCK — `obtenerMesAnio` returns `"Enero 2026"` |
| `diccionario.js` | `src/utils/diccionario.js` | **REAL** — test actual category dictionary |
| `normalizarTexto.js` | `src/utils/normalizarTexto.js` | **REAL** — test actual normalization logic |

### Setup Execution Flow (top-level beforeEach)

```
1. Create mockDocRef { get, set, collection }
2. Create mockBatch { set, update, delete, commit }
3. Create mockDb { doc → mockDocRef, batch → mockBatch }
4. Pre-seed Module._cache[firestorePath] = { exports: mockDb }
5. Pre-seed Module._cache[firebaseAdminPath] = { exports: { FieldValue: {...} } }
6. Pre-seed Module._cache[fechasPath] = { exports: { obtenerMesAnio: vi.fn() } }
7. delete Module._cache[repoPath]
8. contabilidadRepo = require("./../src/repositories/contabilidad.repository")
```

### Cleanup (afterEach)

```
1. delete Module._cache[firestorePath]
2. delete Module._cache[firebaseAdminPath]
3. delete Module._cache[fechasPath]
4. delete Module._cache[repoPath]
5. vi.restoreAllMocks()
```

## Test Structure

### Shared Helpers

```js
// Firestore test doubles
function buildMockDocRef(overrides = {})  // { get, set, collection }
function buildMockDocSnap(exists, data)    // { exists, data(), ref }
function buildMockQuerySnap(docs)          // { docs, forEach, size, empty }
function buildMockBatch(overrides = {})    // { set, update, delete, commit }

// FieldValue
const mockFieldValue = {
  increment: vi.fn(v => ({ __increment: v })),
  serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
};

// Snapshot builders
function emptySnapshot()                   // { docs: [], size: 0, empty: true }
function docSnapshot(data)                 // { exists: true, data: () => data }
```

### Describe Blocks Overview (16 tests)

```
contabilidad.repository (describe)
├── obtenerCategoria (describe)              ─── 4 it
│   ├── returns category for matching SKU          "Miel * 100" → "Miel"
│   ├── returns most specific match                "Canela molida" → "Canela_molida"
│   ├── returns null when no match                 "Unknown" → null, warns
│   └── handles accented and uppercased            "MIEL 100gr con acentos" → "Miel"
├── buildOperacionesContables (describe)      ─── 6 it
│   ├── throws on empty items                      [] | "string" → throw
│   ├── throws on invalid fechaPedido              items + "string" → throw
│   ├── builds all ops for categorized items       3 items → 20 ops (2 main + 6×3)
│   ├── uses FieldValue.increment for totals       assert increment(1500), increment(5)
│   ├── skips items without category               unknown SKU → 2 ops only (main docs)
│   └── includes serverTimestamp on main docs      assert __serverTimestamp
├── executeBatch (describe)                   ─── 2 it
│   ├── writes all operations and commits          2 ops → 2×batch.set + batch.commit
│   └── propagates commit errors                   batch.commit rejects → re-throws
├── executeBatchWithUpdates (describe)        ─── 1 it
│   └── applies sets and updates then commits      sets + updates → set + update + commit
├── limpiarCategoriaTotal (describe)          ─── 2 it
│   ├── deletes SKUs and resets total              2 SKUs → 2 deletes + set({total: 0})
│   └── handles empty category                     0 SKUs → 0 deletes + set({total: 0})
└── limpiarCategoriaCartones (describe)       ─── 1 it
    └── deletes SKUs and resets total              same structure as limpiarCategoriaTotal
```

### Edge Cases (beyond obvious spec)

- **obtenerCategoria**: empty string `""`, partial substring that doesn't match full dictionary key, name that matches via plural normalization (`"clavos"` → `"clavo"`)
- **buildOperacionesContables**: items with `subtotal: 0` or `cantidad: 0` generate `increment(0)` — zero increments should still appear in ops
- **executeBatch**: empty `operaciones` array — batch is created and committed with 0 sets
- **limpiarCategoriaTotal**: `skusSnap.forEach` on empty snapshot should be harmless (forEach on empty docs array)
- **console.warn** in `obtenerCategoria` null case: spy with `vi.spyOn(console, 'warn').mockImplementation(() => {})`, restored by `vi.restoreAllMocks()` in afterEach

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/tests/unit/repositories/contabilidad.repository.test.ts` | Create | 16 scenarios across 6 requirement groups, ~420 lines |

No existing files modified.

## Interfaces / Contracts

No new interfaces. Test file validates existing function contracts:

```js
obtenerCategoria(nombre: string)        → string | null
buildOperacionesContables(items, Date)   → Array<{ref, data, options?}>
executeBatch(operaciones)                → Promise<WriteResult[]>
executeBatchWithUpdates(sets, updates)   → Promise<WriteResult[]>
limpiarCategoriaTotal(mesAnio, cat)      → Promise<void>
limpiarCategoriaCartones(mesAnio, cat)   → Promise<void>
```

## Migration / Rollback

No migration. New test file only. Rollback: delete the test file.

## Open Questions

None.
