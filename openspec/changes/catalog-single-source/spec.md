# Delta for catalog-single-source

## Purpose

Consolidate the product catalog into a single source of truth (Firestore). Remove 3 hardcoded copies (`productosOriginales`, `equivalencias`, `diccionarioCategorias`), derive all runtime structures from Firestore documents, fix the dead Fuse fuzzy branch, and fix the accounting bug where `Ajo en polvo * 50` sales never enter totals.

## New Capabilities

### catalog-loader

#### Scenario: Boot loads catalog from Firestore

- GIVEN the server starts
- WHEN `catalogLoader.init()` executes before `app.listen`
- THEN it SHALL read all 24 product subcollections from `Productos/Productos_ID`
- AND build an equivalencias map from each product's `sinonimos` field
- AND build a Fuse index from `{nombre, sinonimos[]}` (normalized)
- AND build a category map from each product's `categoria` field
- AND the entire catalog SHALL be available in memory before any request is served

#### Scenario: Fail-fast on Firestore unavailability

- GIVEN Firestore is unreachable at boot
- WHEN `catalogLoader.init()` attempts to read product documents
- THEN the process SHALL exit with code 1
- AND a clear error message SHALL be logged indicating Firestore is unavailable
- AND the server SHALL NOT start

#### Scenario: Admin refreshes catalog at runtime

- GIVEN the server is running with a loaded catalog
- WHEN `POST /api/admin/recargar-catalogo` is called
- THEN the loader SHALL re-read all products from Firestore
- AND rebuild the equivalencias map, Fuse index, and category map
- AND the new catalog SHALL be active immediately for subsequent requests
- AND the response SHALL confirm the refresh completed with the product count

#### Scenario: Category lookup from product documents

- GIVEN a product document has `categoria: "Ajo_en_polvo"`
- WHEN `obtenerCategoria("Ajo en polvo * 50")` is called
- THEN it SHALL return `"Ajo_en_polvo"`
- AND no hardcoded `diccionarioCategorias` SHALL be referenced

---

## Modified Capabilities

### interpretarPedido

The system SHALL read from the loaded catalog cache (async). Equivalencias exact lookup is the primary path; Fuse is the fallback with `includeScore: true`. The function becomes async.

#### Scenario: Exact equivalencia match

- GIVEN the catalog cache is loaded with `sinonimos: ["clavo grande", "clavo 100"]` for product `Clavo * 100`
- WHEN `interpretarPedido("un clavo grande")` is called
- THEN it SHALL resolve to `[{producto: "Clavo * 100", cantidad: 1}]`

#### Scenario: Fuse fuzzy fallback with working includeScore

- GIVEN the catalog cache is loaded with product `Media botella miel`
- WHEN `interpretarPedido("media botella miel")` is called
- THEN the Fuse index SHALL be searched with `includeScore: true`
- AND the score SHALL be checked against the 0.8 threshold
- AND the product SHALL resolve correctly (not fall through to "No identificado")

#### Scenario: "un" token handled as quantity 1

- GIVEN the catalog cache is loaded with `sinonimos: ["aji grande"]` for product `Aji * 100`
- WHEN `interpretarPedido("un aji grande")` is called
- THEN it SHALL resolve to `[{producto: "Aji * 100", cantidad: 1}]`
- AND SHALL NOT return "No identificado"

#### Scenario: Typo canonical name preserved

- GIVEN the catalog contains a product named `Canela molidad * 100` (typo is canonical)
- WHEN `interpretarPedido("canela molida 100")` is called
- THEN the synonym `canela molida 100` SHALL resolve to `Canela molidad * 100`
- AND the canonical name SHALL NOT be corrected (historical orders depend on it)

#### Scenario: Multiple items in one message

- GIVEN the catalog cache is loaded with products `Clavo * 100` and `Aji * 50`
- WHEN `interpretarPedido("clavo grande, 2 aji")` is called
- THEN it SHALL resolve to `[{producto: "Clavo * 100", cantidad: 1}, {producto: "Aji * 50", cantidad: 2}]`

#### Scenario: Unrecognized input returns suggestions

- GIVEN the catalog cache is loaded
- WHEN `interpretarPedido("xyz abc")` is called
- THEN it SHALL return `[{producto: "No identificado", cantidad: 1, sugerencias: [...]}]`
- AND the sugerencias list SHALL contain relevant product names

---

## ADDED Requirements

### Requirement: R-SINONIMOS — Synonyms as Product Data

Each product document in Firestore SHALL have a `sinonimos: string[]` field containing normalized variant names. All synonym values MUST be lowercase and pre-normalized. The loader SHALL compute lookup keys by normalizing each synonym at boot time.

#### Scenario: Synonym resolution for exact match

- GIVEN product `Ajo en polvo * 50` has `sinonimos: ["ajo polvo 50", "ajo molido 50"]`
- WHEN the loader builds the equivalencias map
- THEN both normalized keys SHALL resolve to `"Ajo en polvo * 50"`

#### Scenario: Typo product has correct synonyms

- GIVEN product `Canela molidad * 100` has `sinonimos: ["canela molida 100", "canela molida grande"]`
- WHEN `interpretarPedido("canela molida grande")` is called
- THEN it SHALL resolve to `Canela molidad * 100`

#### Scenario: All 53 current synonyms migrated

- GIVEN the migration script runs
- WHEN all 24 products are processed
- THEN the total count of synonym entries across all products SHALL be 53
- AND every existing synonym from the hardcoded `equivalencias` map SHALL be present

### Requirement: R-CATEGORIA — Category as Product Data

Each product document in Firestore SHALL have a `categoria: string` field. The category value SHALL match the current category key from `diccionarioCategorias`. Products without a category SHALL have `categoria: null`.

#### Scenario: Ajo en polvo has category

- GIVEN product `Ajo en polvo * 50` has `categoria: "Ajo_en_polvo"`
- WHEN `obtenerCategoria("Ajo en polvo * 50")` is called
- THEN it SHALL return `"Ajo_en_polvo"`
- AND the sale SHALL enter accounting totals (Total Productos, Cartones_vendidos, Ganancias)

#### Scenario: All 12 categories assigned to 24 products

- GIVEN the migration script runs
- WHEN all products are processed
- THEN 24 products SHALL have a non-null `categoria`
- AND every product SHALL have a `categoria` matching its product name category key

### Requirement: R-RECARGA — Runtime Catalog Refresh

The system SHALL expose a `POST /api/admin/recargar-catalogo` endpoint. This endpoint SHALL re-execute the full loader pipeline (read Firestore, build equivalencias, Fuse index, category map) and swap the in-memory cache atomically.

#### Scenario: Refresh returns success with count

- GIVEN the server is running
- WHEN `POST /api/admin/recargar-catalogo` is called
- THEN the response SHALL be `200` with body `{ success: true, productos: 24 }`
- AND subsequent `interpretarPedido` calls SHALL use the refreshed cache

#### Scenario: Refresh handles Firestore failure gracefully

- GIVEN the server is running and Firestore becomes temporarily unavailable
- WHEN `POST /api/admin/recargar-catalogo` is called
- THEN the response SHALL be `500` with a clear error message
- AND the previous cached catalog SHALL remain active (no partial state)

### Requirement: R-MIGRATION — Idempotent Seed Script

A script `scripts/seed-sinonimos.js` SHALL write `sinonimos` and `categoria` fields to each product document in Firestore. The script MUST be idempotent: running it twice with the same data produces identical Firestore state.

#### Scenario: First run migrates all data

- GIVEN the script is run against Firestore with no existing `sinonimos`/`categoria` fields
- WHEN the script completes
- THEN all 24 product documents SHALL have `sinonimos` and `categoria` fields
- AND `diccionarioCategorias` SHALL be deleted from `backend/src/utils/diccionario.js`

#### Scenario: Second run is idempotent

- GIVEN the script was already run successfully
- WHEN the script is run again with the same data
- THEN all product documents SHALL be unchanged (merge writes)
- AND no duplicate or corrupted data SHALL exist

### Requirement: R-TESTS — Unit Test Suite for interpretarPedido

The system SHALL have a unit test file `backend/tests/unit/brain/inturis.test.js` with at least 15 test scenarios covering `interpretarPedido`. All tests SHALL pass.

#### Scenario: Suite has ≥15 scenarios

- GIVEN the test file exists at `backend/tests/unit/brain/inturis.test.js`
- WHEN the test suite is counted
- THEN it SHALL contain at least 15 test cases
- AND each case SHALL test a distinct input pattern

#### Scenario: Full suite passes

- GIVEN all changes are implemented
- WHEN `npm run test:run` is executed
- THEN all tests SHALL pass with zero failures

### Requirement: R-CONTRATO-EXT — External API Contract Preservation

The system SHALL preserve the exact response shape of `GET /api/productos`. The endpoint MUST return `[{id, subcolecciones: {<nombre>: [{id, Precio carton, Precio unidad, Peso unidad, Precio a dar tienda}]}}]` with no field additions, removals, or renames.

#### Scenario: Response shape unchanged

- GIVEN the server is running with the new catalog loader
- WHEN `GET /api/productos` is called
- THEN the response SHALL have the exact same JSON structure as before the change
- AND each product SHALL have the same 4 price/peso fields per subcollection

### Requirement: R-DEP — Remove fuse CLI Dependency

The `fuse` CLI package (v0.12.1) SHALL be removed from `backend/package.json`. This is a dev/CLI tool that is not used anywhere in the codebase.

#### Scenario: fuse CLI removed

- GIVEN `backend/package.json` is inspected
- WHEN checking the `dependencies` and `devDependencies` sections
- THEN `fuse` SHALL NOT be present
- AND `npm install` SHALL complete without errors

### Requirement: R-INTERPRETAR — Fuzzy Search with Working includeScore

The Fuse index SHALL be initialized with `includeScore: true`. The fuzzy fallback branch SHALL function correctly: in Fuse.js a LOWER score means a CLOSER match (0 = exact, 1 = no match), so when a candidate score is below 0.8 it SHALL be accepted as a match; when it is equal to or above 0.8 it SHALL be rejected.

#### Scenario: Fuse score threshold works

- GIVEN the Fuse index is built with `includeScore: true`
- WHEN `interpretarPedido("miel jumbo")` is called (close but not exact)
- THEN Fuse SHALL return results with numeric scores
- AND candidates with score < 0.8 SHALL be accepted (closer match)
- AND candidates with score ≥ 0.8 SHALL be rejected

#### Scenario: Fuse disabled when includeScore missing (regression guard)

- GIVEN the Fuse index is built WITHOUT `includeScore`
- WHEN results are returned
- THEN the score field SHALL be `undefined`
- AND the system SHALL NOT crash (graceful degradation)

---

## Key Learnings

1. The catalog currently lives in 4 places: Firestore, productosOriginales, equivalencias, and diccionarioCategorias — this change consolidates to 1.
2. Ajo en polvo * 50 is missing from diccionarioCategorias, causing a live accounting bug where its sales never enter totals.
3. Fuse.js v7 requires `includeScore: true` explicitly — without it the fuzzy branch is dead code.
4. `normalizarTexto` "de" handling is a deliberate business rule (`de` → `*`, the canonical product separator) — the rule and its tests are kept unchanged in this change.
5. The typo "Canela molidad * 100" is canonical in Firestore and historical orders — it must NOT be corrected.
