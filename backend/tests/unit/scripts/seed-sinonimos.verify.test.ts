import { describe, it, expect, beforeAll } from "vitest";
import { createMockDb, buildMockStore } from "../../helpers/firestoreMock";

/**
 * Independent regression suite for `scripts/seed-sinonimos.js`, authored by the
 * independent verifier of the `seed-catalog-docid-fix` feature.
 *
 * It deliberately overlaps with `seed-sinonimos.test.ts` in two places the
 * implementer's suite did not pin, because both are acceptance criteria:
 *
 *   S3 — the abort error must NAME THE PRODUCT and the DOCUMENT COUNT, not just
 *        mention the failure mode. The implementer's suite only matched
 *        /no documents/ and /more than one document/, so a regression that
 *        dropped the product name from the message would have passed.
 *   S1 — no two writes may target the same path, and `seedCatalog` must report
 *        the number of documents it wrote.
 *
 * Everything here asserts through the public `seedCatalog(db, entries)` seam and
 * the shared `firestoreMock` helpers, never against implementation internals.
 */

const scriptPath = "../../../../scripts/seed-sinonimos.js";
const ROOT = "Productos/Productos_ID";

/**
 * Existing document-ID pattern, from the docstring in `productos.repository.js`
 * (docId example: "Clavo_1"). A Firestore query without `orderBy` is ordered by
 * document ID, and " " (0x20) sorts before "_" (0x5F), so a document named after
 * the product would win `docs[0]` and the readers would return no price fields.
 * That is the production bug this feature fixes.
 */
const existingId = (p: string) => `${p.split(" * ")[0]}_1`;

/** Escapes a literal string for safe interpolation into a RegExp. */
const re = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function dbWith(docs: Record<string, any>) {
  const { mockDb, refs } = createMockDb();
  buildMockStore({ products: docs }, mockDb, refs);
  return { mockDb, refs };
}

describe("seedCatalog verifier probes", () => {
  let script: any;
  let products: string[];

  beforeAll(() => {
    script = require(scriptPath);
    products = Object.keys(script.SNAPSHOT_SYNONYMS);
  });

  function fullStore(extra: Record<string, any> = {}) {
    const store: Record<string, any> = { ...extra };
    for (const p of products) {
      store[`${ROOT}/${p}/${existingId(p)}`] = { "Precio carton": 5000 };
    }
    return store;
  }

  // S1 + S4
  it("writes once per product onto the existing docId and commits once", async () => {
    const { mockDb, refs } = dbWith(fullStore());

    const written = await script.seedCatalog(mockDb, script.dryRun());

    expect(written).toBe(24);

    const paths = refs.batchSet.mock.calls.map((c: any[]) => c[0].path);
    expect(paths).toHaveLength(24);
    expect(new Set(paths).size).toBe(24);

    for (const p of products) {
      expect(paths).toContain(`${ROOT}/${p}/${existingId(p)}`);
      expect(paths).not.toContain(`${ROOT}/${p}/${p}`);
    }

    expect(refs.batchCommit).toHaveBeenCalledTimes(1);
  });

  // S3 — empty subcollection
  it("aborts on an empty subcollection naming product + count before any write", async () => {
    const target = products[5];
    const store = fullStore();
    delete store[`${ROOT}/${target}/${existingId(target)}`];
    const { mockDb, refs } = dbWith(store);

    await expect(script.seedCatalog(mockDb, script.dryRun())).rejects.toThrow(
      new RegExp(`"${re(target)}".*(no documents|\\b0\\b)`)
    );

    expect(refs.batchSet).not.toHaveBeenCalled();
    expect(refs.batchCommit).not.toHaveBeenCalled();
  });

  // S3 — ambiguous subcollection
  it("aborts on an ambiguous subcollection naming product + count before any write", async () => {
    const target = products[11];
    const store = fullStore({
      [`${ROOT}/${target}/${target.split(" * ")[0]}_2`]: {},
    });
    const { mockDb, refs } = dbWith(store);

    await expect(script.seedCatalog(mockDb, script.dryRun())).rejects.toThrow(
      new RegExp(`"${re(target)}".*\\(2\\)`)
    );

    expect(refs.batchSet).not.toHaveBeenCalled();
    expect(refs.batchCommit).not.toHaveBeenCalled();
  });
});
