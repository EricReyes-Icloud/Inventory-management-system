import { describe, it, expect } from "vitest";
import { obtenerCategoria } from "../../../src/services/contabilidad.service";

describe("obtenerCategoria", () => {

  // 🔴 1. Categorías correctas básicas
  describe("categorías correctas", () => {
    it("debe identificar correctamente categorías simples", () => {
      expect(obtenerCategoria("clavo 100")).toBe("Clavo");
      expect(obtenerCategoria("aji 50")).toBe("Aji");
      expect(obtenerCategoria("coco 30")).toBe("Coco");
    });
  });

  // 🔴 2. Normalización integrada (tildes, mayúsculas, etc)
  describe("normalización integrada", () => {
    it("debe funcionar con tildes y mayúsculas", () => {
      expect(obtenerCategoria("CLAVOS DE 100")).toBe("Clavo");
      expect(obtenerCategoria("Ajíes de 50")).toBe("Aji");
      expect(obtenerCategoria("Cánela 50 pequeña")).toBe("Canela");
    });
  });

  // 🔴 3. Diferenciación de categorías similares
  describe("diferenciación de categorías", () => {
    it("debe diferenciar entre Canela y Canela_molida", () => {
      expect(obtenerCategoria("canela 50 pequeña")).toBe("Canela");
      expect(obtenerCategoria("canela molida 50")).toBe("Canela_molida");
    });
  });

  // 🔴 4. Casos reales del negocio
  describe("casos reales", () => {
    it("debe mapear correctamente pedidos reales", () => {
      expect(obtenerCategoria("10 canela pequeña")).toBe("Canela");
      expect(obtenerCategoria("miel 100")).toBe("Miel");
      expect(obtenerCategoria("frasco de miel")).toBe("Miel");
      expect(obtenerCategoria("media botella miel")).toBe("Miel");
    });
  });

  // 🔴 5. Producto desconocido
  describe("producto desconocido", () => {
    it("debe retornar null si no encuentra categoría", () => {
      expect(obtenerCategoria("producto raro")).toBe(null);
      expect(obtenerCategoria("pizza 100")).toBe(null);
    });
  });

  // ⚠️ 6. Edge cases
  describe("edge cases", () => {
    it("debe manejar entradas vacías o inválidas", () => {
      expect(obtenerCategoria("")).toBe(null);
      expect(obtenerCategoria("!!!")).toBe(null);
      expect(obtenerCategoria("1234")).toBe(null);
    });
  });

});