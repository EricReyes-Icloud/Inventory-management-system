# Fix Seed Catalog to Merge Onto the Existing Product Document (seed-catalog-docid-fix)

## Description

`scripts/seed-sinonimos.js` (added by the catalog-single-source change, merged as PR #25) wrote every product with `.collection(product).doc(product).set(...)`, so each of the 24 product subcollections under `Productos/Productos_ID` would end up with a second document whose ID is the product name (e.g. `Aji * 100`). The catalog readers — `buscarSubcoleccion` and `getCatalogo` in `backend/src/repositories/productos.repository.js` — take `docs[0]` of the subcollection with no `orderBy`, and Firestore orders a query without `orderBy` by document ID ascending. Since `" "` (0x20) sorts before `"_"` (0x5F), a document named `Aji * 100` sorts before the real `Aji_1`, so the readers would return the seed document, which carries no price fields. The predicted production impact was price 0 on 18 products and wrong accounting totals.

This PR makes the seed resolve the document that already exists in each product subcollection and merge `{sinonimos, categoria}` onto it with `{merge: true}`, never creating a document named after the product. The write path was extracted into an injectable `seedCatalog(db, entries)` function so it can be exercised without Firestore. Two fail-fast guards were added: the seed aborts with zero writes when a subcollection is empty or has more than one document, and the error names the product and the document count. All 24 writes are collected in one atomic `WriteBatch` and committed once, so a failure leaves Firestore unchanged instead of half-seeded. The script now authenticates through the repo's canonical `backend/src/secrets/serviceAccountKey.json` and runs from the repository root via `npm run seed:catalog`.

The write path had zero test coverage before this change (the pre-existing suite covered only the snapshot maps and `dryRun()`), which is how the bug escaped. This PR adds two write-path suites, including an independent regression suite adopted from the verification round; RED was observed against both the baseline script (6 failures) and a mutant that reintroduces `.doc(product)` (4 failures). The full suite `npm run test:ci` is green at 20 files / 187 tests, both before and after the commit. Post-commit, the fixed seed was executed against the production project and verified with read-only probes (details in Notes). Feature document: `odd/tasks/seed-catalog-docid-fix.md`.

## Changes Made

### Bug fixes

- `scripts/seed-sinonimos.js` — write path rewritten: new exported `seedCatalog(db, entries)` resolves the existing document ID in each product subcollection in a read-only phase, then merges `{sinonimos, categoria}` onto it via `batch.set(ref, data, {merge: true})`. The pre-fix `.collection(product).doc(product).set(...)` write is gone.
- `scripts/seed-sinonimos.js` — fail-fast guards before any write: a subcollection with zero documents throws `Seed aborted: subcollection "{product}" has no documents; refusing to create one.`; a subcollection with more than one document throws an error naming the product and the actual count. Both aborts are asserted to make zero write calls.
- `scripts/seed-sinonimos.js` — all writes are committed in a single atomic `WriteBatch` (24 operations, well under the 500-operation batch limit).

### Dev tooling

- `scripts/seed-sinonimos.js` — authenticates with `admin.credential.cert(...)` loaded from `backend/src/secrets/serviceAccountKey.json`, the same credential source `backend/src/lib/firestore.js` uses; no dependency on `GOOGLE_APPLICATION_CREDENTIALS`.
- `scripts/seed-sinonimos.js` — `firebase-admin` is resolved explicitly from the backend workspace's `node_modules` via `require.resolve` with paths, so the root-level script runs without `NODE_PATH`.
- `scripts/seed-sinonimos.js` — header now documents the working commands: `npm run seed:catalog -- --dry-run` and `npm run seed:catalog`.
- `package.json` — new root script `seed:catalog` (`node scripts/seed-sinonimos.js`).

### Tests

- `backend/tests/unit/scripts/seed-sinonimos.test.ts` — new `seedCatalog` write-path suite: every write targets the document that already exists (never one named after the product), the merge preserves existing fields (price, stock), the snapshot `sinonimos`/`categoria` are written for each of the 24 products, every write commits in a single batch, and both empty and ambiguous subcollections abort without writing.
- `backend/tests/unit/scripts/seed-sinonimos.verify.test.ts` — new independent regression suite (adopted from the verification round): one write per product onto the existing docId with exactly one commit, and both abort errors must name the product and the document count before any write call.
- `backend/tests/helpers/firestoreMock.ts` — `buildMockStore` honors a new optional `products` scenario key (flat path-to-data map for the `Productos/Productos_ID/...` tree).
- `backend/tests/helpers/firestoreMockTypes.ts` — `Scenario` gains the typed `products?: Record<string, any>` key.

### Documentation

- `odd/tasks/seed-catalog-docid-fix.md` — ODD feature document for this change: specs S1-S7, task table, decision log, and the independent-verification record.

## Impact

- The seed can no longer corrupt the catalog: running it merges only `{sinonimos, categoria}` onto the 24 existing product documents, so price, stock, and every other existing field survive (`{merge: true}`, pinned by test).
- Behavior change (intentional): the seed refuses to run when a product subcollection is empty or contains more than one document instead of guessing. The pre-fix script was never executed against Firestore — the fixed script is the version that ran in production, so the predicted damage (18 products at price 0) never occurred.
- Backward compatibility: the written data shape is unchanged (`{sinonimos, categoria}` with merge semantics); only the write target and atomicity changed. Dry-run output is unchanged (24 products / 53 synonyms / 12 categories, exit 0) and never touches Firestore.
- Dev experience: `npm run seed:catalog` works from the repository root with no `NODE_PATH` and no environment-variable setup, and the previously untestable write path is now covered by focused suites (2 files / 24 tests).
- Caveat: the catalog readers still depend on `docs[0]` document-ID ordering; removing that coupling is explicitly out of scope for this PR and remains a follow-up.

## Notes

- How to verify: `npm run test:ci` — 20 files / 187 tests, exit 0 (green before and after this commit); `npm run seed:catalog -- --dry-run` — previews 24 products / 53 synonyms / 12 categories with zero Firestore writes.
- Production verification (performed after this commit, before opening this PR): the fixed seed was executed against the production Firestore project and checked with read-only probes — 24/24 documents match the snapshot, 0 documents are named after the product, and price fields are intact. After restarting the backend, the catalog loaded with 24 products / 53 equivalencias / 12 categories, and two end-to-end test orders via WhatsApp completed correctly.
- Reviewer attention: open item D6 in `odd/tasks/seed-catalog-docid-fix.md` — the empty/ambiguous-subcollection guard and the single atomic batch go beyond the literal fix request and have not been explicitly reviewed by the maintainer.
- Known pre-existing advisory (unchanged here): the `SNAPSHOT_CATEGORIES` doc comment in `scripts/seed-sinonimos.js` says 11 categories while the map contains 12.
- Base branch: `develop` — this branch is additive on top of it (the catalog-single-source work already merged into `develop` as PR #25).
