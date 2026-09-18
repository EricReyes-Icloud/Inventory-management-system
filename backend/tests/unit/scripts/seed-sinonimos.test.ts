import { describe, it, expect } from "vitest";

/**
 * Test suite for scripts/seed-sinonimos.js — the one-time migration script.
 *
 * These tests verify the snapshot data (53 synonyms, 12 categories)
 * without requiring Firestore. The script exports its snapshot data
 * and a dry-run function for testing.
 */

// Import the script's snapshot data
// The script must export: SNAPSHOT_SYNONYMS, SNAPSHOT_CATEGORIES, dryRun
const scriptPath = "../../../../scripts/seed-sinonimos.js";

describe("seed-sinonimos snapshot", () => {
  let SNAPSHOT_SYNONYMS: Record<string, string[]>;
  let SNAPSHOT_CATEGORIES: Record<string, string>;

  beforeAll(() => {
    const script = require(scriptPath);
    SNAPSHOT_SYNONYMS = script.SNAPSHOT_SYNONYMS;
    SNAPSHOT_CATEGORIES = script.SNAPSHOT_CATEGORIES;
  });

  // ═══════════════════════════════════════════
  // SYNONYM COUNT
  // ═══════════════════════════════════════════

  describe("synonym snapshot", () => {
    it("has exactly 53 total synonym entries across all products", () => {
      const totalCount = Object.values(SNAPSHOT_SYNONYMS).reduce(
        (sum, arr) => sum + arr.length,
        0
      );
      expect(totalCount).toBe(53);
    });

    it("covers all 24 products (one entry per canonical product)", () => {
      expect(Object.keys(SNAPSHOT_SYNONYMS)).toHaveLength(24);
    });

    it("each synonym is a lowercase string", () => {
      for (const [product, synonyms] of Object.entries(SNAPSHOT_SYNONYMS)) {
        for (const syn of synonyms) {
          expect(typeof syn).toBe("string");
          expect(syn).toBe(syn.toLowerCase());
          expect(syn.length).toBeGreaterThan(0);
        }
      }
    });

    it("maps 'aji grande' to Aji * 100 (real equivalence data)", () => {
      expect(SNAPSHOT_SYNONYMS["Aji * 100"]).toContain("aji grande");
    });

    it("maps 'canela molida 100' to Canela molidad * 100 (typo is canonical)", () => {
      expect(SNAPSHOT_SYNONYMS["Canela molidad * 100"]).toContain(
        "canela molida 100"
      );
    });

    it("maps 'media botella' to Media botella miel", () => {
      expect(SNAPSHOT_SYNONYMS["Media botella miel"]).toContain("media botella");
    });

    it("maps 'un aji grande' synonym 'aji grande' resolves to Aji * 100 not Aji * 50", () => {
      // 'un aji grande' → quantity 1, product 'aji grande' → Aji * 100
      const aji100 = SNAPSHOT_SYNONYMS["Aji * 100"];
      const aji50 = SNAPSHOT_SYNONYMS["Aji * 50"];
      expect(aji100).toContain("aji grande");
      expect(aji50).not.toContain("aji grande");
    });
  });

  // ═══════════════════════════════════════════
  // CATEGORY COUNT
  // ═══════════════════════════════════════════

  describe("category snapshot", () => {
    it("has exactly 12 unique category values across 24 products (11 original + Ajo_en_polvo fix)", () => {
      const uniqueCategories = new Set(Object.values(SNAPSHOT_CATEGORIES));
      expect(uniqueCategories.size).toBe(12);
      // But the map has one entry per product (24 entries)
      expect(Object.keys(SNAPSHOT_CATEGORIES)).toHaveLength(24);
    });

    it("each category is a non-empty string with underscore separator", () => {
      for (const [product, category] of Object.entries(SNAPSHOT_CATEGORIES)) {
        expect(typeof category).toBe("string");
        expect(category.length).toBeGreaterThan(0);
        // Categories use underscores (e.g., Ajo_en_polvo, Canela_molida)
        expect(category).toMatch(/^[A-Z][a-z]+(_[A-Za-z]+)*$/);
      }
    });

    it("includes Ajo_en_polvo (the bug fix — was missing from diccionarioCategorias)", () => {
      const values = Object.values(SNAPSHOT_CATEGORIES);
      expect(values).toContain("Ajo_en_polvo");
    });

    it("includes Miel (covers 6 products)", () => {
      const values = Object.values(SNAPSHOT_CATEGORIES);
      expect(values).toContain("Miel");
    });
  });

  // ═══════════════════════════════════════════
  // STRUCTURAL INTEGRITY
  // ═══════════════════════════════════════════

  describe("structural integrity", () => {
    it("every product with categories has a category entry", () => {
      // All 24 products should have a category entry
      for (const product of Object.keys(SNAPSHOT_SYNONYMS)) {
        expect(SNAPSHOT_CATEGORIES).toHaveProperty(product);
      }
    });

    it("every category entry references a product in the synonym map", () => {
      for (const product of Object.keys(SNAPSHOT_CATEGORIES)) {
        expect(SNAPSHOT_SYNONYMS).toHaveProperty(product);
      }
    });
  });
});

describe("seed-sinonimos --dry-run", () => {
  it("dryRun() returns an array of write descriptors without touching Firestore", () => {
    const script = require(scriptPath);
    const writes = script.dryRun();

    // Should be an array of write operations
    expect(Array.isArray(writes)).toBe(true);
    expect(writes.length).toBeGreaterThan(0);

    // Each write should have product, sinonimos, and categoria
    for (const write of writes) {
      expect(write).toHaveProperty("product");
      expect(write).toHaveProperty("sinonimos");
      expect(write).toHaveProperty("categoria");
      expect(Array.isArray(write.sinonimos)).toBe(true);
    }
  });

  it("dryRun() includes all 24 products", () => {
    const script = require(scriptPath);
    const writes = script.dryRun();

    expect(writes).toHaveLength(24);
  });
});
