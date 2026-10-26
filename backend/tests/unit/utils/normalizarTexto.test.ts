import { describe, it, expect } from "vitest";
const { normalizarTexto } = require("../../../src/utils/normalizarTexto"); // ajusta ruta

describe("normalizarTexto", () => {

  // 1. Normalización básica
  describe("normalización básica", () => {
    it("debe convertir a minúsculas y quitar tildes", () => {
      expect(normalizarTexto("AJÍ")).toBe("aji");
      expect(normalizarTexto("Café")).toBe("cafe");
    });
  });

  // 2. Eliminación de símbolos
  describe("eliminación de símbolos", () => {
    it("debe eliminar caracteres especiales", () => {
      expect(normalizarTexto("clavo #100!")).toBe("clavo 100");
      expect(normalizarTexto("aji (50)")).toBe("aji 50");
    });
  });

  // 3. Singularización
  describe("singularización", () => {
    it("debe convertir plurales a singular", () => {
      expect(normalizarTexto("clavos")).toBe("clavo");
      expect(normalizarTexto("ajies")).toBe("aji");
      expect(normalizarTexto("mieles")).toBe("miel");
    });
  });

  // 4. Regla "de" → "*"
  describe("regla de → *", () => {
    it("debe transformar 'de' en '*'", () => {
      expect(normalizarTexto("clavo de 100")).toBe("clavo * 100");
      expect(normalizarTexto("miel de 50")).toBe("miel * 50");
    });
  });

  // 5. Espacios
  describe("espacios", () => {
    it("debe limpiar espacios extra", () => {
      expect(normalizarTexto("   clavo    100   ")).toBe("clavo 100");
      expect(normalizarTexto("aji    de   50")).toBe("aji * 50");
    });
  });

  // 6. Casos reales (negocio)
  describe("casos reales de negocio", () => {
    it("debe normalizar pedidos reales correctamente", () => {
      expect(normalizarTexto("10 canela pequeña")).toBe("10 canela pequeña");
      expect(normalizarTexto("clavos de 100")).toBe("clavo * 100");
      expect(normalizarTexto("mieles de 50")).toBe("miel * 50");
      expect(normalizarTexto("   AJIES   DE 50!!!")).toBe("aji * 50");
      expect(normalizarTexto("Canela molida de 50")).toBe("canela molida * 50");
    });
  });

  // 7. Edge cases
  describe("edge cases", () => {
    it("debe manejar valores vacíos o raros", () => {
      expect(normalizarTexto("")).toBe("");
      expect(normalizarTexto("!!!***")).toBe("");
      expect(normalizarTexto("1234")).toBe("1234");
      expect(normalizarTexto("perro de 50")).toBe("perro * 50");
    });
  });

  // 8. Preservación de la ñ (deuda técnica #2026-10-26)
  // La ñ es una LETRA del alfabeto español, no una "n con tilde".
  // NFD la descompone en n + tilde combinable y el replace borra la tilde,
  // deformando nombres reales (canela pequeña → canela pequena).
  describe("ñ preservada", () => {
    it("debe conservar la ñ minúscola", () => {
      expect(normalizarTexto("caña")).toBe("caña");
      expect(normalizarTexto("jalapeño")).toBe("jalapeño");
      expect(normalizarTexto("piñata")).toBe("piñata");
      expect(normalizarTexto("años")).toBe("años");
      expect(normalizarTexto("niña")).toBe("niña");
      expect(normalizarTexto("10 canela pequeña")).toBe("10 canela pequeña");
    });

    it("debe conservar la ñ mayúscola (Ñ) y convertirla a minúscola", () => {
      expect(normalizarTexto("Ñandú")).toBe("ñandu");
      expect(normalizarTexto("AÑO")).toBe("año");
      expect(normalizarTexto("ÑAPA")).toBe("ñapa");
    });

    it("no debe confundir la ñ con la n", () => {
      expect(normalizarTexto("cana")).toBe("cana");
      expect(normalizarTexto("canela")).toBe("canela");
      expect(normalizarTexto("ñandu")).toBe("ñandu");
    });

    it("debe seguir quitando los otros acentos (á, é, í, ó, ú)", () => {
      expect(normalizarTexto("AJí")).toBe("aji");
      expect(normalizarTexto("Café")).toBe("cafe");
      expect(normalizarTexto("perú")).toBe("peru");
    });

    it("debe preservar la ñ en combinación con las otras reglas", () => {
      expect(normalizarTexto("clavos de ñandú")).toBe("clavo * ñandu");
      expect(normalizarTexto("   JALAPEÑOS   DE 50!!!")).toBe("jalapeños * 50");
    });
  });
});
