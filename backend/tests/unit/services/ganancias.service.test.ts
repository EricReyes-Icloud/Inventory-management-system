import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Module from "module";
import path from "path";

declare module "module" {
  interface Module {
    _cache: Record<string, NodeModule | undefined>;
  }
}

import { getBackendRoot } from "../../helpers/paths";

const projectRoot = getBackendRoot();

// Mock repository functions
const mockGetHistoricoMensual = vi.fn();
const mockGetCostosFijos = vi.fn();
const mockGetCostosVariables = vi.fn();
const mockGetCostosVariablesPorProducto = vi.fn();
const mockGetGanancias = vi.fn();
const mockSetGanancias = vi.fn();
const mockSetHistoricoCompras = vi.fn();
const mockResetCostosVariables = vi.fn();

let gananciasService: any;

beforeEach(() => {
  // Reset mocks
  mockGetHistoricoMensual.mockReset();
  mockGetCostosFijos.mockReset();
  mockGetCostosVariables.mockReset();
  mockGetCostosVariablesPorProducto.mockReset();
  mockGetGanancias.mockReset();
  mockSetGanancias.mockReset();
  mockSetHistoricoCompras.mockReset();
  mockResetCostosVariables.mockReset();

  // Mock contabilidad.repository
  const contabilidadRepoPath = path.resolve(
    projectRoot,
    "src/repositories/contabilidad.repository.js"
  );
  Module._cache[contabilidadRepoPath] = {
    exports: {
      getHistoricoMensual: mockGetHistoricoMensual,
      getTotalProductos: vi.fn(),
      getCartonesVendidos: vi.fn(),
      getCategoriaTotal: vi.fn(),
      getCategoriaCartones: vi.fn(),
      getCategoriasTotalProductos: vi.fn(),
      getSkusTotalProductos: vi.fn(),
      getCategoriasCartonesVendidos: vi.fn(),
      getSkusCartonesVendidos: vi.fn(),
      setHistoricoMensual: vi.fn(),
      buildOperacionesContables: vi.fn(),
    },
    loaded: true,
  } as any;

  // Mock contable.repository
  const contableRepoPath = path.resolve(
    projectRoot,
    "src/repositories/contable.repository.js"
  );
  Module._cache[contableRepoPath] = {
    exports: {
      getInvertir: vi.fn(),
      getCostosFijos: mockGetCostosFijos,
      getCostosVariables: mockGetCostosVariables,
      getCostosVariablesPorProducto: mockGetCostosVariablesPorProducto,
      getGanancias: mockGetGanancias,
      setGanancias: mockSetGanancias,
      setHistoricoCompras: mockSetHistoricoCompras,
      resetCostosVariables: mockResetCostosVariables,
      setCostosVariablePorProducto: vi.fn(),
    },
    loaded: true,
  } as any;

  // Clear ganancias service cache
  const gananciasServicePath = path.resolve(
    projectRoot,
    "src/services/ganancias.service.js"
  );
  delete Module._cache[gananciasServicePath];

  gananciasService = require("../../../src/services/ganancias.service");
});

afterEach(() => {
  vi.restoreAllMocks();
  const modules = [
    "src/repositories/contabilidad.repository.js",
    "src/repositories/contable.repository.js",
    "src/services/ganancias.service.js",
  ];
  for (const mod of modules) {
    const p = path.resolve(projectRoot, mod);
    delete Module._cache[p];
  }
});

// ──────────────────────────────────────────────
// Helper to create a valid historico snapshot
// ──────────────────────────────────────────────

function buildHistoricoSnap(totalProductos: any, cartonesVendidos: any) {
  return {
    exists: true,
    data: () => ({
      totalProductos,
      cartonesVendidos,
    }),
  };
}

describe("ganancias.service", () => {
  describe("cerrarGananciasPorCategoria", () => {
    // ──────────────────────────────────────────
    // Zero ventas throws
    // ──────────────────────────────────────────

    it("lanza error si las ventas son cero", async () => {
      const historicoSnap = buildHistoricoSnap(
        { Test: { total: 0 } },
        { Test: { total: 10 } }
      );
      mockGetHistoricoMensual.mockResolvedValue(historicoSnap);

      await expect(
        gananciasService.cerrarGananciasPorCategoria({
          mesAnio: "Enero 2026",
          categoria: "Test",
        })
      ).rejects.toThrow("Ventas en cero para Test");
    });

    // ──────────────────────────────────────────
    // Non-Miel: missing costos_variables throws
    // ──────────────────────────────────────────

    it("lanza error si no existen costos variables para categoria normal", async () => {
      const historicoSnap = buildHistoricoSnap(
        { Test: { total: 5000 } },
        { Test: { total: 50 } }
      );

      mockGetHistoricoMensual.mockResolvedValue(historicoSnap);
      mockGetCostosFijos.mockResolvedValue({
        exists: true,
        data: () => ({ alquiler: 30, sueldos: 20 }),
      });
      mockGetCostosVariables.mockResolvedValue(null); // no existe

      await expect(
        gananciasService.cerrarGananciasPorCategoria({
          mesAnio: "Enero 2026",
          categoria: "Test",
        })
      ).rejects.toThrow("No existen costos variables para Test");
    });

    // ──────────────────────────────────────────
    // Non-Miel: valid costs → calculates correctly
    // ──────────────────────────────────────────

    it("calcula ganancias correctamente para categoria normal con costos validos", async () => {
      const historicoSnap = buildHistoricoSnap(
        { Test: { total: 10000 } },
        { Test: { total: 100 } }
      );

      mockGetHistoricoMensual.mockResolvedValue(historicoSnap);
      // Fixed costs: 30 + 20 = 50
      mockGetCostosFijos.mockResolvedValue({
        exists: true,
        data: () => ({ alquiler: 30, sueldos: 20 }),
      });
      // Variable costs: 10 + 5 = 15
      mockGetCostosVariables.mockResolvedValue({
        exists: true,
        data: () => ({ envase: 10, etiqueta: 5 }),
      });

      const result = await gananciasService.cerrarGananciasPorCategoria({
        mesAnio: "Enero 2026",
        categoria: "Test",
      });

      // ventaTotal = 10000, cartones = 100
      // costosFijosUnit = 50, costosVariablesUnit = 15
      // inversionTotal = fijos*cartones + variables = 50*100 + 15 = 5015
      // gananciaNeta = 10000 - 5015 = 4985
      expect(result.ventaTotal).toBe(10000);
      expect(result.cartones).toBe(100);
      expect(result.costosFijosUnit).toBe(50);
      expect(result.costosVariablesUnit).toBe(15);
      expect(result.inversionTotal).toBe(5015);
      expect(result.gananciaNeta).toBe(4985);
      expect(result.estado).toBe("cerrado");

      // Verify writes
      expect(mockSetGanancias).toHaveBeenCalledOnce();
      expect(mockSetHistoricoCompras).toHaveBeenCalledOnce();
      expect(mockResetCostosVariables).toHaveBeenCalledWith("Test");
    });

    // ──────────────────────────────────────────
    // Miel: missing costos_variables for product throws
    // ──────────────────────────────────────────

    it("lanza error si falta costos_variables para un producto de Miel", async () => {
      const historicoSnap = buildHistoricoSnap(
        {
          Miel: {
            total: 8000,
            productos: {
              Frascos: { total: 5000, cartones: 50 },
              Botellas: { total: 3000, cartones: 30 },
            },
          },
        },
        { Miel: { total: 80 } }
      );

      mockGetHistoricoMensual.mockResolvedValue(historicoSnap);
      mockGetCostosFijos.mockResolvedValue({
        exists: true,
        data: () => ({ procesamiento: 40 }),
      });
      // Frascos has variable costs, Botellas doesn't
      mockGetCostosVariablesPorProducto
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ tapa: 20, cuerpo: 30 }),
        })
        .mockResolvedValueOnce(null); // Botellas missing

      await expect(
        gananciasService.cerrarGananciasPorCategoria({
          mesAnio: "Enero 2026",
          categoria: "Miel",
        })
      ).rejects.toThrow(
        "No existen costos variables para Botellas en categoria Miel"
      );
    });

    // ──────────────────────────────────────────
    // Miel: all costs present → calculates correctly
    // ──────────────────────────────────────────

    it("calcula ganancias correctamente para Miel con todos los costos presentes", async () => {
      const historicoSnap = buildHistoricoSnap(
        {
          Miel: {
            total: 15000,
            productos: {
              Frascos: { total: 8000, cartones: 80 },
              Botellas: { total: 5000, cartones: 50 },
              Copas: { total: 2000, cartones: 20 },
            },
          },
        },
        { Miel: { total: 150 } }
      );

      mockGetHistoricoMensual.mockResolvedValue(historicoSnap);
      // Fixed costs: 40
      mockGetCostosFijos.mockResolvedValue({
        exists: true,
        data: () => ({ procesamiento: 40 }),
      });
      // Variable costs per product
      mockGetCostosVariablesPorProducto
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ tapa: 20, cuerpo: 30 }),
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ vidrio: 15 }),
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ base: 10 }),
        });

      const result = await gananciasService.cerrarGananciasPorCategoria({
        mesAnio: "Enero 2026",
        categoria: "Miel",
      });

      // ventaTotal = 15000, cartones = 150
      // costosFijosUnit = 40
      // Per-product formula: fijos*cartonesProducto + variables
      // Frascos: 40*80 + 50 = 3250
      // Botellas: 40*50 + 15 = 2015
      // Copas: 40*20 + 10 = 810
      // inversionTotal = 3250 + 2015 + 810 = 6075
      // gananciaNeta = 15000 - 6075 = 8925
      // costosVariablesUnit = 50 + 15 + 10 = 75
      expect(result.ventaTotal).toBe(15000);
      expect(result.cartones).toBe(150);
      expect(result.costosFijosUnit).toBe(40);
      expect(result.costosVariablesUnit).toBe(75);
      expect(result.inversionTotal).toBe(6075);
      expect(result.gananciaNeta).toBe(8925);
      expect(result.estado).toBe("cerrado");

      expect(mockSetGanancias).toHaveBeenCalledOnce();
      expect(mockSetHistoricoCompras).toHaveBeenCalledOnce();
      expect(mockResetCostosVariables).toHaveBeenCalledWith("Miel");
    });
  });

  // ──────────────────────────────────────────────
  // Export surface
  // ──────────────────────────────────────────────

  describe("exports", () => {
    it("exporta solo cerrarGananciasPorCategoria", () => {
      expect(gananciasService.cerrarGananciasPorCategoria).toBeDefined();
      expect(typeof gananciasService.cerrarGananciasPorCategoria).toBe("function");
    });

    it("no exporta calcularGananciasInterno", () => {
      expect((gananciasService as any).calcularGananciasInterno).toBeUndefined();
    });

    it("module.exports tiene exactamente una clave", () => {
      expect(Object.keys(gananciasService)).toEqual(["cerrarGananciasPorCategoria"]);
    });
  });
});
