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
const loaderPath = path.resolve(projectRoot, "src/catalog/loader.js");
const servicePath = path.resolve(
  projectRoot,
  "src/services/contabilidad.service.js"
);

// Category map matching the loader's internal categoriaMap
const CATEGORY_MAP: Record<string, string> = {
  "Aji * 100": "Aji",
  "Aji * 50": "Aji",
  "Ajo en polvo * 50": "Ajo_en_polvo",
  "Bicarbonato * 100": "Bicarbonato",
  "Bicarbonato * 50": "Bicarbonato",
  "Canela * 100 pequeña": "Canela",
  "Canela * 50 grande": "Canela",
  "Canela * 50 mediana": "Canela",
  "Canela * 50 pequeña": "Canela",
  "Canela molida * 50": "Canela_molida",
  "Canela molidad * 100": "Canela_molida",
  "Clavo * 100": "Clavo",
  "Clavo * 50": "Clavo",
  "Coco * 30": "Coco",
  "Color * 50": "Color",
  "Comino * 50": "Comino",
  "Copas de miel": "Miel",
  "Frasco de miel": "Miel",
  "Media botella miel": "Miel",
  "Miel * 100": "Miel",
  "Miel * 50": "Miel",
  "Miel jumbo * 50": "Miel",
  "Salsina * 50": "Salsina",
  "Uva * 30": "Uva",
};

function getCategoria(nombre: string): string | null {
  return CATEGORY_MAP[nombre] || null;
}

beforeEach(() => {
  Module._cache[loaderPath] = {
    exports: { getCategoria },
    loaded: true,
  } as any;

  delete Module._cache[servicePath];
});

afterEach(() => {
  delete Module._cache[loaderPath];
  delete Module._cache[servicePath];
  vi.restoreAllMocks();
});

describe("obtenerCategoria", () => {
  // 1. Categories via exact product name match
  describe("categorías correctas", () => {
    it("identifies categories by exact product name", () => {
      const { obtenerCategoria } = require("../../../src/services/contabilidad.service");
      expect(obtenerCategoria("Clavo * 100")).toBe("Clavo");
      expect(obtenerCategoria("Aji * 50")).toBe("Aji");
      expect(obtenerCategoria("Coco * 30")).toBe("Coco");
    });
  });

  // 2. All category mappings
  describe("all category mappings", () => {
    it("maps all 12 unique categories correctly", () => {
      const { obtenerCategoria } = require("../../../src/services/contabilidad.service");
      expect(obtenerCategoria("Clavo * 100")).toBe("Clavo");
      expect(obtenerCategoria("Aji * 100")).toBe("Aji");
      expect(obtenerCategoria("Ajo en polvo * 50")).toBe("Ajo_en_polvo");
      expect(obtenerCategoria("Bicarbonato * 100")).toBe("Bicarbonato");
      expect(obtenerCategoria("Color * 50")).toBe("Color");
      expect(obtenerCategoria("Comino * 50")).toBe("Comino");
      expect(obtenerCategoria("Canela * 100 pequeña")).toBe("Canela");
      expect(obtenerCategoria("Canela molida * 50")).toBe("Canela_molida");
      expect(obtenerCategoria("Canela molidad * 100")).toBe("Canela_molida");
      expect(obtenerCategoria("Copas de miel")).toBe("Miel");
      expect(obtenerCategoria("Media botella miel")).toBe("Miel");
      expect(obtenerCategoria("Miel * 100")).toBe("Miel");
      expect(obtenerCategoria("Salsina * 50")).toBe("Salsina");
      expect(obtenerCategoria("Uva * 30")).toBe("Uva");
    });
  });

  // 3. Unknown product
  describe("producto desconocido", () => {
    it("returns null for unrecognized product names", () => {
      const { obtenerCategoria } = require("../../../src/services/contabilidad.service");
      expect(obtenerCategoria("producto raro")).toBe(null);
      expect(obtenerCategoria("pizza 100")).toBe(null);
    });
  });

  // 4. Edge cases
  describe("edge cases", () => {
    it("returns null for empty or invalid inputs", () => {
      const { obtenerCategoria } = require("../../../src/services/contabilidad.service");
      expect(obtenerCategoria("")).toBe(null);
      expect(obtenerCategoria("!!!")).toBe(null);
      expect(obtenerCategoria("1234")).toBe(null);
    });
  });
});
