# PR-032: Dynamic WhatsApp Client Cache from Firestore

## Description

This PR replaces the hardcoded client name list in the WhatsApp webhook handler with a dynamic, in-memory cache populated from Firestore. Previously, `backend/src/whatsapp/index.js` contained a static array `["hernan", "mauricio", "esperanza", "edwin"]` used by `detectarYRemoverCliente()` to strip client names from incoming WhatsApp messages before parsing. This created a maintenance burden — every new client required a code change and deploy — and risked divergence between the code list and the actual client data in Firestore.

The solution introduces `backend/src/services/clientCache.service.js`, a lightweight service that:
- Loads all client names from the `Clientes` collection on first use (reading the `clienteNombre` field, with fallbacks to `Nombre`, `Name`, or document ID)
- Normalizes names (lowercase, strip accents) for reliable matching
- Sorts names by length descending so longer names like "juan carlos" match before shorter prefixes like "juan"
- Caches results in memory with a configurable TTL (default 5 minutes) to avoid per-request Firestore reads
- Provides `invalidateCache()` for manual refresh
- Falls back gracefully to an empty array if Firestore is unavailable or empty, allowing the webhook to continue processing (just without client detection)

The webhook handler now calls `await getNombresClients()` instead of iterating a hardcoded array. All existing tests pass and 17 new tests verify the cache behavior, length-precedence matching, accent normalization, word-boundary safety, and Firestore failure fallbacks.

## Changes Made

### Feature: Dynamic Client Cache Service
- **`backend/src/services/clientCache.service.js`** (new)
  - `getNombresClients()` — returns cached or freshly-fetched client names
  - `invalidateCache()` — forces cache refresh on next call
  - `CLIENT_TTL_MS` — configurable TTL constant (default 300000ms / 5 min)
  - Reads from `Clientes` collection, prioritizes `clienteNombre` field
  - Normalizes via NFD + diacritic removal, sorts by length descending

### Bug Fix: WhatsApp Webhook Client Detection
- **`backend/src/whatsapp/index.js`**
  - Removed hardcoded `const clientes = ["hernan", "mauricio", "esperanza", "edwin"]`
  - `detectarYRemoverCliente()` is now `async` and calls `getNombresClients()`
  - Added import for `getNombresClients` from `clientCache.service.js`

### Test Coverage
- **`backend/tests/unit/services/clientCache.test.ts`** (new)
  - 9 unit tests: exports, normalization, length-descending sort, accent handling, doc ID fallback, empty collection, Firestore error, cache TTL behavior, manual invalidation
- **`backend/tests/unit/whatsapp/webhook.client-detection.test.ts`** (new)
  - 8 integration tests: dynamic client detection, length precedence (`juan carlos` > `juan`), accent normalization, word boundaries (no partial matches), empty Firestore fallback, Firestore error fallback, empty cache fallback, message stripping verified

### Documentation
- **`odd/tasks/whatsapp-client-cache-dynamic-names.md`** (new)
  - Feature specification with S1–S5, task breakdown T1–T7, and decision log

## Impact

### Behavior Changes
- **Client names are now authoritative from Firestore**. Adding/removing/renaming a client in the `Clientes` collection takes effect within the TTL window (default 5 min) or immediately after `invalidateCache()`. No code change or deploy required.
- **Longer names win**. A message like `"juan carlos 5 ajies"` now correctly matches `"juan carlos"` instead of greedily matching `"juan"` and leaving `"carlos 5 ajies"` for the parser.
- **Accents are normalized**. A client named `"José"` in Firestore is matched by `"jose"` in the message.
- **Word boundaries enforced**. A client named `"Ed"` will not incorrectly match inside `"edicion"`.

### Backward Compatibility
- **Fully backward compatible** for existing clients. The original four names (`hernan`, `mauricio`, `esperanza`, `edwin`) continue to work identically — they are now sourced from Firestore instead of code.
- **Webhook never fails due to cache**. If Firestore is down or empty, `getNombresClients()` returns `[]` and the webhook processes the message with `clienteDetectado: null`. The downstream `ventas.service.js` will still attempt to find the client by name and return `cliente_no_encontrado` if needed — same behavior as before, just without the false-positive hardcoded detection.

### Developer Experience
- **No more code edits for new clients**. Operations can manage the client list directly in Firestore.
- **Observable cache behavior**. Logs show `[clientCache] Error fetching...` on Firestore failures; `invalidateCache()` available for immediate refresh during testing.

### Risks / Caveats
- **TTL staleness**. A newly added client in Firestore won't be detectable until the cache expires (5 min default) or `invalidateCache()` is called. Adjust `CLIENT_CACHE_TTL_MS` env var if a different window is needed.
- **Collection name is `Clientes`** (Spanish). The service expects this exact collection name; changing it requires a code update.

## Notes

### How to Test
1. Run full test suite: `npm run test:ci` (expects 291 passing tests)
2. Run cache unit tests: `npm run test:ci -- backend/tests/unit/services/clientCache.test.ts`
3. Run webhook integration tests: `npm run test:ci -- backend/tests/unit/whatsapp/webhook.client-detection.test.ts`
4. Manual verification (requires running backend):
   - Send WhatsApp message: `"hernan 4 ajies"` → logs should show `👤 Cliente detectado: hernan`
   - Send: `"juan carlos 5 ajies"` (with "Juan" and "Juan Carlos" in Firestore) → detects `"juan carlos"`
   - Send: `"jose 3 miel"` (with "José" in Firestore) → detects `"jose"`
   - Send: `"edicion 2 clavos"` (with "Ed" and "Edwin" in Firestore) → detects `null` (word boundary)

### Follow-up
- Consider adding a Firestore `onWrite` trigger to auto-invalidate cache on `Clientes` changes (eliminates TTL delay).
- If client count grows significantly (>10k), evaluate pagination or a dedicated search index.

### Related
- Closes technical debt: "WhatsApp hardcodea clientes: ['hernan', 'mauricio', 'esperanza', 'edwin']"
- Complements: PR-027 (WhatsApp order auth hardening) — auth layer was already dynamic; this makes client detection dynamic too.