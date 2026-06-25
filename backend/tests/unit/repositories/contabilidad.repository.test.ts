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
});
