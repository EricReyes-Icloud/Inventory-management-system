# Design: Fix Test Suite

## Technical Approach

Four root causes produce 60 root-run failures and 7 backend-cwd failures. The fix extracts a shared path helper from the proven `flujoCompleto.test.ts` `import.meta.url` pattern, adds a root vitest config, corrects 7 contract-drift assertions, and adds a secrets bootstrap. One production file changes (`firestore.js`); everything else is test-side.

## Architecture Decisions

### Decision: Shared path helper over per-file `import.meta.url`

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Extract `getBackendRoot()` to `tests/helpers/paths.ts` | 11-file mechanical migration; single source of truth | **Chosen** |
| Keep `process.cwd()` + root `vitest.config.js` `root: true` | vitest `root` doesn't change `process.cwd()` — mock keys still wrong | Rejected |
| Use `require.resolve()` for every mock key | Verbose; some paths aren't `require`-able (e.g. helper files) | Rejected |

**Rationale**: The `import.meta.url` derivation is launch-independent and proven in `flujoCompleto.test.ts` (the only Firestore-touching file that passes from root). A shared helper eliminates duplication across 11 files.

### Decision: Root vitest.config.js pointing to backend tests

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Root `vitest.config.js` with `root: 'backend'` and `include: ['tests/**/*.test.*']` | Requires vitest at root (workspace hoisting provides it) | **Chosen** |
| `backend/vitest.config.js` with `root: true` | Doesn't fix `process.cwd()` mock keying; only fixes test discovery | Rejected |
| Single canonical command (`npm test` only) | Leaves root-run broken; violates strict-TDD preflight | Rejected |

**Rationale**: When vitest runs from root, its cwd is root. The root config must set `root: 'backend'` so test discovery, globals, and environment match the backend config. The shared helper handles the path-derivation side independently.

### Decision: Env-var fallback for secrets (not fake credential)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `try { require(...) } catch { /* use env vars */ }` in `firestore.js` | Touches production file; must preserve behavior when key exists | **Chosen** |
| Checked-in fake `serviceAccountKey.json` | Committed credential (even fake) is a security smell | Rejected |
| `vi.mock()` of `firestore.js` in every test | Already done in 11 files; doesn't solve CI bootstrap | Rejected |

**Rationale**: The `try/catch` with env-var fallback is zero-impact when the real key exists (production behavior identical). On CI without the key, Firebase initializes with `FIREBASE_*` env vars or a test-project credential.

## Data Flow

```
npx vitest run (repo root)
  └─ vitest.config.js → root: 'backend', include: 'tests/**/*.test.*'
       └─ each test file
            ├─ import { getBackendRoot } from '../helpers/paths'
            │    └─ import.meta.url → dirname → resolve to backend/
            ├─ Module._cache[getBackendRoot() + '/src/lib/firestore.js'] = mockDb
            └─ dynamic import of production module → uses mock
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/tests/helpers/paths.ts` | Create | Exports `getBackendRoot()` via `import.meta.url` derivation |
| `vitest.config.js` (root) | Create | `root: 'backend'`, `include: ['tests/**/*.test.*']`, globals + node env |
| `backend/src/lib/firestore.js` | Modify | `try/catch` around `require('../secrets/serviceAccountKey.json')` with env-var fallback |
| `backend/tests/unit/repositories/admin.repository.test.ts` | Modify | Migrate to shared helper; fix mock chain for `Usuarios/Usuarios/Admin` path (RULE-2) |
| `backend/tests/unit/repositories/contabilidad.repository.test.ts` | Modify | Migrate to shared helper (path derivation only) |
| `backend/tests/unit/repositories/contable.repository.test.ts` | Modify | Migrate to shared helper (path derivation only) |
| `backend/tests/unit/repositories/productos.repository.test.ts` | Modify | Migrate to shared helper (path derivation only) |
| `backend/tests/unit/repositories/ventas.repository.test.ts` | Modify | Migrate to shared helper (path derivation only) |
| `backend/tests/unit/services/contabilidad.test.ts` | Modify | Migrate to shared helper (path derivation only) |
| `backend/tests/unit/services/ganancias.service.test.ts` | Modify | Migrate to shared helper; fix formula assertions to `fijos*cartones+variables` (RULE-1) |
| `backend/tests/unit/services/monthlyClosing.orchestrator.test.ts` | Modify | Migrate to shared helper; fix `generarHistoricoMensual` arg to `{ uid, nombre }` (RULE-3) |
| `backend/tests/unit/job/jobContable.rules.test.ts` | Modify | Migrate to shared helper (path derivation only) |
| `backend/tests/integration/jobContable.test.ts` | Modify | Migrate to shared helper; fix import depth `../../../` → `../../`; fix FieldValue keying via `require.resolve` |
| `backend/tests/integration/ventas.test.ts` | Modify | Migrate to shared helper (path derivation only) |

## Interfaces / Contracts

### `backend/tests/helpers/paths.ts`

```ts
import path from "path";

/**
 * Returns the absolute path to backend/ regardless of process.cwd().
 * Derived from this file's location: backend/tests/helpers/paths.ts → ../.. = backend/
 */
export function getBackendRoot(): string {
  const __filename = new URL(import.meta.url).pathname;
  const __here = path.dirname(__filename);
  return path.resolve(__here, "../..");
}
```

Each consuming test replaces:
```ts
// OLD (breaks from root)
const projectRoot = process.cwd();
// NEW (launch-independent)
import { getBackendRoot } from "../helpers/paths";
const projectRoot = getBackendRoot();
```

### `backend/src/lib/firestore.js` — secrets bootstrap

```js
const admin = require("firebase-admin");

let serviceAccount;
try {
  serviceAccount = require("../secrets/serviceAccountKey.json");
} catch {
  // CI / fresh-clone fallback: use env-var credentials
  serviceAccount = null;
}

if (!admin.apps.length) {
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID || "test-project",
    });
  }
}

const db = admin.firestore();
module.exports = db;
```

**Behavior**: When `serviceAccountKey.json` exists (local dev), behavior is identical to current code. When absent (CI), Firebase initializes with Application Default Credentials or env-var project ID.

### Contract-drift corrections

**RULE-2 — admin.repository.test.ts mock chain**:

```ts
// OLD: flat collection
mockDb.collection = vi.fn(() => ({ where: ... }));

// NEW: hierarchical — matches production db.collection("Usuarios").doc("Usuarios").collection("Admin")
mockDb.collection = vi.fn((name: string) => {
  if (name === "Usuarios") {
    return {
      doc: vi.fn(() => ({
        collection: vi.fn((subName: string) => {
          if (subName === "Admin") {
            return { where: ... }; // existing chain
          }
          return { get: vi.fn(), doc: vi.fn() };
        }),
      })),
    };
  }
  return { get: vi.fn(), doc: vi.fn() };
});
```

**RULE-1 — ganancias.service.test.ts assertions**:

```ts
// OLD (wrong formula: (fijos+variables)*cartones)
expect(result.inversionTotal).toBe(6500);  // (50+15)*100
expect(result.gananciaNeta).toBe(3500);

// NEW (correct formula: fijos*cartones + variables)
expect(result.inversionTotal).toBe(5015);  // 50*100 + 15
expect(result.gananciaNeta).toBe(4985);    // 10000 - 5015
```

For Miel test:
```ts
// OLD
expect(result.inversionTotal).toBe(10950); // (fijos+variables)*cartones per product
expect(result.gananciaNeta).toBe(4050);

// NEW (per-product: fijos*cartonesProducto + variables)
// Frascos: 40*80+50=3250, Botellas: 40*50+15=2015, Copas: 40*20+10=810
expect(result.inversionTotal).toBe(6075);  // 3250+2015+810
expect(result.gananciaNeta).toBe(8925);    // 15000-6075
```

**RULE-3 — monthlyClosing.orchestrator.test.ts assertion**:

```ts
// OLD
expect(mockGenerarHistoricoMensual).toHaveBeenCalledWith("Enero 2026", "admin-1");

// NEW — orchestrator passes full admin object
expect(mockGenerarHistoricoMensual).toHaveBeenCalledWith("Enero 2026", adminMock);
// where adminMock = { uid: "admin-1", nombre: "Admin Test" }
```

### jobContable.test.ts — import depth + FieldValue keying

```ts
// OLD import (wrong depth — resolves to repo-root /src/...)
const jobModule = await import("../../../src/jobs/jobContableMensual");

// NEW import (correct: from backend/tests/integration/ → ../../src/)
const jobModule = await import("../../src/jobs/jobContableMensual");

// OLD FieldValue key (cwd-dependent, breaks from root)
const FIREBASE_FIRESTORE_PATH = path.resolve(PROJECT_ROOT, "node_modules/firebase-admin/lib/firestore/index.js");

// NEW — use require.resolve for hoist-safe resolution
const FIREBASE_FIRESTORE_PATH = require.resolve("firebase-admin/lib/firestore/index.js");
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | All 11 migrated test files | `npx vitest run` from repo root — 0 failures |
| Unit | Same 11 files from backend cwd | `npm test` in backend/ — 0 failures, counts match root |
| Integration | Secrets bootstrap | Remove `serviceAccountKey.json` temporarily, run suite — no MODULE_NOT_FOUND |
| Contract | RULE-1/2/3 assertions | 7 corrected tests pass with production-correct shapes |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No data migration. Implementation order:

1. Create `backend/tests/helpers/paths.ts`
2. Create root `vitest.config.js`
3. Modify `backend/src/lib/firestore.js` (secrets bootstrap)
4. Migrate 10 test files to shared helper (mechanical — path derivation swap only)
5. Fix `jobContable.test.ts` (import depth + FieldValue keying + helper)
6. Fix 3 contract-drift files (admin.repository, ganancias.service, monthlyClosing.orchestrator)
7. Verify: `npx vitest run` from root + `npm test` from backend

## Open Questions

- None — all decisions grounded in codebase evidence and confirmed business rules (proposal.md §Confirmed Business Rules).

## Key Learnings

1. The `import.meta.url` pattern from flujoCompleto.test.ts is the only proven launch-independent mock keying approach for CJS Module._cache.
2. Ganancias non-Miel production formula is `fijos*cartones + variables` (inversionTotal=5015), not `(fijos+variables)*cartones` (6500).
3. Admin Firestore path is hierarchical: `Usuarios/Usuarios/Admin` with `.doc()` step — test mocks must mirror this chain.
4. Orchestrator passes full `{ uid, nombre }` object to generarHistoricoMensual, not a uid string.
5. `require.resolve("firebase-admin/lib/firestore/index.js")` is hoist-safe and eliminates cwd-dependent FieldValue keying.
