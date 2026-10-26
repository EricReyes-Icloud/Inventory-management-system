# PR-028: preserve ñ in normalizarTexto

**Branch:** `feat/backend-robustez`
**Type:** `type:bug`

---

## Summary

- `normalizarTexto` was stripping the `ñ` from Spanish words because `NFD` decomposes `ñ` (U+00F1) into `n` + combining tilde (U+0303), and the subsequent diacritic removal step deletes that combining tilde.
- This corrupted product names, synonyms, and NLP search strings: `caña → cana`, `jalapeño → jalapeno`, `10 canela pequeña → 10 canela pequena`.
- Fix: mark `ñ`/`Ñ` with Private Use Area codepoints before `NFD`, restore them after diacritic removal, and switch the symbol-cleaning regex from `[^\w\s]` to `[^\p{L}\p{N}\s]` (Unicode-aware) so `ñ` survives as a letter.

## Changes

| File | Change |
|------|--------|
| `backend/src/utils/normalizarTexto.js` | Preserve `ñ`/`Ñ` via PUA markers around `NFD`; use `\p{L}\p{N}` regex instead of `\w` |
| `backend/tests/unit/utils/normalizarTexto.test.ts` | Add 5 tests for `ñ` preservation; fix 3 existing expectations that codified the bug |

## Test Plan

- [x] `npx vitest run tests/unit/utils/normalizarTexto.test.ts` — 12/12 passing
- [x] `npm run test:ci` — 262/262 passing (25 files)
- [x] Manual spot-check: `caña`, `jalapeño`, `piñata`, `años`, `niña`, `10 canela pequeña`, `Ñandú`, `AÑO` all preserve `ñ`; `AJÍ`, `Café`, `perú` still strip other accents
- [x] No regressions in consumers: `brain/inturis.js`, `catalog/loader.js`, `ventas.repository.js`

## Contributor Checklist

- [x] Linked an approved issue (Closes #<issue-number>)
- [x] Added exactly one `type:*` label (`type:bug`)
- [x] Conventional commit format
- [x] No `Co-Authored-By` trailer
- [x] Tests added alongside the behavior change
