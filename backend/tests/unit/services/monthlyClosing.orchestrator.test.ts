import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Module from "module";
import path from "path";

declare module "module" {
  interface Module {
    _cache: Record<string, NodeModule | undefined>;
  }
}

const projectRoot = process.cwd();

let orchestrator: any;

const adminMock = { uid: "admin-1", nombre: "Admin Test" };

// Mock dependencies
const mockProcessPendingOrders = vi.fn();
const mockGenerarHistoricoMensual = vi.fn();
const mockCerrarGananciasPorCategoria = vi.fn();
const mockRegistrarCierre = vi.fn();

beforeEach(() => {
  // Reset mocks
  mockProcessPendingOrders.mockReset();
  mockGenerarHistoricoMensual.mockReset();
  mockCerrarGananciasPorCategoria.mockReset();
  mockRegistrarCierre.mockReset();

  // Mock jobContableMensual
  const jobPath = path.resolve(projectRoot, "src/jobs/jobContableMensual.js");
  Module._cache[jobPath] = {
    exports: {
      processPendingOrders: mockProcessPendingOrders,
      default: mockProcessPendingOrders,
    },
    loaded: true,
  } as any;

  // Mock contabilidad.service
  const contabilidadPath = path.resolve(projectRoot, "src/services/contabilidad.service.js");
  Module._cache[contabilidadPath] = {
    exports: {
      generarHistoricoMensual: mockGenerarHistoricoMensual,
    },
    loaded: true,
  } as any;

  // Mock ganancias.service
  const gananciasPath = path.resolve(projectRoot, "src/services/ganancias.service.js");
  Module._cache[gananciasPath] = {
    exports: {
      cerrarGananciasPorCategoria: mockCerrarGananciasPorCategoria,
    },
    loaded: true,
  } as any;

  // Mock admin.actions.service
  const adminActionsPath = path.resolve(projectRoot, "src/services/admin.actions.service.js");
  Module._cache[adminActionsPath] = {
    exports: {
      registrarCierre: mockRegistrarCierre,
    },
    loaded: true,
  } as any;

  // Clear orchestrator cache and load fresh
  const orchPath = path.resolve(projectRoot, "src/services/monthlyClosing.orchestrator.js");
  delete Module._cache[orchPath];

  orchestrator = require("../../../src/services/monthlyClosing.orchestrator");
});

afterEach(() => {
  vi.restoreAllMocks();
  // Clean module cache for all mocked modules
  const modules = [
    "src/jobs/jobContableMensual.js",
    "src/services/contabilidad.service.js",
    "src/services/ganancias.service.js",
    "src/services/admin.actions.service.js",
    "src/services/monthlyClosing.orchestrator.js",
  ];
  for (const mod of modules) {
    const p = path.resolve(projectRoot, mod);
    delete Module._cache[p];
  }
});

describe("monthlyClosing.orchestrator", () => {
  // ──────────────────────────────────────────────
  // cerrarMes — Missing mesAnio
  // ──────────────────────────────────────────────

  describe("cerrarMes", () => {
    it("lanza error si mesAnio es undefined", async () => {
      await expect(orchestrator.cerrarMes(undefined, adminMock)).rejects.toThrow(
        "mesAnio es obligatorio"
      );
    });

    it("lanza error si mesAnio es null", async () => {
      await expect(orchestrator.cerrarMes(null, adminMock)).rejects.toThrow(
        "mesAnio es obligatorio"
      );
    });

    it("lanza error si mesAnio es string vacío", async () => {
      await expect(orchestrator.cerrarMes("", adminMock)).rejects.toThrow(
        "mesAnio es obligatorio"
      );
    });

    // ──────────────────────────────────────────────
    // Happy path — full pipeline
    // ──────────────────────────────────────────────

    it("ejecuta las 4 etapas en orden y retorna resultado", async () => {
      const fakeSnapshot = {
        totalProductos: {
          Test: { total: 1000 },
          Otra: { total: 2000 },
        },
        cartonesVendidos: {
          Test: { total: 10 },
          Otra: { total: 20 },
        },
      };

      mockProcessPendingOrders.mockResolvedValue({
        pedidosProcesados: 5,
        pedidosFallidos: 0,
      });
      mockGenerarHistoricoMensual.mockResolvedValue(fakeSnapshot);
      mockCerrarGananciasPorCategoria
        .mockResolvedValueOnce({ categoria: "Test", gananciaNeta: 500 })
        .mockResolvedValueOnce({ categoria: "Otra", gananciaNeta: 1000 });
      mockRegistrarCierre.mockResolvedValue(undefined);

      const result = await orchestrator.cerrarMes("Enero 2026", adminMock);

      // Verify stage order
      expect(mockProcessPendingOrders).toHaveBeenCalledOnce();
      expect(mockGenerarHistoricoMensual).toHaveBeenCalledWith("Enero 2026", "admin-1");
      expect(mockCerrarGananciasPorCategoria).toHaveBeenCalledTimes(2);
      expect(mockCerrarGananciasPorCategoria).toHaveBeenNthCalledWith(1, {
        mesAnio: "Enero 2026",
        categoria: "Test",
      });
      expect(mockCerrarGananciasPorCategoria).toHaveBeenNthCalledWith(2, {
        mesAnio: "Enero 2026",
        categoria: "Otra",
      });
      expect(mockRegistrarCierre).toHaveBeenCalledWith(
        "Enero 2026",
        adminMock,
        fakeSnapshot,
        [
          { categoria: "Test", gananciaNeta: 500 },
          { categoria: "Otra", gananciaNeta: 1000 },
        ]
      );

      // Verify return value
      expect(result).toEqual({
        mesAnio: "Enero 2026",
        snapshot: fakeSnapshot,
        ganancias: [
          { categoria: "Test", gananciaNeta: 500 },
          { categoria: "Otra", gananciaNeta: 1000 },
        ],
      });
    });

    // ──────────────────────────────────────────────
    // Error propagation — stage 2 fails
    // ──────────────────────────────────────────────

    it("si etapa 2 falla, etapas 3 y 4 no se ejecutan", async () => {
      mockProcessPendingOrders.mockResolvedValue({
        pedidosProcesados: 3,
        pedidosFallidos: 0,
      });
      mockGenerarHistoricoMensual.mockRejectedValue(
        new Error("El histórico ya fue generado")
      );

      await expect(
        orchestrator.cerrarMes("Enero 2026", adminMock)
      ).rejects.toThrow("Error en etapa 2 (generar histórico): El histórico ya fue generado");

      expect(mockProcessPendingOrders).toHaveBeenCalledOnce();
      expect(mockGenerarHistoricoMensual).toHaveBeenCalledOnce();
      expect(mockCerrarGananciasPorCategoria).not.toHaveBeenCalled();
      expect(mockRegistrarCierre).not.toHaveBeenCalled();
    });

    // ──────────────────────────────────────────────
    // Error propagation — stage 3 fails
    // ──────────────────────────────────────────────

    it("si etapa 3 falla, etapa 4 no se ejecuta", async () => {
      const fakeSnapshot = {
        totalProductos: { Test: { total: 1000 } },
        cartonesVendidos: { Test: { total: 10 } },
      };

      mockProcessPendingOrders.mockResolvedValue({
        pedidosProcesados: 2,
        pedidosFallidos: 0,
      });
      mockGenerarHistoricoMensual.mockResolvedValue(fakeSnapshot);
      mockCerrarGananciasPorCategoria.mockRejectedValue(
        new Error("No existen costos variables")
      );

      await expect(
        orchestrator.cerrarMes("Enero 2026", adminMock)
      ).rejects.toThrow("Error en etapa 3 (calcular ganancias): No existen costos variables");

      expect(mockProcessPendingOrders).toHaveBeenCalledOnce();
      expect(mockGenerarHistoricoMensual).toHaveBeenCalledOnce();
      expect(mockCerrarGananciasPorCategoria).toHaveBeenCalledOnce();
      expect(mockRegistrarCierre).not.toHaveBeenCalled();
    });

    // ──────────────────────────────────────────────
    // Idempotency — re-run completes
    // ──────────────────────────────────────────────

    it("re-ejecucion completa sin errores (idempotencia)", async () => {
      const fakeSnapshot = {
        totalProductos: { Test: { total: 1000 } },
        cartonesVendidos: { Test: { total: 10 } },
      };

      mockProcessPendingOrders.mockResolvedValue({
        pedidosProcesados: 0,
        pedidosFallidos: 0,
      });
      mockGenerarHistoricoMensual.mockResolvedValue(fakeSnapshot);
      mockCerrarGananciasPorCategoria.mockResolvedValue({
        categoria: "Test",
        gananciaNeta: 500,
      });
      mockRegistrarCierre.mockResolvedValue(undefined);

      // First run
      const first = await orchestrator.cerrarMes("Enero 2026", adminMock);
      expect(first.snapshot).toEqual(fakeSnapshot);

      // Second run (idempotent)
      const second = await orchestrator.cerrarMes("Enero 2026", adminMock);
      expect(second.snapshot).toEqual(fakeSnapshot);

      // All stages called twice
      expect(mockProcessPendingOrders).toHaveBeenCalledTimes(2);
      expect(mockGenerarHistoricoMensual).toHaveBeenCalledTimes(2);
      expect(mockCerrarGananciasPorCategoria).toHaveBeenCalledTimes(2);
      expect(mockRegistrarCierre).toHaveBeenCalledTimes(2);
    });
  });
});
