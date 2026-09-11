# Design: Ventas Integration Test — `POST /pedido-libre`

## Technical Approach

Create a single test file `backend/tests/integration/ventas.test.ts` that hits the real route through supertest while mocking Firestore and the IA interpretation service via `Module._cache`. The Express app is constructed inline in the test file (no `src/index.js` export needed — that file stays untouched). Each scenario sets up mock state, clears module cache for affected files, then `require()`s the route fresh to pick up the mocked dependencies.

## Architecture Decisions

### Decision: Inline Express app in test file

| Option | Tradeoff |
|--------|----------|
| Export `app` from `src/index.js` | Modifies prod code — violates test-only constraint |
| **Inline app creation in test** | No prod changes; follows same setup as index.js |
| Test helper that creates app | Adds abstraction layer without clear benefit |

**Rationale**: `src/index.js` (line 26-30) creates `app = express()`, adds `express.json()` middleware, and mounts `ventasRouter` at `/api/ventas`. The test replicates exactly those 3 lines. No server is started — supertest `request(app)` binds directly.

### Decision: `Module._cache` for firestore.js, not individual repos

| Option | Tradeoff |
|--------|----------|
| **Mock `firestore.js` only** | Tests real repository code; catches repo-level bugs |
| Mock each repository module | Skips repository layer; less integration coverage |

**Rationale**: The route imports `ventas.repository` and `productos.repository`, both of which import `firestore.js`. Mocking firestore.js at its cached path (`src/lib/firestore.js`) lets both repositories use the same mock, exercising their real Firestore query logic against a controllable fake. This is the same pattern used in `contable.repository.test.ts` (lines 37-40).

### Decision: `Module._cache` for `inturis.js`

**Choice**: Mock `src/brain/inturis.js` entirely via `Module._cache` (same mechanism as firestore.js).

**Rationale**: The route does `require("../brain/inturis")` at the top. Injecting a mock module with only `interpretarPedido` avoids needing to mock Fuse.js, `words-to-numbers`, or any of inturis' internal dependencies.

### Decision: Install supertest as devDependency

**Rationale**: `supertest` is not in `node_modules` or `package.json`. The test file requires it. Install via `npm install --save-dev supertest`.

## Data Flow

```
Test (supertest) ──POST /api/ventas/pedido-libre──→ Express app
                                                       │
                                                    ventas.js (route handler)
                                                       │
                                            ┌──────────┼──────────┐
                                            │          │          │
                                     validate req   ventasRepo  interpretarPedido
                                     (no mock)    (real repo,  (Module._cache mock)
                                                    mock db)      │
                                                       │     returns [{producto, cantidad}]
                                                       │
                                                  productosRepo
                                                 (real repo, mock db)
                                                       │
                                                  res.json({...})
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/tests/integration/ventas.test.ts` | Create | Integration test — 6 scenarios covering validation, errors, and happy path |
| `backend/package.json` | Modify | Add `supertest` to `devDependencies` |

## Test Structure and Mock Setup

```typescript
// One mockDb instance per describe block, recreated in beforeEach
const mockDb = {
  collection: vi.fn(() => mockCollectionRef()),
};

const mockInterpretarPedido = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();

  // Inject firestore mock
  Module._cache[firestorePath] = { exports: mockDb, loaded: true };

  // Inject inturis mock
  Module._cache[inturisPath] = {
    exports: { interpretarPedido: mockInterpretarPedido },
    loaded: true,
  };

  // Clear cached repositories and route
  [ventasRepoPath, productosRepoPath, ventasRoutePath].forEach(p => {
    delete Module._cache[p];
  });
});

afterEach(() => {
  [firestorePath, inturisPath].forEach(p => {
    delete Module._cache[p];
  });
  vi.restoreAllMocks();
});

// Helper: create inline Express app
function createApp() {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api/ventas', require('../../src/routes/ventas'));
  return app;
}
```

Each scenario configures `mockDb.collection` to return chained Firestore references that resolve specific data. For example, the happy path sets up:

- `mockDb.collection("Clientes").get()` → snapshot containing `{ Nombre: "test" }` (for `buscarClientePorNombre`)
- `mockDb.collection("Ventas").doc(...).set()` → resolved (for `setVenta`, `setPedidoMes`)
- `mockDb.collection("Ventas").doc(...).collection(...).doc(...).collection("pedidos").get()` → empty snapshot (first pedido, so `Pedido_Id1`)
- `mockDb.collection("Productos").doc("Productos_ID").collection("Miel").limit(1).get()` → doc with id `Miel_1` (for `buscarSubcoleccion`)
- `mockDb.collection("Productos").doc("Productos_ID").collection("Miel").doc("Miel_1").get()` → doc with `{ "Precio carton": 50000 }` (for `getProducto`)

## Scenario Map

| # | Scenario | HTTP | Mock State |
|---|----------|------|------------|
| 1 | Missing `cliente` | `400 / cliente_requerido` | No mocks needed — fails before any service call |
| 2a | Missing `mensaje` | `400 / mensaje_requerido` | No mocks needed |
| 2b | Empty `mensaje` | `400 / mensaje_requerido` | No mocks needed |
| 3 | Client not found | `404 / cliente_no_encontrado` | `Clientes.get()` → empty snapshot |
| 4 | No interpreted products | `400 / ningun_producto_identificado` | Valid client exists; `interpretarPedido` returns `[]` |
| 5 | Product not found | `400 / producto_no_encontrado` | Valid client; `interpretarPedido` returns `[{producto:"Miel",cantidad:2}]`; `buscarSubcoleccion("Miel")` → doc; `getProducto("Miel","Miel_1")` → null |
| 6 | Happy path | `200` with pedido details | All mocks configured to succeed; verify response body fields AND that `crearPedido` was called |

## Non-Obvious Gotchas

- **Collection `forEach`**: `buscarClientePorNombre` iterates with `clientesSnap.forEach(doc => ...)`. The mock snapshot must supply a `forEach` method, not just a `docs` array.
- **Lazy `require` in handler**: The route does `require("../utils/diccionario")` inside the handler (line 50) only when no products are identified. This module has no external deps, so it works without mocking.
- **Firestore chaining depth**: `getPedidos` chains 4 levels: `collection – doc – collection – doc – collection – get`. The mock must support this full chain.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Integration | `POST /api/ventas/pedido-libre` full flow | Supertest + Module._cache for firestore.js and inturis.js |
| Validation | Input checks (missing/empty fields) | No mocks — validates before any service call |
| Error paths | Client not found, no products, product not found | Configurable mock responses per scenario |
| Happy path | Complete order creation | Assert HTTP 200, response body shape, and Firestore write calls |

## Migration / Rollout

No migration required. Install supertest (`npm install --save-dev supertest`). Run with `npm run test:run -- tests/integration/ventas.test.ts`.

## Open Questions

- None. All design decisions resolved by project constraints and existing patterns.
