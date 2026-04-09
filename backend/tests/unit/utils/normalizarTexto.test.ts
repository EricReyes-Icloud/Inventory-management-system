import { describe, it, expect } from "vitest";
import { normalizarTexto } from "../../../src/utils/normalizarTexto"; // ajusta ruta

describe("normalizarTexto", () => {
 
  // 🔴 1. Normalización básica
  describe("normalización básica", () => {
    it("debe convertir a minúsculas y quitar tildes", () => {
      expect(normalizarTexto("AJÍ")).toBe("aji");
      expect(normalizarTexto("Café")).toBe("cafe");
    });
  });

  // 🔴 2. Eliminación de símbolos
  describe("eliminación de símbolos", () => {
    it("debe eliminar caracteres especiales", () => {
      expect(normalizarTexto("clavo #100!")).toBe("clavo 100");
      expect(normalizarTexto("aji (50)")).toBe("aji 50");
    });
  });

  // 🔴 3. Singularización
  describe("singularización", () => {
    it("debe convertir plurales a singular", () => {
      expect(normalizarTexto("clavos")).toBe("clavo");
      expect(normalizarTexto("ajies")).toBe("aji");
      expect(normalizarTexto("mieles")).toBe("miel");
    });
  });

  // 🔴 4. Regla "de" → "*"
  describe("regla de → *", () => {
    it("debe transformar 'de' en '*'", () => {
      expect(normalizarTexto("clavo de 100")).toBe("clavo * 100");
      expect(normalizarTexto("miel de 50")).toBe("miel * 50");
    });
  });

  // 🔴 5. Espacios
  describe("espacios", () => {
    it("debe limpiar espacios extra", () => {
      expect(normalizarTexto("   clavo    100   ")).toBe("clavo 100");
      expect(normalizarTexto("aji    de   50")).toBe("aji * 50");
    });
  });

  // 🔥 6. Casos reales (negocio)
  describe("casos reales de negocio", () => {
    it("debe normalizar pedidos reales correctamente", () => {
      expect(normalizarTexto("10 canela pequeña")).toBe("10 canela pequena");
      expect(normalizarTexto("clavos de 100")).toBe("clavo * 100");
      expect(normalizarTexto("mieles de 50")).toBe("miel * 50");
      expect(normalizarTexto("   AJIES   DE 50!!!")).toBe("aji * 50");
      expect(normalizarTexto("Canela molida de 50")).toBe("canela molida * 50");
    });
  });

  // ⚠️ 7. Edge cases
  describe("edge cases", () => {
    it("debe manejar valores vacíos o raros", () => {
      expect(normalizarTexto("")).toBe("");
      expect(normalizarTexto("!!!***")).toBe("");
      expect(normalizarTexto("1234")).toBe("1234");
      expect(normalizarTexto("perro de 50")).toBe("perro * 50");
    });
  });

});