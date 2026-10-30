// Tests for backend/src/services/clientCache.service.js
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
const firestorePath = path.resolve(projectRoot, "src/lib/firestore.js");
const clientCachePath = path.resolve(projectRoot, "src/services/clientCache.service.js");

let mockDb: any;
let mockCollectionGet: any;

function createMockDb() {
  mockCollectionGet = vi.fn();

  mockDb = {
    collection: vi.fn((name: string) => ({
      get: mockCollectionGet,
    })),
  };

  Module._cache[firestorePath] = {
    exports: mockDb,
    loaded: true,
  } as any;
}

function reloadClientCache() {
  delete Module._cache[clientCachePath];
  return require("../../../src/services/clientCache.service");
}

describe("clientCache.service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    createMockDb();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete Module._cache[firestorePath];
    delete Module._cache[clientCachePath];
    vi.restoreAllMocks();
  });

  describe("exports", () => {
    it("exports getNombresClients, invalidateCache, and CLIENT_TTL_MS", async () => {
      const mod = reloadClientCache();
      expect(typeof mod.getNombresClients).toBe("function");
      expect(typeof mod.invalidateCache).toBe("function");
      expect(mod.CLIENT_TTL_MS).toBe(300000);
    });
  });

  describe("fetch from Firestore", () => {
    it("returns normalized, length-descending sorted names", async () => {
      mockCollectionGet.mockResolvedValue({
        empty: false,
        docs: [
          { data: () => ({ Nombre: "Juan" }), id: "1" },
          { data: () => ({ Nombre: "Juan Carlos" }), id: "2" },
          { data: () => ({ Nombre: "María" }), id: "3" },
        ],
        forEach: vi.fn(),
      });

      const { getNombresClients } = reloadClientCache();
      const nombres = await getNombresClients();

      expect(nombres).toEqual(["juan carlos", "maria", "juan"]);
    });

    it("handles tildes/accents correctly (normalization)", async () => {
      mockCollectionGet.mockResolvedValue({
        empty: false,
        docs: [
          { data: () => ({ Nombre: "José" }), id: "1" },
          { data: () => ({ Nombre: "Peña" }), id: "2" },
        ],
        forEach: vi.fn(),
      });

      const { getNombresClients } = reloadClientCache();
      const nombres = await getNombresClients();

      expect(nombres).toEqual(["jose", "pena"]);
    });

    it("falls back to document ID when Nombre field is missing", async () => {
      mockCollectionGet.mockResolvedValue({
        empty: false,
        docs: [
          { data: () => ({}), id: "cliente_sin_nombre" },
        ],
        forEach: vi.fn(),
      });

      const { getNombresClients } = reloadClientCache();
      const nombres = await getNombresClients();

      expect(nombres).toEqual(["cliente_sin_nombre"]);
    });

    it("returns empty array when Firestore collection is empty", async () => {
      mockCollectionGet.mockResolvedValue({
        empty: true,
        docs: [],
        forEach: vi.fn(),
      });

      const { getNombresClients } = reloadClientCache();
      const nombres = await getNombresClients();

      expect(nombres).toEqual([]);
    });

    it("returns empty array when Firestore throws", async () => {
      mockCollectionGet.mockRejectedValue(new Error("Firestore down"));

      const { getNombresClients } = reloadClientCache();
      const nombres = await getNombresClients();

      expect(nombres).toEqual([]);
    });
  });

  describe("in-memory caching with TTL", () => {
    it("caches result and does not call Firestore again within TTL", async () => {
      mockCollectionGet.mockResolvedValue({
        empty: false,
        docs: [{ data: () => ({ Nombre: "Test" }), id: "1" }],
        forEach: vi.fn(),
      });

      const { getNombresClients, invalidateCache } = reloadClientCache();

      const first = await getNombresClients();
      expect(first).toEqual(["test"]);
      expect(mockCollectionGet).toHaveBeenCalledTimes(1);

      const second = await getNombresClients();
      expect(second).toEqual(["test"]);
      expect(mockCollectionGet).toHaveBeenCalledTimes(1); // not called again
    });

    it("refetches from Firestore after TTL expires", async () => {
      mockCollectionGet
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ data: () => ({ Nombre: "Old" }), id: "1" }],
          forEach: vi.fn(),
        })
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ data: () => ({ Nombre: "New" }), id: "2" }],
          forEach: vi.fn(),
        });

      const { getNombresClients } = reloadClientCache();

      const first = await getNombresClients();
      expect(first).toEqual(["old"]);

      // Advance timers past TTL
      vi.advanceTimersByTime(300001); // 5 min + 1 ms

      const second = await getNombresClients();
      expect(second).toEqual(["new"]);
      expect(mockCollectionGet).toHaveBeenCalledTimes(2);
    });

    it("invalidateCache forces a fresh fetch on next call", async () => {
      mockCollectionGet
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ data: () => ({ Nombre: "Before" }), id: "1" }],
          forEach: vi.fn(),
        })
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ data: () => ({ Nombre: "After" }), id: "2" }],
          forEach: vi.fn(),
        });

      const { getNombresClients, invalidateCache } = reloadClientCache();

      const first = await getNombresClients();
      expect(first).toEqual(["before"]);

      invalidateCache();

      const second = await getNombresClients();
      expect(second).toEqual(["after"]);
      expect(mockCollectionGet).toHaveBeenCalledTimes(2);
    });
  });
});