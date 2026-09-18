import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Module from "module";
import path from "path";
import { getBackendRoot } from "../../helpers/paths";

declare module "module" {
  interface Module {
    _cache: Record<string, NodeModule | undefined>;
  }
}

const projectRoot = getBackendRoot();
const firestorePath = path.resolve(projectRoot, "src/lib/firestore.js");
const productosRepoPath = path.resolve(
  projectRoot,
  "src/repositories/productos.repository.js"
);

// ── Catalog mock data — mirrors real Firestore structure ───────────
// 24 products, 53 equivalencias (each sinonimo = 1 entry), 11 categories
const MOCK_CATALOGO = [
  // ── Aji (2 products) ──
  { nombre: "Aji * 100", sinonimos: ["aji 100", "aji grande", "ajies", "ajies grandes"], categoria: "Aji" },
  { nombre: "Aji * 50", sinonimos: ["aji pequeno", "aji 50", "ajies pequenos"], categoria: "Aji" },
  // ── Ajo en polvo (1 product) ──
  { nombre: "Ajo en polvo * 50", sinonimos: ["ajo en polvo", "ajo polvo", "ajo molido"], categoria: "Ajo_en_polvo" },
  // ── Bicarbonato (2 products) ──
  { nombre: "Bicarbonato * 100", sinonimos: ["bicarbonato 100", "bicarbonato grande"], categoria: "Bicarbonato" },
  { nombre: "Bicarbonato * 50", sinonimos: ["bicarbonato 50", "bicarbonato pequeno"], categoria: "Bicarbonato" },
  // ── Canela entera (4 products) ──
  { nombre: "Canela * 100 pequena", sinonimos: ["canela 100"], categoria: "Canela" },
  { nombre: "Canela * 50 grande", sinonimos: ["canela grande"], categoria: "Canela" },
  { nombre: "Canela * 50 mediana", sinonimos: ["canela mediana", "canela en rama"], categoria: "Canela" },
  { nombre: "Canela * 50 pequena", sinonimos: ["canela pequena"], categoria: "Canela" },
  // ── Canela molida (2 products) ──
  { nombre: "Canela molida * 50", sinonimos: ["canela molida 50", "canela polvo", "canela molida"], categoria: "Canela_molida" },
  { nombre: "Canela molidad * 100", sinonimos: ["canela molida 100", "canela molida grande"], categoria: "Canela_molida" },
  // ── Clavo (2 products) ──
  { nombre: "Clavo * 100", sinonimos: ["clavo", "clavos", "clavo 100", "clavo grande", "clavos de 100"], categoria: "Clavo" },
  { nombre: "Clavo * 50", sinonimos: ["clavo 50", "clavo pequeno", "clavos de 50"], categoria: "Clavo" },
  // ── Coco (1 product) ──
  { nombre: "Coco * 30", sinonimos: ["coco", "coco pequeno"], categoria: "Coco" },
  // ── Color (1 product) ──
  { nombre: "Color * 50", sinonimos: ["color", "color pequeno"], categoria: "Color" },
  // ── Comino (1 product) ──
  { nombre: "Comino * 50", sinonimos: ["comino", "comino pequeno"], categoria: "Comino" },
  // ── Miel family (5 products) ──
  { nombre: "Copas de miel", sinonimos: ["copas de miel", "copa de miel"], categoria: "Miel" },
  { nombre: "Frasco de miel", sinonimos: ["frasco de miel", "frasco miel", "frasco"], categoria: "Miel" },
  { nombre: "Media botella miel", sinonimos: ["media botella", "botella de miel"], categoria: "Miel" },
  { nombre: "Miel * 100", sinonimos: ["miel", "miel grande"], categoria: "Miel" },
  { nombre: "Miel * 50", sinonimos: ["miel pequena", "miel mediana"], categoria: "Miel" },
  { nombre: "Miel jumbo * 50", sinonimos: ["miel jumbo"], categoria: "Miel" },
  // ── Salsina (1 product) ──
  { nombre: "Salsina * 50", sinonimos: ["salsina", "salsina pequena"], categoria: "Salsina" },
  // ── Uva (1 product) ──
  { nombre: "Uva * 30", sinonimos: ["uva", "uva pequena"], categoria: "Uva" },
];

// ── Helpers ───────────────────────────────────────────────────────
let mockDb: any;
let mockGetCatalogo: any;

function setupMocks() {
  mockDb = { collection: vi.fn(), doc: vi.fn() };

  mockGetCatalogo = vi.fn().mockResolvedValue(MOCK_CATALOGO);

  Module._cache[firestorePath] = { exports: mockDb, loaded: true } as any;
  Module._cache[productosRepoPath] = {
    exports: { getCatalogo: mockGetCatalogo },
    loaded: true,
  } as any;
}

function loadLoader() {
  const loaderPath = path.resolve(projectRoot, "src/catalog/loader.js");
  delete Module._cache[loaderPath];
  return require("../../../src/catalog/loader");
}

// ── Tests ─────────────────────────────────────────────────────────
describe("catalog/loader", () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    delete Module._cache[firestorePath];
    delete Module._cache[productosRepoPath];
    const loaderPath = path.resolve(projectRoot, "src/catalog/loader.js");
    delete Module._cache[loaderPath];
    vi.restoreAllMocks();
  });

  // ── init ──────────────────────────────────────────────────────────
  describe("init", () => {
    it("loads catalog and builds all maps", async () => {
      const loader = loadLoader();
      await loader.init();

      expect(mockGetCatalogo).toHaveBeenCalled();
      expect(loader.getCatalog().size).toBe(24);
    });

    it("exits process on Firestore error (fail-fast)", async () => {
      mockGetCatalogo.mockRejectedValueOnce(new Error("Firestore unavailable"));
      const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process.exit called");
      }) as any);

      const loader = loadLoader();
      await expect(loader.init()).rejects.toThrow("process.exit called");

      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
    });
  });

  // ── equivalencias ─────────────────────────────────────────────────
  describe("getEquivalencias", () => {
    it("builds 53 equivalencia entries from sinonimos", async () => {
      const loader = loadLoader();
      await loader.init();

      const eq = loader.getEquivalencias();
      expect(eq.size).toBe(53);
    });

    it("resolves normalized key to canonical product name", async () => {
      const loader = loadLoader();
      await loader.init();

      const eq = loader.getEquivalencias();
      expect(eq.get("aji grande")).toBe("Aji * 100");
    });

    it("resolves 'ajo polvo' to 'Ajo en polvo * 50'", async () => {
      const loader = loadLoader();
      await loader.init();

      const eq = loader.getEquivalencias();
      expect(eq.get("ajo polvo")).toBe("Ajo en polvo * 50");
    });

    it("resolves typo canonical 'canela molida 100' correctly", async () => {
      const loader = loadLoader();
      await loader.init();

      const eq = loader.getEquivalencias();
      expect(eq.get("canela molida 100")).toBe("Canela molidad * 100");
    });
  });

  // ── getCategoria ──────────────────────────────────────────────────
  describe("getCategoria", () => {
    it("returns category for known product", async () => {
      const loader = loadLoader();
      await loader.init();

      expect(loader.getCategoria("Ajo en polvo * 50")).toBe("Ajo_en_polvo");
    });

    it("returns null for unknown product", async () => {
      const loader = loadLoader();
      await loader.init();

      expect(loader.getCategoria("Nonexistent Product")).toBeNull();
    });
  });

  // ── getFuseIndex ──────────────────────────────────────────────────
  describe("getFuseIndex", () => {
    it("returns a Fuse instance with search capability", async () => {
      const loader = loadLoader();
      await loader.init();

      const fuse = loader.getFuseIndex();
      expect(fuse).toBeDefined();
      expect(typeof fuse.search).toBe("function");
    });

    it("search returns results with numeric scores (includeScore: true)", async () => {
      const loader = loadLoader();
      await loader.init();

      const fuse = loader.getFuseIndex();
      const results = fuse.search("aji");
      expect(results.length).toBeGreaterThan(0);
      expect(typeof results[0].score).toBe("number");
    });
  });

  // ── refresh ───────────────────────────────────────────────────────
  describe("refresh", () => {
    it("swaps catalog atomically with new data", async () => {
      const loader = loadLoader();
      await loader.init();

      const eqBefore = loader.getEquivalencias();
      const sizeBefore = eqBefore.size;

      // Build updated data: add "nuevo sintesis" synonym ONLY to Clavo * 100
      const updatedCatalogo = MOCK_CATALOGO.map((p) => {
        if (p.nombre === "Clavo * 100") {
          return { ...p, sinonimos: [...p.sinonimos, "nuevo sintesis"] };
        }
        return { ...p };
      });
      mockGetCatalogo.mockResolvedValue(updatedCatalogo);

      const result = await loader.refresh();
      const eqAfter = loader.getEquivalencias();

      expect(eqAfter.size).toBe(sizeBefore + 1);
      expect(eqAfter.get("nuevo sintesis")).toBe("Clavo * 100");
      expect(result.productos).toBe(24);
    });

    it("keeps previous cache if refresh fails", async () => {
      const loader = loadLoader();
      await loader.init();

      const eqBefore = loader.getEquivalencias();

      mockGetCatalogo.mockRejectedValueOnce(new Error("Firestore down"));

      await expect(loader.refresh()).rejects.toThrow();

      // Previous cache still active
      const eqAfter = loader.getEquivalencias();
      expect(eqAfter.size).toBe(eqBefore.size);
    });
  });
});
