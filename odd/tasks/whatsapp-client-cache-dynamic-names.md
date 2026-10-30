# Feature: whatsapp-client-cache-dynamic-names

**Objective:** Replace hardcoded client names `["hernan", "mauricio", "esperanza", "edwin"]` in `backend/src/whatsapp/index.js` with a dynamic client cache loaded from Firestore and sorted by length descending to ensure accurate match precedence.
**Branch:** `feat/backend-robustez` (user-mandated — no new branch).
**Delivery strategy:** `ask-on-risk` (default). Push/PR remain human decisions.
**Test runner:** `npm run test:ci` (root, vitest) — baseline 274 tests green.

## Specs

**S1 — Client names loaded dynamically from Firestore, no hardcoding.**
Scope: `backend/src/services/clientCache.service.js` and `backend/src/whatsapp/index.js`.
Source (verbatim from user): "WhatsApp hardcodea clientes: ['hernan', 'mauricio', 'esperanza', 'edwin']. Debemos cambiar por DB".
Acceptance: `detectarYRemoverCliente()` obtains client names dynamically from Firestore via `getNombresClientes()` (or a cache wrapper around it). No hardcoded client names remain in `backend/src/whatsapp/index.js`.
Check: grep for `"hernan"`, `"mauricio"`, `"esperanza"`, `"edwin"` in `backend/src/whatsapp/index.js` returns zero matches.

**S2 — Client names sorted by length descending for match precedence.**
Scope: `clientCache.service.js` / `detectarYRemoverCliente()`.
Source (verbatim from proposal accepted by user): "Los nombres de clientes deben ordenarse por longitud descendente antes de hacer match".
Acceptance: given clients `"juan"` and `"juan carlos"`, a message `"juan carlos 5 ajies"` matches `"juan carlos"` first, leaving `"5 ajies"` as the clean message. It does NOT match `"juan"` leaving `"carlos 5 ajies"`.
Check: unit test explicitly asserting length-descending precedence (`"juan carlos"` vs `"juan"`).

**S3 — Memory cache with auto-refresh / manual invalidation.**
Scope: `clientCache.service.js`.
Acceptance: client names are cached in memory after the first Firestore fetch to prevent O(1) Firestore reads per WhatsApp webhook. The cache can be manually invalidated (`invalidateCache()`) and auto-refreshes after a configurable TTL (default 5 minutes).
Check: unit test verifying Firestore is called only once for multiple `getNombresClientes()` calls within TTL, and called again after `invalidateCache()`.

**S4 — Normalization and word boundary regex matching.**
Scope: `detectarYRemoverCliente()`.
Acceptance: matching handles lowercasing, tildes/accents properly, and uses word boundary regex `\b` so substring names don't strip partial words (e.g., `"ed"` doesn't strip `"edicion"`).
Check: unit tests covering accent handling and word-boundary safety.

**S5 — Fallback gracefully when Firestore fails or is empty.**
Scope: `clientCache.service.js`.
Acceptance: if Firestore returns an empty collection or throws an error, `getNombresClientes()` returns an empty array `[]` (or previous cached value), `detectarYRemoverCliente()` returns `clienteDetectado: null` without crashing the webhook.
Check: unit test with mocked empty/failing Firestore collection.

**Assumptions (marked as assumptions):**
- Collection `Clientes` has documents with a `Nombre` field (string). Verified in `ventas.repository.js:27` (`doc.data().Nombre`).
- Performance: reading all client names from Firestore yields tens or hundreds of items, which easily fits in memory and sorts instantly.

**Explicitly out of scope (separate changes):**
- Modifying how `ventas.service.js` handles client lookup once passed down.
- Modifying Twilio signature verification or rate limiting.

## Tasks

| ID | S# | Route | Task | Status | Evidence |
|----|----|-------|------|--------|----------|
| T1 | S1,S2,S3,S4,S5 | inline | Create `clientCache.service.js` test suite (RED) | ✅ | RED observed (module not found), tests/backend/tests/unit/services/clientCache.test.ts:3-15
| T2 | S1,S2,S3,S5 | inline | Implement `backend/src/services/clientCache.service.js` (GREEN) | ✅ | 9/9 tests pass; cache + TTL + length-descending + fallback verified
| T3 | S1,S2,S4 | inline | Refactor `backend/src/whatsapp/index.js` to use `clientCache` (GREEN) | ✅ | Hardcode removed; async `detectarYRemoverCliente` uses `getNombresClients()`
| T4 | all | inline | Integration tests for WhatsApp webhook using dynamic client cache | ✅ | 8/8 tests pass; precedence, word boundaries, fallbacks, tildes covered
| T5 | all | inline | Full suite verification (`npm run test:ci`) | ✅ | 291/291 tests pass (28 files)
| T6 | all | inline | Independent verification (high risk: item 6) | ✅ | Verified: S1-S5 all PASS, 0 blockers, grep returns zero hardcoded names
| T7 | all | inline | Work-unit commit | ✅ | `b2728d1` feat(whatsapp): dynamic client names from Firestore with length-descending cache (5 files, 634 insertions) |

## Log

**L1 (user, verbatim):** "WhatsApp hardcodea clientes: ['hernan', 'mauricio', 'esperanza', 'edwin']."

**L2 (user, verbatim):** "Si acepto la Propuesta A + ordenamiento por longitud descendente. Empieza con el ciclo ODD por favor."
