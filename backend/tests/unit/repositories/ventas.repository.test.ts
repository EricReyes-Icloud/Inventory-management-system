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
let mockDocRef: any;
let ventasRepo: any;

beforeEach(() => {
  mockDocRef = {
    get: vi.fn(),
    set: vi.fn(),
    collection: vi.fn(() => ({
      get: vi.fn(),
      doc: vi.fn(() => mockDocRef),
      where: vi.fn(() => ({ get: vi.fn() })),
    })),
  };

  mockDb = {
    collection: vi.fn(() => ({
      get: vi.fn(),
      doc: vi.fn(() => mockDocRef),
      forEach: vi.fn(),
    })),
    doc: vi.fn(() => mockDocRef),
    _mockDocRef: mockDocRef,
  };

  Module._cache[firestorePath] = {
    exports: mockDb,
    loaded: true,
  } as any;

  const repoPath = path.resolve(projectRoot, "src/repositories/ventas.repository.js");
  delete Module._cache[repoPath];

  ventasRepo = require("../../../src/repositories/ventas.repository");
});

afterEach(() => {
  delete Module._cache[firestorePath];
  vi.restoreAllMocks();
});

describe("ventas.repository", () => {
  describe("buscarClientePorNombre", () => {
    it("retorna null cuando la colección está vacía", async () => {
      // Reemplazar completamente el mock de firestore para este test
      Module._cache[firestorePath] = {
        exports: {
          collection: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              forEach: vi.fn((_cb: any) => { /* no docs */ }),
              docs: [],
              empty: true,
            }),
            doc: vi.fn(() => mockDocRef),
          })),
          doc: vi.fn(() => mockDocRef),
        },
        loaded: true,
      } as any;
      const repoPath = path.resolve(projectRoot, "src/repositories/ventas.repository.js");
      delete Module._cache[repoPath];
      ventasRepo = require("../../../src/repositories/ventas.repository");

      const resultado = await ventasRepo.buscarClientePorNombre("cliente ejemplo sas");
      expect(resultado).toBeNull();
    });

    it("retorna el cliente cuando el nombre coincide normalizado", async () => {
      const fakeCliente = {
        id: "cliente-1",
        data: () => ({ Nombre: "Cliente Ejemplo S.A.S." }),
      };

      Module._cache[firestorePath] = {
        exports: {
          collection: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              forEach: vi.fn((callback: any) => { callback(fakeCliente); }),
              docs: [fakeCliente],
              empty: false,
            }),
            doc: vi.fn(() => mockDocRef),
          })),
          doc: vi.fn(() => mockDocRef),
        },
        loaded: true,
      } as any;
      const repoPath = path.resolve(projectRoot, "src/repositories/ventas.repository.js");
      delete Module._cache[repoPath];
      ventasRepo = require("../../../src/repositories/ventas.repository");

      // "Cliente Ejemplo S.A.S." → normalizado → "cliente ejemplo s.a.s."
      const resultado = await ventasRepo.buscarClientePorNombre("cliente ejemplo s.a.s.");
      expect(resultado).not.toBeNull();
      expect(resultado!.id).toBe("cliente-1");
    });

    it("retorna null cuando el nombre no coincide", async () => {
      const fakeCliente = {
        id: "cliente-1",
        data: () => ({ Nombre: "Condimentos El Colibrí" }),
      };

      Module._cache[firestorePath] = {
        exports: {
          collection: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              forEach: vi.fn((callback: any) => { callback(fakeCliente); }),
              docs: [fakeCliente],
              empty: false,
            }),
            doc: vi.fn(() => mockDocRef),
          })),
          doc: vi.fn(() => mockDocRef),
        },
        loaded: true,
      } as any;
      const repoPath = path.resolve(projectRoot, "src/repositories/ventas.repository.js");
      delete Module._cache[repoPath];
      ventasRepo = require("../../../src/repositories/ventas.repository");

      const resultado = await ventasRepo.buscarClientePorNombre("inexistente");
      expect(resultado).toBeNull();
    });
  });

  describe("getVenta", () => {
    it("retorna el documento cuando existe", async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        id: "cliente-1",
        data: () => ({ clienteNombre: "Test" }),
      });

      const resultado = await ventasRepo.getVenta("cliente-1");
      expect(resultado).not.toBeNull();
      expect(resultado!.data().clienteNombre).toBe("Test");
    });

    it("retorna null cuando no existe", async () => {
      mockDocRef.get.mockResolvedValue({ exists: false, id: "no-existe", data: () => null });

      const resultado = await ventasRepo.getVenta("no-existe");
      expect(resultado).toBeNull();
    });
  });

  describe("setVenta", () => {
    it("llama a set con merge", async () => {
      const data = { clienteNombre: "Test", actualizadoEn: new Date() };
      await ventasRepo.setVenta("cliente-1", data);

      expect(mockDocRef.set).toHaveBeenCalledWith(data, { merge: true });
      expect(mockDb.collection).toHaveBeenCalledWith("Ventas");
    });
  });

  describe("getMesesPedidos", () => {
    it("retorna los meses de pedidos", async () => {
      const fakeMeses = { docs: [{ id: "Enero 2026" }, { id: "Febrero 2026" }] };
      mockDocRef.collection = vi.fn(() => ({
        get: vi.fn().mockResolvedValue(fakeMeses),
        doc: vi.fn(() => mockDocRef),
      }));

      const resultado = await ventasRepo.getMesesPedidos("cliente-1");
      expect(resultado.docs).toHaveLength(2);
      expect(resultado.docs[0].id).toBe("Enero 2026");
    });
  });

  describe("setPedidoMes", () => {
    it("llama a set con merge en la subcoleccion Pedidos", async () => {
      const data = { mes: "Enero 2026", clienteId: "cliente-1" };

      await ventasRepo.setPedidoMes("cliente-1", "Enero 2026", data);

      expect(mockDocRef.set).toHaveBeenCalledWith(data, { merge: true });
    });
  });

  describe("getPedidos", () => {
    it("retorna los pedidos de un mes", async () => {
      const fakePedidos = { docs: [{ id: "Pedido_Id1" }, { id: "Pedido_Id2" }] };
      mockDocRef.collection = vi.fn(() => ({
        get: vi.fn().mockResolvedValue(fakePedidos),
        doc: vi.fn(() => mockDocRef),
        where: vi.fn(() => ({ get: vi.fn() })),
      }));

      const resultado = await ventasRepo.getPedidos("cliente-1", "Enero 2026");
      expect(resultado.docs).toHaveLength(2);
    });
  });

  describe("getPedidosPendientes", () => {
    it("filtra por estadoContable pendiente", async () => {
      const fakePedidos = { docs: [{ id: "Pedido_Id1", data: () => ({ estadoContable: "pendiente" }) }] };
      const mockWhereGet = vi.fn().mockResolvedValue(fakePedidos);

      mockDocRef.collection = vi.fn(() => ({
        get: vi.fn(),
        doc: vi.fn(() => mockDocRef),
        where: vi.fn(() => ({ get: mockWhereGet })),
      }));

      const resultado = await ventasRepo.getPedidosPendientes("cliente-1", "Enero 2026");
      expect(resultado.docs).toHaveLength(1);
      expect(mockDocRef.collection).toHaveBeenCalledWith("pedidos");
    });
  });

  describe("crearPedido", () => {
    it("crea un pedido en la subcoleccion pedidos", async () => {
      const data = { pedidoId: "Pedido_Id1", total: 1000 };

      await ventasRepo.crearPedido("cliente-1", "Enero 2026", "Pedido_Id1", data);

      expect(mockDocRef.set).toHaveBeenCalledWith(data);
    });
  });

  describe("getTodosClientesConVentas", () => {
    it("retorna todos los documentos de Ventas", async () => {
      const fakeSnap = { docs: [{ id: "cliente-1" }, { id: "cliente-2" }], empty: false };
      mockDb.collection = vi.fn(() => ({
        get: vi.fn().mockResolvedValue(fakeSnap),
        doc: vi.fn(() => mockDocRef),
      }));

      const resultado = await ventasRepo.getTodosClientesConVentas();
      expect(resultado.docs).toHaveLength(2);
      expect(mockDb.collection).toHaveBeenCalledWith("Ventas");
    });
  });
});
