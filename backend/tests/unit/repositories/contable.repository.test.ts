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

let mockDb: any;
let mockDocRef: any;
let contableRepo: any;

beforeEach(() => {
  mockDocRef = {
    get: vi.fn(),
    set: vi.fn(),
    collection: vi.fn(() => ({
      get: vi.fn(),
      doc: vi.fn(() => mockDocRef),
    })),
  };

  mockDb = {
    collection: vi.fn(() => ({
      get: vi.fn(),
      doc: vi.fn(() => mockDocRef),
    })),
    doc: vi.fn(() => mockDocRef),
    _mockDocRef: mockDocRef,
  };

  Module._cache[firestorePath] = {
    exports: mockDb,
    loaded: true,
  } as any;

  const repoPath = path.resolve(projectRoot, "src/repositories/contable.repository.js");
  delete Module._cache[repoPath];

  contableRepo = require("../../../src/repositories/contable.repository");
});

afterEach(() => {
  delete Module._cache[firestorePath];
  vi.restoreAllMocks();
});

describe("contable.repository", () => {
  // ──────────────────────────────────────────────
  // getInvertir
  // ──────────────────────────────────────────────

  describe("getInvertir", () => {
    it("retorna el documento cuando existe", async () => {
      const fakeDoc = {
        id: "Test",
        exists: true,
        data: () => ({ margen: 30 }),
      };

      mockDb.collection = vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(fakeDoc),
        })),
      }));

      const result = await contableRepo.getInvertir("Test");
      expect(result).not.toBeNull();
      expect(result!.data().margen).toBe(30);
    });

    it("retorna null cuando el documento no existe", async () => {
      const fakeDoc = { id: "NoExiste", exists: false, data: () => ({}) };

      mockDb.collection = vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(fakeDoc),
        })),
      }));

      const result = await contableRepo.getInvertir("NoExiste");
      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  // getCostosFijos
  // ──────────────────────────────────────────────

  describe("getCostosFijos", () => {
    it("retorna el documento de costos fijos cuando existe", async () => {
      const fakeDoc = {
        id: "costos_fijos",
        exists: true,
        data: () => ({ alquiler: 500, sueldos: 1000 }),
      };

      const mockCostosFijosDoc = { get: vi.fn().mockResolvedValue(fakeDoc) };
      const mockCostosFijosCol = { doc: vi.fn(() => mockCostosFijosDoc) };
      const mockCatDoc = { collection: vi.fn(() => mockCostosFijosCol) };
      const mockCatCol = { doc: vi.fn(() => mockCatDoc) };

      mockDb.collection = vi.fn(() => mockCatCol);

      const result = await contableRepo.getCostosFijos("Test");
      expect(result).not.toBeNull();
      expect(result!.data().alquiler).toBe(500);
    });

    it("retorna null cuando no existen costos fijos", async () => {
      const fakeDoc = { id: "costos_fijos", exists: false, data: () => ({}) };

      const mockCostosFijosDoc = { get: vi.fn().mockResolvedValue(fakeDoc) };
      const mockCostosFijosCol = { doc: vi.fn(() => mockCostosFijosDoc) };
      const mockCatDoc = { collection: vi.fn(() => mockCostosFijosCol) };
      const mockCatCol = { doc: vi.fn(() => mockCatDoc) };

      mockDb.collection = vi.fn(() => mockCatCol);

      const result = await contableRepo.getCostosFijos("NoExiste");
      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  // getCostosVariables
  // ──────────────────────────────────────────────

  describe("getCostosVariables", () => {
    it("retorna el documento de costos variables cuando existe", async () => {
      const fakeDoc = {
        id: "costos_variables",
        exists: true,
        data: () => ({ frascos: 200, etiquetas: 50 }),
      };

      mockDb.collection = vi.fn(() => ({
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue(fakeDoc),
            })),
          })),
        })),
      }));

      const result = await contableRepo.getCostosVariables("Test");
      expect(result).not.toBeNull();
      expect(result!.data().frascos).toBe(200);
    });
  });

  // ──────────────────────────────────────────────
  // getCostosVariablesPorProducto
  // ──────────────────────────────────────────────

  describe("getCostosVariablesPorProducto", () => {
    it("retorna el documento de costos variables por producto cuando existe", async () => {
      const fakeDoc = {
        id: "Frascos",
        exists: true,
        data: () => ({ tapa: 30, cuerpo: 80 }),
      };

      mockDb.collection = vi.fn(() => ({
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue(fakeDoc),
            })),
          })),
        })),
      }));

      const result = await contableRepo.getCostosVariablesPorProducto("Miel", "Frascos");
      expect(result).not.toBeNull();
      expect(result!.data().tapa).toBe(30);
    });

    it("retorna null cuando el producto no tiene costos variables", async () => {
      const fakeDoc = { id: "Inexistente", exists: false, data: () => ({}) };

      mockDb.collection = vi.fn(() => ({
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue(fakeDoc),
            })),
          })),
        })),
      }));

      const result = await contableRepo.getCostosVariablesPorProducto("Miel", "Inexistente");
      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  // getGanancias
  // ──────────────────────────────────────────────

  describe("getGanancias", () => {
    it("retorna el documento cuando existe", async () => {
      const fakeDoc = {
        id: "Enero 2026",
        exists: true,
        data: () => ({ Test: { gananciaNeta: 5000 } }),
      };

      mockDb.collection = vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(fakeDoc),
        })),
      }));

      const result = await contableRepo.getGanancias("Enero 2026");
      expect(result).not.toBeNull();
      expect(result!.data().Test.gananciaNeta).toBe(5000);
    });

    it("retorna null cuando no existe", async () => {
      const fakeDoc = { id: "NoExiste", exists: false, data: () => ({}) };

      mockDb.collection = vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(fakeDoc),
        })),
      }));

      const result = await contableRepo.getGanancias("NoExiste");
      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  // setGanancias
  // ──────────────────────────────────────────────

  describe("setGanancias", () => {
    it("llama a set con merge en Ganancias/{mesAnio}", async () => {
      const mockSet = vi.fn().mockResolvedValue({});
      const mockDoc = { set: mockSet };

      mockDb.collection = vi.fn(() => ({
        doc: vi.fn(() => mockDoc),
      }));

      const data = { Test: { gananciaNeta: 5000 } };
      await contableRepo.setGanancias("Enero 2026", data);

      expect(mockSet).toHaveBeenCalledWith(data, { merge: true });
      expect(mockDb.collection).toHaveBeenCalledWith("Ganancias");
    });
  });

  // ──────────────────────────────────────────────
  // setHistoricoCompras
  // ──────────────────────────────────────────────

  describe("setHistoricoCompras", () => {
    it("llama a set con merge en Invertir/{categoria}/historico_compras/{mesAnio}", async () => {
      const mockSet = vi.fn().mockResolvedValue({});
      const mockDoc = { set: mockSet };

      mockDb.collection = vi.fn(() => ({
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({
            doc: vi.fn(() => mockDoc),
          })),
        })),
      }));

      const data = { frascos: 200, fechaCierre: new Date() };
      await contableRepo.setHistoricoCompras("Test", "Enero 2026", data);

      expect(mockSet).toHaveBeenCalledWith(data, { merge: true });
    });
  });

  // ──────────────────────────────────────────────
  // setCostosVariablePorProducto
  // ──────────────────────────────────────────────

  describe("setCostosVariablePorProducto", () => {
    it("llama a set con merge en Invertir/{categoria}/costos_variables/{producto}", async () => {
      const mockSet = vi.fn().mockResolvedValue({});
      const mockDoc = { set: mockSet };

      mockDb.collection = vi.fn(() => ({
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({
            doc: vi.fn(() => mockDoc),
          })),
        })),
      }));

      const data = { tapa: 30, cuerpo: 80 };
      await contableRepo.setCostosVariablePorProducto("Miel", "Frascos", data);

      expect(mockSet).toHaveBeenCalledWith(data, { merge: true });
    });
  });

  // ──────────────────────────────────────────────
  // resetCostosVariables
  // ──────────────────────────────────────────────

  describe("resetCostosVariables", () => {
    it("lee costos_variables, construye zero-map y escribe con merge", async () => {
      const mockSet = vi.fn().mockResolvedValue({});
      const mockCostosVarDoc = {
        get: vi.fn(),
        set: mockSet,
      };

      const existingData = { frascos: 200, etiquetas: 50, nombre: "texto" };
      const fakeSnap = {
        exists: true,
        data: () => existingData,
      };

      mockCostosVarDoc.get.mockResolvedValue(fakeSnap);

      // Chain: db.collection("Invertir").doc(categoria).collection("costos_variables").doc("costos_variables")
      mockDb.collection = vi.fn(() => ({
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({
            doc: vi.fn(() => mockCostosVarDoc),
          })),
        })),
      }));

      await contableRepo.resetCostosVariables("Test");

      expect(mockSet).toHaveBeenCalledWith(
        { frascos: 0, etiquetas: 0 },
        { merge: true }
      );
    });

    it("no escribe si el documento no existe", async () => {
      const mockSet = vi.fn();
      const fakeSnap = { exists: false, data: () => ({}) };

      const mockCostosVarDoc = {
        get: vi.fn().mockResolvedValue(fakeSnap),
        set: mockSet,
      };

      mockDb.collection = vi.fn(() => ({
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({
            doc: vi.fn(() => mockCostosVarDoc),
          })),
        })),
      }));

      await expect(contableRepo.resetCostosVariables("Test")).resolves.toBeUndefined();
      expect(mockSet).not.toHaveBeenCalled();
    });

    it("no escribe si no hay campos numéricos", async () => {
      const mockSet = vi.fn();
      const existingData = { nombre: "texto", activo: true };
      const fakeSnap = { exists: true, data: () => existingData };

      const mockCostosVarDoc = {
        get: vi.fn().mockResolvedValue(fakeSnap),
        set: mockSet,
      };

      mockDb.collection = vi.fn(() => ({
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({
            doc: vi.fn(() => mockCostosVarDoc),
          })),
        })),
      }));

      await contableRepo.resetCostosVariables("Test");

      expect(mockSet).not.toHaveBeenCalled();
    });
  });
});
