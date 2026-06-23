import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Module from "module";
import path from "path";

declare module "module" {
  interface Module {
    _cache: Record<string, NodeModule | undefined>;
  }
}

const projectRoot = process.cwd();

// ── Mock repository functions ──────────────────────────────────────────────
const mockGetHistoricoMensual = vi.fn();
const mockGetCategoriasTotalProductos = vi.fn();
const mockGetSkusTotalProductos = vi.fn();
const mockGetCategoriasCartonesVendidos = vi.fn();
const mockGetSkusCartonesVendidos = vi.fn();
const mockSetHistoricoMensual = vi.fn();
const mockObtenerCategoria = vi.fn();
const mockBuildOperacionesContables = vi.fn();

let contabilidadService: any;

// ── Helpers ────────────────────────────────────────────────────────────────

function emptySnapshot() {
  return { docs: [], size: 0, empty: true };
}

function categorySnapshot(categories: Record<string, number>) {
  const docs = Object.entries(categories).map(([id, total]) => ({
    id,
    data: () => ({ total }),
    exists: true,
  }));
  return { docs, size: docs.length, empty: docs.length === 0 };
}

function skuSnapshot(skus: Record<string, number>) {
  const docs = Object.entries(skus).map(([id, total]) => ({
    id,
    data: () => ({ total }),
    exists: true,
  }));
  return { docs, size: docs.length, empty: docs.length === 0 };
}

function docSnapshot(data: Record<string, unknown>) {
  return { exists: true, data: () => data };
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset all mocks
  mockGetHistoricoMensual.mockReset();
  mockGetCategoriasTotalProductos.mockReset();
  mockGetSkusTotalProductos.mockReset();
  mockGetCategoriasCartonesVendidos.mockReset();
  mockGetSkusCartonesVendidos.mockReset();
  mockSetHistoricoMensual.mockReset();
  mockObtenerCategoria.mockReset();
  mockBuildOperacionesContables.mockReset();

  // Default mocks: no duplicate, empty data
  mockGetHistoricoMensual.mockResolvedValue(null);
  mockGetCategoriasTotalProductos.mockResolvedValue(emptySnapshot());
  mockGetSkusTotalProductos.mockResolvedValue(emptySnapshot());
  mockGetCategoriasCartonesVendidos.mockResolvedValue(emptySnapshot());
  mockGetSkusCartonesVendidos.mockResolvedValue(emptySnapshot());

  // Pre-seed contabilidad.repository in Module._cache
  const repoPath = path.resolve(
    projectRoot,
    "src/repositories/contabilidad.repository.js"
  );
  Module._cache[repoPath] = {
    exports: {
      getHistoricoMensual: mockGetHistoricoMensual,
      getCategoriasTotalProductos: mockGetCategoriasTotalProductos,
      getSkusTotalProductos: mockGetSkusTotalProductos,
      getCategoriasCartonesVendidos: mockGetCategoriasCartonesVendidos,
      getSkusCartonesVendidos: mockGetSkusCartonesVendidos,
      setHistoricoMensual: mockSetHistoricoMensual,
      obtenerCategoria: mockObtenerCategoria,
      buildOperacionesContables: mockBuildOperacionesContables,
    },
    loaded: true,
  } as any;

  // Clear contabilidad.service cache so require() picks up mocked deps
  const servicePath = path.resolve(
    projectRoot,
    "src/services/contabilidad.service.js"
  );
  delete Module._cache[servicePath];

  contabilidadService = require("../../../src/services/contabilidad.service");
});

afterEach(() => {
  vi.restoreAllMocks();
  const modules = [
    "src/repositories/contabilidad.repository.js",
    "src/services/contabilidad.service.js",
  ];
  for (const mod of modules) {
    const p = path.resolve(projectRoot, mod);
    delete Module._cache[p];
  }
});

// ══════════════════════════════════════════════════════════════════════════
// Exports
// ══════════════════════════════════════════════════════════════════════════

describe("contabilidad.service exports", () => {
  it("exports exactly 3 functions: generarHistoricoMensual, obtenerCategoria, buildOperacionesContables", () => {
    const keys = Object.keys(contabilidadService);
    expect(keys).toEqual([
      "generarHistoricoMensual",
      "obtenerCategoria",
      "buildOperacionesContables",
    ]);
    for (const key of keys) {
      expect(typeof contabilidadService[key]).toBe("function");
    }
  });

  it("delegates obtenerCategoria to contabilidad.repository", () => {
    expect(contabilidadService.obtenerCategoria).toBe(mockObtenerCategoria);
  });

  it("delegates buildOperacionesContables to contabilidad.repository", () => {
    expect(contabilidadService.buildOperacionesContables).toBe(
      mockBuildOperacionesContables
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════
// generarHistoricoMensual — Admin Validation
// ══════════════════════════════════════════════════════════════════════════

describe("generarHistoricoMensual — admin validation", () => {
  it("throws if admin.uid is missing and does NOT call any repo read", async () => {
    await expect(
      contabilidadService.generarHistoricoMensual("Enero 2026", {
        nombre: "Admin",
      })
    ).rejects.toThrow("admin.uid es obligatorio");

    expect(mockGetCategoriasTotalProductos).not.toHaveBeenCalled();
    expect(mockGetCategoriasCartonesVendidos).not.toHaveBeenCalled();
    expect(mockSetHistoricoMensual).not.toHaveBeenCalled();
  });

  it("throws if admin.nombre is missing and does NOT call any repo read", async () => {
    await expect(
      contabilidadService.generarHistoricoMensual("Enero 2026", {
        uid: "abc123",
      })
    ).rejects.toThrow("admin.nombre es obligatorio");

    expect(mockGetCategoriasTotalProductos).not.toHaveBeenCalled();
    expect(mockGetCategoriasCartonesVendidos).not.toHaveBeenCalled();
    expect(mockSetHistoricoMensual).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// generarHistoricoMensual — Duplicate mesAnio
// ══════════════════════════════════════════════════════════════════════════

describe("generarHistoricoMensual — duplicate mesAnio", () => {
  it("throws if historico already exists for mesAnio and does NOT call setHistoricoMensual or category reads", async () => {
    mockGetHistoricoMensual.mockResolvedValue(
      docSnapshot({ mesAnio: "Enero 2026" })
    );

    await expect(
      contabilidadService.generarHistoricoMensual("Enero 2026", {
        uid: "abc123",
        nombre: "Admin",
      })
    ).rejects.toThrow("El histórico para Enero 2026 ya fue generado");

    expect(mockSetHistoricoMensual).not.toHaveBeenCalled();
    expect(mockGetCategoriasTotalProductos).not.toHaveBeenCalled();
    expect(mockGetCategoriasCartonesVendidos).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// generarHistoricoMensual — Happy Path
// ══════════════════════════════════════════════════════════════════════════

describe("generarHistoricoMensual — happy path", () => {
  it("generates full snapshot with metadata for valid admin and mesAnio", async () => {
    const mesAnio = "Enero 2026";
    const admin = { uid: "abc123", nombre: "Admin Test" };

    // Total Productos: 2 categories, each with SKUs
    mockGetCategoriasTotalProductos.mockResolvedValue(
      categorySnapshot({ Miel: 10000, Frascos: 5000 })
    );
    mockGetSkusTotalProductos
      .mockResolvedValueOnce(
        skuSnapshot({ "Miel 1kg": 6000, "Miel 500g": 4000 })
      )
      .mockResolvedValueOnce(skuSnapshot({ "Frasco Vidrio": 5000 }));

    // Cartones Vendidos: 2 categories, each with SKUs
    mockGetCategoriasCartonesVendidos.mockResolvedValue(
      categorySnapshot({ Miel: 100, Frascos: 50 })
    );
    mockGetSkusCartonesVendidos
      .mockResolvedValueOnce(
        skuSnapshot({ "Miel 1kg": 60, "Miel 500g": 40 })
      )
      .mockResolvedValueOnce(skuSnapshot({ "Frasco Vidrio": 50 }));

    const result =
      await contabilidadService.generarHistoricoMensual(mesAnio, admin);

    // Verify result shape
    expect(result).toHaveProperty("totalProductos");
    expect(result).toHaveProperty("cartonesVendidos");

    // Verify Total Productos data
    expect(result.totalProductos).toEqual({
      Miel: { total: 10000, skus: { "Miel 1kg": 6000, "Miel 500g": 4000 } },
      Frascos: { total: 5000, skus: { "Frasco Vidrio": 5000 } },
    });

    // Verify Cartones Vendidos data
    expect(result.cartonesVendidos).toEqual({
      Miel: { total: 100, skus: { "Miel 1kg": 60, "Miel 500g": 40 } },
      Frascos: { total: 50, skus: { "Frasco Vidrio": 50 } },
    });

    // Verify setHistoricoMensual was called with metadata
    expect(mockSetHistoricoMensual).toHaveBeenCalledOnce();
    const [calledMesAnio, data] = mockSetHistoricoMensual.mock.calls[0];
    expect(calledMesAnio).toBe(mesAnio);
    expect(data.estado).toBe("cerrado");
    expect(data.generadoPor).toBe("abc123");
    expect(data.usuario).toBe("Admin Test");
    expect(data.generadoEn).toBeInstanceOf(Date);
    expect(data.totalProductos).toEqual(result.totalProductos);
    expect(data.cartonesVendidos).toEqual(result.cartonesVendidos);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// generarHistoricoMensual — Empty Data
// ══════════════════════════════════════════════════════════════════════════

describe("generarHistoricoMensual — empty data", () => {
  it("returns empty objects when no categories exist", async () => {
    const result =
      await contabilidadService.generarHistoricoMensual("Enero 2026", {
        uid: "abc123",
        nombre: "Admin",
      });

    expect(result).toEqual({
      totalProductos: {},
      cartonesVendidos: {},
    });

    // A snapshot is still persisted
    expect(mockSetHistoricoMensual).toHaveBeenCalledOnce();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// generarHistoricoMensual — Missing SKUs Default to 0 (Empty)
// ══════════════════════════════════════════════════════════════════════════

describe("generarHistoricoMensual — missing SKUs", () => {
  it("defaults SKU values to {} when category has no SKU documents", async () => {
    // Total Productos has 1 category with total, but no SKUs
    mockGetCategoriasTotalProductos.mockResolvedValue(
      categorySnapshot({ Categoria: 100 })
    );
    // getSkusTotalProductos stays at default emptySnapshot

    // Cartones Vendidos stays empty
    // (default mock is already emptySnapshot)

    const result =
      await contabilidadService.generarHistoricoMensual("Enero 2026", {
        uid: "abc123",
        nombre: "Admin",
      });

    expect(result.totalProductos).toEqual({
      Categoria: { total: 100, skus: {} },
    });
    expect(result.cartonesVendidos).toEqual({});
  });
});

// ══════════════════════════════════════════════════════════════════════════
// generarHistoricoMensual — Error Propagation
// ══════════════════════════════════════════════════════════════════════════

describe("generarHistoricoMensual — error propagation", () => {
  it("propagates repository errors from getCategoriasTotalProductos", async () => {
    const testError = new Error("Firestore read error");
    mockGetCategoriasTotalProductos.mockRejectedValue(testError);

    await expect(
      contabilidadService.generarHistoricoMensual("Enero 2026", {
        uid: "abc123",
        nombre: "Admin",
      })
    ).rejects.toThrow("Firestore read error");
  });
});
