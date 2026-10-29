import { describe, it, expect } from "vitest";
const { normalizarTexto } = require("../../../src/utils/normalizarTexto");

describe("normalizarTexto — normalización Unicode pura (sin reglas de negocio)", () => {

  // 1. Normalización básica
  describe("normalización básica", () => {
    it("debe convertir a minúsculas y quitar tildes", () => {
      expect(normalizarTexto("AJÍ")).toBe("aji");
      expect(normalizarTexto("Café")).toBe("cafe");
      expect(normalizarTexto("PERÚ")).toBe("peru");
    });
  });

  // 2. Eliminación de símbolos y caracteres no alfanuméricos
  describe("eliminación de símbolos", () => {
    it("debe eliminar caracteres especiales", () => {
      expect(normalizarTexto("clavo #100!")).toBe("clavo 100");
      expect(normalizarTexto("aji (50)")).toBe("aji 50");
      expect(normalizarTexto("!!!***")).toBe("");
    });
  });

  // 3. NO singularización — el normalizador es puro, sin reglas de plural
  describe("sin reglas de plural (stricta normalización Unicode)", () => {
    it("NO convierte plurales a singular — eso es regla de negocio en inturis", () => {
      expect(normalizarTexto("clavos")).toBe("clavos");
      expect(normalizarTexto("ajies")).toBe("ajies");
      expect(normalizarTexto("mieles")).toBe("mieles");
    });
  });

  // 4. NO regla "de" → "*" — eso es regla de negocio en inturis
  describe("sin regla de → *", () => {
    it("NO transforma 'de' en '*' — eso es regla de negocio en inturis", () => {
      expect(normalizarTexto("clavo de 100")).toBe("clavo de 100");
      expect(normalizarTexto("miel de 50")).toBe("miel de 50");
    });
  });

  // 5. Espacios
  describe("espacios", () => {
    it("debe limpiar espacios extra", () => {
      expect(normalizarTexto("   clavo    100   ")).toBe("clavo 100");
      expect(normalizarTexto("aji    de   50")).toBe("aji de 50");
    });
  });

  // 6. Números y alfanuméricos
  describe("números", () => {
    it("debe preservar números", () => {
      expect(normalizarTexto("1234")).toBe("1234");
      expect(normalizarTexto("10 canela")).toBe("10 canela");
    });
  });

  // 7. Preservación de la ñ (deuda técnica #2026-10-26)
  describe("ñ preservada", () => {
    it("debe conservar la ñ minúscula", () => {
      expect(normalizarTexto("caña")).toBe("caña");
      expect(normalizarTexto("jalapeño")).toBe("jalapeño");
      expect(normalizarTexto("piñata")).toBe("piñata");
      expect(normalizarTexto("años")).toBe("años");
      expect(normalizarTexto("niña")).toBe("niña");
      expect(normalizarTexto("canela pequeña")).toBe("canela pequeña");
    });

    it("debe conservar la ñ mayúscula (Ñ) y convertirla a minúscula", () => {
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
  });
});