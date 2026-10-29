# Pull Request: Make canonical product name explicit via nombreCanonico

## Description

This pull request resolves a fragile design in the product catalog where canonical product names were dynamically derived at runtime from Firestore subcollection IDs (e.g., `subcol.id`). Relying on subcollection IDs as the source of truth for canonical names introduced data fragility: historical typos in subcollection IDs (such as `"Canela molidad * 100"`) propagated silently into orders, line items, and monthly accounting records. 

To eliminate this fragility, the system now treats the canonical product name as an explicit data attribute stored directly within the product document. We introduced a `nombreCanonico` field across the catalog seed data and updated the repository reading layer to prefer `nombreCanonico` while maintaining a robust fallback to `subcol.id` for any unseeded documents. Because all downstream catalog consumers (`catalogLoader`, `inturis.js`, `ventas.service.js`, and `contabilidad.repository.js`) read product names from the repository's output (`p.nombre`), this architectural fix is completely transparent to consumers, eliminating runtime string derivation without breaking backward compatibility.

## Changes Made

### Features & Architecture
- **`scripts/seed-sinonimos.js`**: Updated `dryRun()` descriptors and `seedCatalog()` batch write payloads to include and merge the explicit `nombreCanonico` field alongside `sinonimos` and `categoria`.
- **`backend/src/repositories/productos.repository.js`**: Modified `getCatalogo()` to read `data.nombreCanonico || subcol.id`, making `nombreCanonico` the primary source of truth with backward-compatible fallback.

### Testing & Verification
- **`backend/tests/unit/scripts/seed-sinonimos.test.ts`**: Added assertions to verify that `nombreCanonico` is correctly included in dry-run descriptors and batch write payloads for all 24 products.
- **`backend/tests/unit/repositories/productos.repository.nombreCanonico.test.ts`**: Created a dedicated unit test suite verifying `nombreCanonico` preference over `subcol.id` and proper fallback behavior.
- **Test suite**: Full suite verified at 267/267 tests passing across 26 files with zero regressions.

## Impact

- **Data Integrity**: Canonical product names are now explicit data fields in Firestore rather than derived runtime strings, preventing structural propagation of subcollection typos.
- **Backward Compatibility**: Fully backward-compatible; unseeded documents gracefully fall back to `subcol.id`.
- **Developer Experience**: Downstream modules require zero code changes as the single-source architecture correctly encapsulates the data source upgrade.

## Notes

- **Verification**: Verified independently via `gentle-ai-verify` (S1–S4 passed, high-risk items 1 and 3 validated).
- **Deployment & Seed**: The seed script executes idempotent merge writes (`{ merge: true }`). Running the seed in production updates `nombreCanonico` without disrupting existing prices or stock fields.
- **Operational Advisory**: If a product subcollection name in Firestore contains a typo, correcting it requires renaming the subcollection in addition to updating `nombreCanonico`. Re-running the seed will re-assert snapshot values.
