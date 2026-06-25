import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Module from "module";
import path from "path";

declare module "module" {
  interface Module {
    _cache: Record<string, NodeModule | undefined>;
  }
}

const projectRoot = process.cwd();
const firestorePath = path.resolve(projectRoot, "src/lib/firestore.js");
const firebaseAdminPath = require.resolve("firebase-admin/firestore");
const fechasPath = path.resolve(projectRoot, "src/utils/fechas.js");
const repoPath = path.resolve(
  projectRoot,
  "src/repositories/contabilidad.repository.js"
);

let mockDb: any;
let mockBatch: any;
let mockDocRef: any;
let mockFieldValue: any;
let contabilidadRepo: any;

// ── Firestore test double builders ──

function buildMockDocRef(overrides = {}) {
  const ref: any = {
    get: vi.fn(),
    set: vi.fn(),
    ...overrides,
  };
  ref.collection = vi.fn(() => ({
    doc: vi.fn(() => ref),
    get: vi.fn(),
  }));
  return ref;
}

function buildMockDocSnap(exists: boolean, data: any) {
  return { exists, data: () => data, ref: {} };
}

function buildMockQuerySnap(docs: any[]) {
  return {
    docs,
    forEach: vi.fn((fn: any) => docs.forEach(fn)),
    size: docs.length,
    empty: docs.length === 0,
  };
}

function buildMockBatch(overrides = {}) {
  return {
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockDocRef = buildMockDocRef();
  mockBatch = buildMockBatch();
  mockFieldValue = {
    increment: vi.fn((v: number) => ({ __increment: v })),
    serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
  };

  mockDb = {
    doc: vi.fn(() => mockDocRef),
    batch: vi.fn(() => mockBatch),
    _mockDocRef: mockDocRef,
  };

  Module._cache[firestorePath] = { exports: mockDb, loaded: true } as any;
  Module._cache[firebaseAdminPath] = {
    exports: { FieldValue: mockFieldValue },
    loaded: true,
  } as any;
  Module._cache[fechasPath] = {
    exports: { obtenerMesAnio: vi.fn(() => "Enero 2026") },
    loaded: true,
  } as any;

  delete Module._cache[repoPath];

  contabilidadRepo = require("../../../src/repositories/contabilidad.repository");
});

afterEach(() => {
  delete Module._cache[firestorePath];
  delete Module._cache[firebaseAdminPath];
  delete Module._cache[fechasPath];
  delete Module._cache[repoPath];
  vi.restoreAllMocks();
});

describe("contabilidad.repository", () => {
  // ═══════════════════════════════════════════
  // obtenerCategoria — Pure Logic
  // ═══════════════════════════════════════════

  describe("obtenerCategoria", () => {
    it("returns category for matching SKU", () => {
      const result = contabilidadRepo.obtenerCategoria("Miel * 100");

      expect(result).toBe("Miel");
    });

    it("returns most specific (longest) match", () => {
      const result = contabilidadRepo.obtenerCategoria("Canela molida");

      expect(result).toBe("Canela_molida");
    });

    it("returns null when no match (with console.warn)", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = contabilidadRepo.obtenerCategoria(
        "Producto Sin Categoria"
      );

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        "⚠️ SKU sin categoría definida: Producto Sin Categoria"
      );
    });

    it("handles accented and uppercased names", () => {
      const result = contabilidadRepo.obtenerCategoria(
        "MIEL 100gr con acentos"
      );

      expect(result).toBe("Miel");
    });
  });

  // ═══════════════════════════════════════════
  // executeBatch
  // ═══════════════════════════════════════════

  describe("executeBatch", () => {
    it("writes all operations and commits", async () => {
      const ops = [
        {
          ref: "Total Productos/Enero 2026",
          data: { total: 100 },
          options: { merge: true },
        },
        {
          ref: "Cartones_vendidos/Enero 2026",
          data: { total: 5 },
          options: { merge: true },
        },
      ];

      await contabilidadRepo.executeBatch(ops);

      expect(mockBatch.set).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });

    it("propagates commit errors", async () => {
      const error = new Error("Firestore error");
      mockBatch.commit.mockRejectedValue(error);
      const ops = [{ ref: "test/path", data: {} }];

      await expect(contabilidadRepo.executeBatch(ops)).rejects.toThrow(
        "Firestore error"
      );
    });
  });

  // ═══════════════════════════════════════════
  // executeBatchWithUpdates
  // ═══════════════════════════════════════════

  describe("executeBatchWithUpdates", () => {
    it("applies sets and updates then commits", async () => {
      const sets = [
        { ref: "path/to/set", data: { a: 1 }, options: { merge: true } },
      ];
      const updates = [{ ref: "path/to/update", data: { b: 2 } }];

      await contabilidadRepo.executeBatchWithUpdates(sets, updates);

      expect(mockBatch.set).toHaveBeenCalledTimes(1);
      expect(mockBatch.update).toHaveBeenCalledTimes(1);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════
  // buildOperacionesContables — Batch Construction
  // ═══════════════════════════════════════════

  describe("buildOperacionesContables", () => {
    it("throws on empty or non-array items", () => {
      expect(() =>
        contabilidadRepo.buildOperacionesContables([], new Date())
      ).toThrow("Items inv\u00e1lidos para contabilidad");

      expect(() =>
        contabilidadRepo.buildOperacionesContables("string", new Date())
      ).toThrow("Items inv\u00e1lidos para contabilidad");
    });

    it("throws on invalid, undefined, or null fechaPedido", () => {
      const items = [
        { nombre: "Miel * 100", subtotal: 1500, cantidad: 5 },
      ];

      expect(() =>
        contabilidadRepo.buildOperacionesContables(items, "not-a-date")
      ).toThrow("fechaPedido inv\u00e1lida");

      expect(() =>
        contabilidadRepo.buildOperacionesContables(items, undefined)
      ).toThrow("fechaPedido inv\u00e1lida");

      expect(() =>
        contabilidadRepo.buildOperacionesContables(items, null)
      ).toThrow("fechaPedido inv\u00e1lida");
    });

    it("builds all 20 ops for 3 categorized items", () => {
      const items = [
        { nombre: "Miel * 100", subtotal: 1500, cantidad: 5 },
        { nombre: "Canela * 100 peque\u00f1a", subtotal: 2000, cantidad: 3 },
        { nombre: "Clavo * 100", subtotal: 800, cantidad: 2 },
      ];

      const result = contabilidadRepo.buildOperacionesContables(
        items,
        new Date("2026-01-15")
      );

      expect(result).toHaveLength(20);

      // First 2 ops are main document references
      expect(result[0].ref).toContain("Total Productos/Enero 2026");
      expect(result[1].ref).toContain("Cartones_vendidos/Enero 2026");

      // Every operation has data and merge: true
      result.forEach((op) => {
        expect(op).toHaveProperty("data");
        expect(op.options).toEqual({ merge: true });
      });
    });

    it("uses FieldValue.increment with correct values for totals", () => {
      const items = [
        { nombre: "Miel * 100", subtotal: 1500, cantidad: 5 },
      ];

      const result = contabilidadRepo.buildOperacionesContables(
        items,
        new Date("2026-01-15")
      );

      expect(result).toHaveLength(8);

      // ── Dinero (subtotal=1500) ──
      // Op 2: producto/Miel → data.total: increment(1500)
      expect(result[2].data.total).toEqual({ __increment: 1500 });
      // Op 3: producto/Miel/skus → data.total: increment(1500)
      expect(result[3].data.total).toEqual({ __increment: 1500 });
      // Op 4: Total Productos main → data.totalGeneral: increment(1500)
      expect(result[4].data.totalGeneral).toEqual({ __increment: 1500 });

      // ── Cartones (cantidad=5) ──
      // Op 5: cartones/producto/Miel → data.total: increment(5)
      expect(result[5].data.total).toEqual({ __increment: 5 });
      // Op 6: cartones/producto/Miel/skus → data.total: increment(5)
      expect(result[6].data.total).toEqual({ __increment: 5 });
      // Op 7: Cartones_vendidos main → data.totalGeneral: increment(5)
      expect(result[7].data.totalGeneral).toEqual({ __increment: 5 });
    });

    it("skips items without a matching category", () => {
      const items = [
        { nombre: "Miel * 100", subtotal: 1500, cantidad: 5 },
        { nombre: "Producto Inexistente", subtotal: 500, cantidad: 2 },
      ];

      const result = contabilidadRepo.buildOperacionesContables(
        items,
        new Date("2026-01-15")
      );

      // 2 main docs + 6 for Miel = 8 ops, no ops for uncategorized item
      expect(result).toHaveLength(8);

      // No operation references the uncategorized product
      result.forEach((op) => {
        expect(op.ref).not.toContain("Producto Inexistente");
      });
    });

    it("includes serverTimestamp on main document ops", () => {
      const items = [
        { nombre: "Miel * 100", subtotal: 1500, cantidad: 5 },
      ];

      const result = contabilidadRepo.buildOperacionesContables(
        items,
        new Date("2026-01-15")
      );

      // First 2 ops are main documents
      expect(result[0].data.actualizadoEn).toEqual({
        __serverTimestamp: true,
      });
      expect(result[1].data.actualizadoEn).toEqual({
        __serverTimestamp: true,
      });
    });
  });

  // ═══════════════════════════════════════════
  // limpiarCategoria — Category Cleanup
  // ═══════════════════════════════════════════

  describe("limpiarCategoria", () => {
    it("limpiarCategoriaTotal deletes SKUs and resets total", async () => {
      const skusDocs = [
        { ref: mockDocRef, data: () => ({ total: 100 }) },
        { ref: mockDocRef, data: () => ({ total: 50 }) },
      ];
      const mockSkusSnap = buildMockQuerySnap(skusDocs);

      // Override collection mock so .collection("skus").get() returns the snapshot
      mockDocRef.collection = vi.fn(() => ({
        doc: vi.fn(() => mockDocRef),
        get: vi.fn().mockResolvedValue(mockSkusSnap),
      }));

      await contabilidadRepo.limpiarCategoriaTotal("Enero 2026", "Miel");

      expect(mockBatch.delete).toHaveBeenCalledTimes(2);
      expect(mockBatch.set).toHaveBeenCalledWith(
        mockDocRef,
        { total: 0, actualizadoEn: expect.any(Date) },
        { merge: true }
      );
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });

    it("limpiarCategoriaTotal handles empty category", async () => {
      const mockEmptySnap = buildMockQuerySnap([]);

      mockDocRef.collection = vi.fn(() => ({
        doc: vi.fn(() => mockDocRef),
        get: vi.fn().mockResolvedValue(mockEmptySnap),
      }));

      await contabilidadRepo.limpiarCategoriaTotal("Enero 2026", "Miel");

      expect(mockBatch.delete).not.toHaveBeenCalled();
      expect(mockBatch.set).toHaveBeenCalledTimes(1);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });

    it("limpiarCategoriaCartones deletes SKUs and resets total", async () => {
      const skusDocs = [
        { ref: mockDocRef, data: () => ({ total: 100 }) },
        { ref: mockDocRef, data: () => ({ total: 50 }) },
      ];
      const mockSkusSnap = buildMockQuerySnap(skusDocs);

      mockDocRef.collection = vi.fn(() => ({
        doc: vi.fn(() => mockDocRef),
        get: vi.fn().mockResolvedValue(mockSkusSnap),
      }));

      await contabilidadRepo.limpiarCategoriaCartones("Enero 2026", "Miel");

      expect(mockBatch.delete).toHaveBeenCalledTimes(2);
      expect(mockBatch.set).toHaveBeenCalledWith(
        mockDocRef,
        { total: 0, actualizadoEn: expect.any(Date) },
        { merge: true }
      );
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });
  });
});
