import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Module from "module";
import path from "path";

declare module "module" {
  interface Module {
    _cache: Record<string, NodeModule | undefined>;
  }
}

const projectRoot = process.cwd();
const firestorePath = path.resolve(projectRoot, "src/lib/firestore.js");

let mockDb: any;
let productosRepo: any;

beforeEach(() => {
  const mockDocRef = {
    get: vi.fn(),
    collection: vi.fn(() => ({
      get: vi.fn(),
      doc: vi.fn(() => mockDocRef),
      limit: vi.fn(() => ({ get: vi.fn() })),
    })),
  };

  mockDb = {
    collection: vi.fn(() => ({
      get: vi.fn(),
      doc: vi.fn(() => mockDocRef),
      listCollections: vi.fn(),
    })),
    doc: vi.fn(() => mockDocRef),
    _mockDocRef: mockDocRef,
  };

  Module._cache[firestorePath] = {
    exports: mockDb,
    loaded: true,
  } as any;

  const repoPath = path.resolve(projectRoot, "src/repositories/productos.repository.js");
  delete Module._cache[repoPath];

  productosRepo = require("../../../src/repositories/productos.repository");
});

afterEach(() => {
  delete Module._cache[firestorePath];
  vi.restoreAllMocks();
});

describe("productos.repository", () => {
  describe("getProducto", () => {
    it("retorna el documento cuando existe", async () => {
      const fakeData = { Nombre: "Clavo * 100", "Precio carton": 5000 };
      mockDb._mockDocRef.get.mockResolvedValue({
        exists: true,
        id: "Clavo_1",
        data: () => fakeData,
      });

      const resultado = await productosRepo.getProducto("Clavo * 100", "Clavo_1");

      expect(resultado).not.toBeNull();
      expect(resultado.id).toBe("Clavo_1");
      expect(resultado.data().Nombre).toBe("Clavo * 100");
      expect(mockDb.collection).toHaveBeenCalledWith("Productos");
    });

    it("retorna null cuando el documento no existe", async () => {
      mockDb._mockDocRef.get.mockResolvedValue({
        exists: false,
        id: "Inexistente",
        data: () => null,
      });

      const resultado = await productosRepo.getProducto("Clavo * 100", "Inexistente");
      expect(resultado).toBeNull();
    });
  });

  describe("getAllProductos", () => {
    it("retorna productos con subcolecciones", async () => {
      const mockListCollections = vi.fn().mockResolvedValue([
        {
          id: "Clavo * 100",
          get: vi.fn().mockResolvedValue({
            docs: [
              { id: "Clavo_1", data: () => ({ Nombre: "Clavo * 100", "Precio carton": 5000 }) },
            ],
          }),
        },
      ]);

      const mockCollection = vi.fn(() => ({
        get: vi.fn().mockResolvedValue({
          docs: [
            { id: "Productos_ID", ref: { listCollections: mockListCollections } },
          ],
          empty: false,
        }),
        doc: vi.fn(),
        listCollections: vi.fn(),
      }));

      mockDb.collection = mockCollection;

      const productos = await productosRepo.getAllProductos();

      expect(Array.isArray(productos)).toBe(true);
      expect(productos.length).toBe(1);
      expect(productos[0].id).toBe("Productos_ID");
      expect(productos[0].subcolecciones["Clavo * 100"]).toHaveLength(1);
      expect(productos[0].subcolecciones["Clavo * 100"][0].id).toBe("Clavo_1");
    });

    it("retorna array vacío cuando no hay productos", async () => {
      mockDb.collection = vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ docs: [], empty: true }),
        doc: vi.fn(),
      }));

      const productos = await productosRepo.getAllProductos();
      expect(Array.isArray(productos)).toBe(true);
      expect(productos).toHaveLength(0);
    });
  });

  describe("buscarSubcoleccion", () => {
    it("retorna el primer documento de la subcolección", async () => {
      const mockSubcCollection = vi.fn(() => ({
        get: vi.fn().mockResolvedValue({
          empty: false,
          docs: [{ id: "Clavo_1", data: () => ({ Nombre: "Clavo * 100" }) }],
        }),
        doc: vi.fn(),
        limit: vi.fn(),
      }));

      // getSubcollection: limit(1).get()
      const limitGet = vi.fn().mockResolvedValue({
        empty: false,
        docs: [{ id: "Clavo_1", data: () => ({ Nombre: "Clavo * 100" }) }],
      });

      mockDb.collection = vi.fn(() => ({
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({
            limit: vi.fn(() => ({ get: limitGet })),
            get: vi.fn(),
          })),
        })),
        get: vi.fn(),
      }));

      const resultado = await productosRepo.buscarSubcoleccion("Clavo * 100");

      expect(resultado).not.toBeNull();
      expect(resultado.id).toBe("Clavo_1");
    });

    it("retorna null cuando la subcolección está vacía", async () => {
      mockDb.collection = vi.fn(() => ({
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
            })),
            get: vi.fn(),
          })),
        })),
        get: vi.fn(),
      }));

      const resultado = await productosRepo.buscarSubcoleccion("NoExiste");
      expect(resultado).toBeNull();
    });
  });
});
