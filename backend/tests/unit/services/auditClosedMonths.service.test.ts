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

const mockGetTodasGanancias = vi.fn();
const mockGetCategoriaTotal = vi.fn();
const mockGetCategoriaCartones = vi.fn();
const mockSetGanancias = vi.fn();
const mockSetHistoricoMensual = vi.fn();

let auditService: any;

function docSnap(data: any) {
  return { exists: true, data: () => data };
}

function gananciasSnap(months: Record<string, object>) {
  return {
    docs: Object.entries(months).map(([id, data]) => ({
      id,
      data: () => data,
    })),
  };
}

beforeEach(() => {
  mockGetTodasGanancias.mockReset();
  mockGetCategoriaTotal.mockReset();
  mockGetCategoriaCartones.mockReset();
  mockSetGanancias.mockReset();
  mockSetHistoricoMensual.mockReset();

  // Mock contabilidad.repository (reads only)
  const contabilidadRepoPath = path.resolve(
    projectRoot,
    "src/repositories/contabilidad.repository.js"
  );
  Module._cache[contabilidadRepoPath] = {
    exports: {
      getCategoriaTotal: mockGetCategoriaTotal,
      getCategoriaCartones: mockGetCategoriaCartones,
      setHistoricoMensual: mockSetHistoricoMensual,
    },
    loaded: true,
  } as any;

  // Mock contable.repository (reads only)
  const contableRepoPath = path.resolve(
    projectRoot,
    "src/repositories/contable.repository.js"
  );
  Module._cache[contableRepoPath] = {
    exports: {
      getTodasGanancias: mockGetTodasGanancias,
      setGanancias: mockSetGanancias,
    },
    loaded: true,
  } as any;

  const servicePath = path.resolve(
    projectRoot,
    "src/services/auditClosedMonths.service.js"
  );
  delete Module._cache[servicePath];

  auditService = require("../../../src/services/auditClosedMonths.service");
});

afterEach(() => {
  vi.restoreAllMocks();
  const modules = [
    "src/repositories/contabilidad.repository.js",
    "src/repositories/contable.repository.js",
    "src/services/auditClosedMonths.service.js",
  ];
  for (const mod of modules) {
    delete Module._cache[path.resolve(projectRoot, mod)];
  }
});

describe("auditClosedMonths.service", () => {
  it("retorna arreglo vacío cuando no hay documentos de Ganancias", async () => {
    mockGetTodasGanancias.mockResolvedValue(gananciasSnap({}));

    const result = await auditService.auditClosedMonths();

    expect(result).toEqual([]);
  });

  it("reporta una categoría cerrada con total vivo distinto de cero", async () => {
    mockGetTodasGanancias.mockResolvedValue(
      gananciasSnap({ "Septiembre 2025": { Miel: { gananciaNeta: 100 } } })
    );
    mockGetCategoriaTotal.mockResolvedValue(docSnap({ total: 250 }));
    mockGetCategoriaCartones.mockResolvedValue(docSnap({ total: 0 }));

    const result = await auditService.auditClosedMonths();

    expect(result).toEqual([
      {
        mesAnio: "Septiembre 2025",
        categoria: "Miel",
        totalLive: 250,
        cartonesLive: 0,
      },
    ]);
  });

  it("reporta cuando solo los cartones quedaron con total vivo", async () => {
    mockGetTodasGanancias.mockResolvedValue(
      gananciasSnap({ "Septiembre 2025": { Miel: { gananciaNeta: 100 } } })
    );
    mockGetCategoriaTotal.mockResolvedValue(docSnap({ total: 0 }));
    mockGetCategoriaCartones.mockResolvedValue(docSnap({ total: 7 }));

    const result = await auditService.auditClosedMonths();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      mesAnio: "Septiembre 2025",
      categoria: "Miel",
      totalLive: 0,
      cartonesLive: 7,
    });
  });

  it("ignora categorías cerradas cuyos totales vivos quedaron en cero", async () => {
    mockGetTodasGanancias.mockResolvedValue(
      gananciasSnap({ "Septiembre 2025": { Miel: { gananciaNeta: 100 } } })
    );
    mockGetCategoriaTotal.mockResolvedValue(docSnap({ total: 0 }));
    mockGetCategoriaCartones.mockResolvedValue(docSnap({ total: 0 }));

    const result = await auditService.auditClosedMonths();

    expect(result).toEqual([]);
  });

  it("ignora categorías que no están en Ganancias aunque tengan total vivo", async () => {
    mockGetTodasGanancias.mockResolvedValue(
      gananciasSnap({ "Septiembre 2025": { Miel: { gananciaNeta: 100 } } })
    );
    mockGetCategoriaTotal.mockResolvedValue(docSnap({ total: 0 }));
    mockGetCategoriaCartones.mockResolvedValue(docSnap({ total: 0 }));

    const result = await auditService.auditClosedMonths();

    expect(mockGetCategoriaTotal).toHaveBeenCalledTimes(1);
    expect(mockGetCategoriaTotal).toHaveBeenCalledWith(
      "Septiembre 2025",
      "Miel"
    );
    expect(result).toEqual([]);
  });

  it("no ejecuta ninguna escritura", async () => {
    mockGetTodasGanancias.mockResolvedValue(
      gananciasSnap({ "Septiembre 2025": { Miel: { gananciaNeta: 100 } } })
    );
    mockGetCategoriaTotal.mockResolvedValue(docSnap({ total: 10 }));
    mockGetCategoriaCartones.mockResolvedValue(docSnap({ total: 1 }));

    await auditService.auditClosedMonths();

    expect(mockSetGanancias).not.toHaveBeenCalled();
    expect(mockSetHistoricoMensual).not.toHaveBeenCalled();
  });
});
