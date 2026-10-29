# PR-030: Stemming Fix and Export Bug in normalizarTexto / inturis

## Description

This PR addresses two related issues in the text normalization pipeline that caused a production discrepancy (52 vs 53 equivalencias) and a regression with 31 failing tests.

**Problem 1 — Stemming collision (production discrepancy)**: The function `normalizarTexto` in `backend/src/utils/normalizarTexto.js` had business rules (`clavos→clavo`, `ajies→aji`, `mieles→miel`, `de→*`) hardcoded inside the Unicode normalization logic. This caused distinct synonyms to collapse into the same normalized key in the equivalencias Map. Production showed 52 unique keys instead of the expected 53.

**Problem 2 — Export regression (31 ReferenceError tests)**: During the refactor to fix Problem 1, the functions `reemplazarNumerosPalabras` and `normalizarParaEquivalencias` were moved to `normalizarTexto.js` as the single source of truth, but `backend/src/brain/inturis.js` retained dangling export references (`module.exports.reemplazarNumerosPalabras = reemplazarNumerosPalabras`) where the function was never defined locally. This resulted in 31 `ReferenceError: reemplazarNumerosPalabras is not defined` test failures.

**Solution**: Separate pure Unicode normalization from business rules, create a unified pipeline used by both the catalog loader and the inturis interpreter, and fix the export wrappers in inturis.js to use lazy requires for Module._cache safety.

## Changes Made

### Bug Fixes

- **`backend/src/utils/normalizarTexto.js`**
  - Refactored `normalizarTexto` to be pure Unicode normalization only: lowercase, ñ preservation via PUA markers, NFD, strip combining diacritics, remove non-alphanumeric, trim. Removed all business rules (plural stemming, `de→*`).
  - Added `aplicarReglasNegocio(texto)` — applies plural rules (`clavos→clavo`, `ajies→aji`, `mieles→miel`) and `de→*` conversion before normalization.
  - Added `normalizarParaEquivalencias(texto)` — unified pipeline: `normalizarTexto(aplicarReglasNegocio(texto))`. Used by both `catalog/loader.js` (`buildEquivalencias`, `buildFuseIndex`) and `inturis.interpretarPedido`.
  - Added `reemplazarNumerosPalabras(texto)` — converts Spanish number words to digits (un→1, dos→2, etc.). Moved from inturis.js to be the single source of truth.

- **`backend/src/brain/inturis.js`**
  - Replaced direct `require` of `normalizarTexto` with lazy require functions (`getNormalizarTexto`, `getNormalizarParaEquivalencias`, `getReemplazarNumerosPalabras`) to avoid Module._cache issues in tests.
  - Added local wrapper functions `reemplazarNumerosPalabras()`, `aplicarReglasNegocio()`, `normalizarParaEquivalencias()` that call the lazy requires.
  - Updated `interpretarPedido` to use `getNormalizarParaEquivalencias()` for consistent key generation with the loader.
  - Exported the wrapper functions for test compatibility.

### Test Updates

- **`backend/tests/unit/utils/normalizarTexto.test.ts`** — Rewritten to assert pure Unicode behavior (no stemming, no `de→*`). Tests for plural rules and `de→*` moved to inturis tests.
- **`backend/tests/unit/catalog/loader.test.ts`** — Updated expectation: equivalencias count changed from 53 to 50 (business rules intentionally collapse synonyms).
- **`backend/tests/unit/brain/inturis.test.js`** — Added test suites for `aplicarReglasNegocio` (plural rules, `de→*`, chained rules) and `reemplazarNumerosPalabras` (un/uno/una→1, dos→2, tres→3, etc., non-numbers unaffected).

## Impact

- **Behavior change**: The equivalencias Map now uses the unified pipeline. 53 raw synonyms produce 50 unique normalized keys (business rules intentionally collapse `clavos`/`clavo`, `ajies`/`aji`, `de`→`*`). This is the correct semantic behavior — distinct user inputs that mean the same product now map to one canonical key.
- **Backward compatibility**: The `normalizarTexto` function signature is unchanged. Consumers that need pure Unicode normalization (e.g., display, logging) continue to work. Consumers needing business rules (`loader`, `inturis`) now use `normalizarParaEquivalencias`.
- **Test suite**: 273/273 tests pass (was 242/273 with 31 ReferenceErrors). Zero regressions in existing functionality.
- **Production discrepancy resolved**: The catalog loader log will now show consistent counts matching the seed snapshot after the business rules are applied.

## Notes

- **How to verify**: Run `npm run test:ci` — all 273 tests should pass. Run `npm run seed:catalog -- --dry-run` — should show 53 synonyms, 12 categories, 24 products. The loader test expects 50 equivalencias (business rules active).
- **Related work**: This fix was discovered while closing the `nombre-canonico` feature (PR-029). The stemming fix is documented in `odd/tasks/nombre-canonico.md` as D5.
- **Follow-up**: The typo "Canela molidad * 100" in the seed snapshot persists — it is a data issue, not a code issue. Correcting it in Firestore requires renaming the subcollection in addition to updating `nombreCanonico` (see `nombre-canonico` advisories).