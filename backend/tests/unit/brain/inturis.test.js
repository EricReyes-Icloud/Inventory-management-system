// backend/tests/unit/brain/inturis.test.js
// Unit suite for interpretarPedido — catalog-driven interpretation (task 3.1).
//
// The catalog-loader singleton is mocked via Module._cache (firestore +
// productos.repository stubs), exactly like tests/unit/catalog/loader.test.ts.
// normalizarTexto is the REAL module — loaded through the real require chain
// (inturis -> catalog/loader -> utils/normalizarTexto).
//
// Two scenarios were MOVED here from tests/unit/catalog/loader.test.ts
// ("numerosPalabras — 'un' mapping" block): they exercise interpretarPedido
// behavior and are represented exactly once, in this file.

const Module = require("module");
const path = require("path");

const projectRoot = path.resolve(__dirname, "../../..");
const firestorePath = path.resolve(projectRoot, "src/lib/firestore.js");
const productosRepoPath = path.resolve(
  projectRoot,
  "src/repositories/productos.repository.js"
);

// ── Catalog mock data — mirrors real Firestore structure ───────────
// 24 products, 53 equivalencias (each sinonimo = 1 entry), 11 categories.
// Same fixture as tests/unit/catalog/loader.test.ts.
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
  // ── Miel family (6 products) ──
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
let mockGetCatalogo;

function setupMocks() {
  mockGetCatalogo = vi.fn().mockResolvedValue(MOCK_CATALOGO);

  Module._cache[firestorePath] = { exports: {}, loaded: true };
  Module._cache[productosRepoPath] = {
    exports: { getCatalogo: mockGetCatalogo },
    loaded: true,
  };
}

function loadInturis() {
  const loaderPath = path.resolve(projectRoot, "src/catalog/loader.js");
  const inturisPath = path.resolve(projectRoot, "src/brain/inturis.js");
  delete Module._cache[loaderPath];
  delete Module._cache[inturisPath];
  return require("../../../src/brain/inturis");
}

// Loads the real inturis module, boots the loader singleton against the
// mocked repository, then interprets the order.
async function interpretar(pedido) {
  const { interpretarPedido } = loadInturis();
  const loader = require("../../../src/catalog/loader");
  await loader.init();
  return interpretarPedido(pedido);
}

const NO_IDENTIFICADO_CONTRACT = {
  producto: "No identificado",
  cantidad: 1,
  confianza: 0,
  sugerencias: [],
};

// ── Tests ──────────────────────────────────────────────────────────
describe("interpretarPedido", () => {
  beforeEach(() => {
    setupMocks();
    // interpretarPedido / catalog-loader log to console for the Twilio flow;
    // silence that noise — assertions never depend on console output.
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    delete Module._cache[firestorePath];
    delete Module._cache[productosRepoPath];
    const loaderPath = path.resolve(projectRoot, "src/catalog/loader.js");
    const inturisPath = path.resolve(projectRoot, "src/brain/inturis.js");
    delete Module._cache[loaderPath];
    delete Module._cache[inturisPath];
    vi.restoreAllMocks();
  });

  // ── Exact equivalencia match (primary path) ─────────────────────
  describe("exact equivalencia match", () => {
    it("'clavo grande' resolves to Clavo * 100 with confidence 1", async () => {
      const result = await interpretar("clavo grande");
      expect(result).toEqual([
        { producto: "Clavo * 100", cantidad: 1, confianza: 1, sugerencias: [] },
      ]);
    });

    it("'ajies grandes' resolves to Aji * 100 (plural rule maps 'ajies' → 'aji')", async () => {
      const result = await interpretar("ajies grandes");
      expect(result).toEqual([
        { producto: "Aji * 100", cantidad: 1, confianza: 1, sugerencias: [] },
      ]);
    });

    it("'ajo polvo' resolves to Ajo en polvo * 50", async () => {
      const result = await interpretar("ajo polvo");
      expect(result).toEqual([
        { producto: "Ajo en polvo * 50", cantidad: 1, confianza: 1, sugerencias: [] },
      ]);
    });

    it("'frasco miel' resolves to Frasco de miel", async () => {
      const result = await interpretar("frasco miel");
      expect(result).toEqual([
        { producto: "Frasco de miel", cantidad: 1, confianza: 1, sugerencias: [] },
      ]);
    });

    it("'canela en rama' resolves to Canela * 50 mediana", async () => {
      const result = await interpretar("canela en rama");
      expect(result).toEqual([
        { producto: "Canela * 50 mediana", cantidad: 1, confianza: 1, sugerencias: [] },
      ]);
    });

    it("'miel jumbo' resolves to Miel jumbo * 50 (R-INTERPRETAR scenario)", async () => {
      const result = await interpretar("miel jumbo");
      expect(result).toEqual([
        { producto: "Miel jumbo * 50", cantidad: 1, confianza: 1, sugerencias: [] },
      ]);
    });
  });

  // ── "un" token → quantity 1 (MOVED from loader.test.ts) ─────────
  describe("numerosPalabras — 'un' mapping", () => {
    it("'un' is recognized as quantity 1", async () => {
      const result = await interpretar("un clavo grande");
      expect(result[0].cantidad).toBe(1);
      expect(result[0].producto).toBe("Clavo * 100");
    });

    it("'un aji grande' resolves to Aji * 100 with quantity 1", async () => {
      const result = await interpretar("un aji grande");
      expect(result[0].cantidad).toBe(1);
      expect(result[0].producto).toBe("Aji * 100");
    });

    it("'una' is also recognized as quantity 1 ('una frasco')", async () => {
      const result = await interpretar("una frasco");
      expect(result).toEqual([
        { producto: "Frasco de miel", cantidad: 1, confianza: 1, sugerencias: [] },
      ]);
    });
  });

  // ── Numeric quantities (digits and number words) ────────────────
  describe("numeric quantities", () => {
    it("'dos clavos' resolves to 2 x Clavo * 100 (word number + plural rule)", async () => {
      const result = await interpretar("dos clavos");
      expect(result).toEqual([
        { producto: "Clavo * 100", cantidad: 2, confianza: 1, sugerencias: [] },
      ]);
    });

    it("'5 miel pequena' resolves to 5 x Miel * 50", async () => {
      const result = await interpretar("5 miel pequena");
      expect(result).toEqual([
        { producto: "Miel * 50", cantidad: 5, confianza: 1, sugerencias: [] },
      ]);
    });

    it("'tres salsina' resolves to 3 x Salsina * 50", async () => {
      const result = await interpretar("tres salsina");
      expect(result).toEqual([
        { producto: "Salsina * 50", cantidad: 3, confianza: 1, sugerencias: [] },
      ]);
    });

    it("'diez miel jumbo' resolves to 10 x Miel jumbo * 50", async () => {
      const result = await interpretar("diez miel jumbo");
      expect(result).toEqual([
        { producto: "Miel jumbo * 50", cantidad: 10, confianza: 1, sugerencias: [] },
      ]);
    });

    it("quantity 0 is coerced to 1 ('0 clavo' → 1 x Clavo * 100)", async () => {
      const result = await interpretar("0 clavo");
      expect(result).toEqual([
        { producto: "Clavo * 100", cantidad: 1, confianza: 1, sugerencias: [] },
      ]);
    });
  });

  // ── Multi-item orders ────────────────────────────────────────────
  describe("multi-item orders", () => {
    it("'clavo grande, 2 aji' returns both items with their quantities", async () => {
      const result = await interpretar("clavo grande, 2 aji");
      expect(result).toEqual([
        { producto: "Clavo * 100", cantidad: 1, confianza: 1, sugerencias: [] },
        { producto: "Aji * 100", cantidad: 2, confianza: 1, sugerencias: [] },
      ]);
    });

    it("'2 aji y 3 clavo' splits on 'y' and returns both items", async () => {
      const result = await interpretar("2 aji y 3 clavo");
      expect(result).toEqual([
        { producto: "Aji * 100", cantidad: 2, confianza: 1, sugerencias: [] },
        { producto: "Clavo * 100", cantidad: 3, confianza: 1, sugerencias: [] },
      ]);
    });
  });

  // ── Fuse fuzzy fallback (score < 0.8 accepted) ──────────────────
  describe("Fuse fallback (score < 0.8)", () => {
    it("'media botella miel' resolves via Fuse with confidence < 1 (spec scenario)", async () => {
      const result = await interpretar("media botella miel");
      expect(result).toHaveLength(1);
      expect(result[0].producto).toBe("Media botella miel");
      expect(result[0].cantidad).toBe(1);
      // includeScore path ran: confidence is a real score-derived value
      expect(result[0].confianza).toBeGreaterThan(0);
      expect(result[0].confianza).toBeLessThan(1);
      expect(result[0].sugerencias).toEqual([]);
    });

    it("typo 'salsin' resolves via Fuse to Salsina * 50 with confidence < 1", async () => {
      const result = await interpretar("salsin");
      expect(result).toHaveLength(1);
      expect(result[0].producto).toBe("Salsina * 50");
      expect(result[0].cantidad).toBe(1);
      expect(result[0].confianza).toBeGreaterThan(0);
      expect(result[0].confianza).toBeLessThan(1);
      expect(result[0].sugerencias).toEqual([]);
    });
  });

  // ── Typo canonical name (historical orders depend on it) ────────
  describe("typo canonical name", () => {
    it("'canela molida grande' resolves to the typo-canonical 'Canela molidad * 100'", async () => {
      const result = await interpretar("canela molida grande");
      expect(result).toEqual([
        { producto: "Canela molidad * 100", cantidad: 1, confianza: 1, sugerencias: [] },
      ]);
    });
  });

  // ── 'de' → '*' business rule via real normalizarTexto ────────────
  describe("'de' handling in normalizarTexto", () => {
    it("'botella de miel' resolves to Media botella miel ('de' → '*')", async () => {
      const result = await interpretar("botella de miel");
      expect(result).toEqual([
        { producto: "Media botella miel", cantidad: 1, confianza: 1, sugerencias: [] },
      ]);
    });
  });

  // ── Unrecognized input → "No identificado" ───────────────────────
  describe("No identificado", () => {
    it("'xyz abc' returns No identificado with the full contract", async () => {
      const result = await interpretar("xyz abc");
      expect(result).toEqual([{ ...NO_IDENTIFICADO_CONTRACT }]);
    });

    it("'vvv www' returns No identificado (second distinct unrecognized input)", async () => {
      const result = await interpretar("vvv www");
      expect(result).toEqual([{ ...NO_IDENTIFICADO_CONTRACT }]);
    });

    it("multiple unrecognized parts each yield their own No identificado entry", async () => {
      const result = await interpretar("xyz abc, vvv www");
      expect(result).toEqual([
        { ...NO_IDENTIFICADO_CONTRACT },
        { ...NO_IDENTIFICADO_CONTRACT },
      ]);
    });
  });
});