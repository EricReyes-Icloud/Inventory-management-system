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
let adminRepo: any;

beforeEach(() => {
  const mockDocRef = {
    get: vi.fn(),
    set: vi.fn(),
    collection: vi.fn(() => ({
      get: vi.fn(),
      doc: vi.fn(() => mockDocRef),
    })),
  };

  mockDb = {
    collection: vi.fn(() => ({
      get: vi.fn(),
      doc: vi.fn(() => mockDocRef),
      where: vi.fn(() => ({
        get: vi.fn(),
        where: vi.fn(() => ({
          get: vi.fn(),
          where: vi.fn(() => ({
            get: vi.fn(),
            limit: vi.fn(() => ({ get: vi.fn() })),
          })),
          limit: vi.fn(() => ({ get: vi.fn() })),
        })),
        limit: vi.fn(() => ({ get: vi.fn() })),
      })),
    })),
    doc: vi.fn(() => mockDocRef),
    _mockDocRef: mockDocRef,
  };

  Module._cache[firestorePath] = {
    exports: mockDb,
    loaded: true,
  } as any;

  const repoPath = path.resolve(projectRoot, "src/repositories/admin.repository.js");
  delete Module._cache[repoPath];

  adminRepo = require("../../../src/repositories/admin.repository");
});

afterEach(() => {
  delete Module._cache[firestorePath];
  vi.restoreAllMocks();
});

describe("admin.repository", () => {
  // ──────────────────────────────────────────────
  // getAdminByEmail
  // ──────────────────────────────────────────────

  describe("getAdminByEmail", () => {
    it("retorna QuerySnapshot con docs cuando el admin existe", async () => {
      const fakeAdmin = {
        id: "admin-1",
        data: () => ({ Nombre: "Admin Test", Email: "admin@test.com", Rol: "admin", Activo: true }),
      };
      const mockSnapshot = { docs: [fakeAdmin], empty: false };

      // Mock: db.collection("Admin").where("Email","==",email).where("Activo","==",true).where("Rol","==","admin").limit(1).get()
      mockDb.collection = vi.fn(() => ({
        where: vi.fn(() => ({
          where: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => ({
                get: vi.fn().mockResolvedValue(mockSnapshot),
              })),
            })),
          })),
        })),
      }));

      const result = await adminRepo.getAdminByEmail("admin@test.com");
      expect(result.empty).toBe(false);
      expect(result.docs[0].id).toBe("admin-1");
    });

    it("retorna QuerySnapshot vacío cuando el admin no existe", async () => {
      const mockSnapshot = { docs: [], empty: true };

      mockDb.collection = vi.fn(() => ({
        where: vi.fn(() => ({
          where: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => ({
                get: vi.fn().mockResolvedValue(mockSnapshot),
              })),
            })),
          })),
        })),
      }));

      const result = await adminRepo.getAdminByEmail("noexiste@test.com");
      expect(result.empty).toBe(true);
      expect(result.docs).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────
  // getAdminByRol
  // ──────────────────────────────────────────────

  describe("getAdminByRol", () => {
    it("retorna QuerySnapshot con admins del rol especificado", async () => {
      const fakeAdmins = [
        { id: "admin-1", data: () => ({ Nombre: "Admin 1", Rol: "admin" }) },
        { id: "admin-2", data: () => ({ Nombre: "Admin 2", Rol: "admin" }) },
      ];
      const mockSnapshot = { docs: fakeAdmins, empty: false };

      mockDb.collection = vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(mockSnapshot),
        })),
      }));

      const result = await adminRepo.getAdminByRol("admin");
      expect(result.empty).toBe(false);
      expect(result.docs).toHaveLength(2);
    });

    it("retorna QuerySnapshot vacío cuando no hay admins con ese rol", async () => {
      const mockSnapshot = { docs: [], empty: true };

      mockDb.collection = vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(mockSnapshot),
        })),
      }));

      const result = await adminRepo.getAdminByRol("superadmin");
      expect(result.empty).toBe(true);
    });
  });

  // ──────────────────────────────────────────────
  // getInversion
  // ──────────────────────────────────────────────

  describe("getInversion", () => {
    it("retorna el documento cuando existe", async () => {
      const fakeDoc = {
        id: "categoria-1",
        exists: true,
        data: () => ({ monto: 10000, categoria: "categoria-1" }),
      };

      mockDb.collection = vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(fakeDoc),
        })),
      }));

      const result = await adminRepo.getInversion("categoria-1");
      expect(result).not.toBeNull();
      expect(result!.data().monto).toBe(10000);
    });

    it("retorna null cuando el documento no existe", async () => {
      const fakeDoc = {
        id: "no-existe",
        exists: false,
        data: () => ({}),
      };

      mockDb.collection = vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(fakeDoc),
        })),
      }));

      const result = await adminRepo.getInversion("no-existe");
      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  // getCierresContables
  // ──────────────────────────────────────────────

  describe("getCierresContables", () => {
    it("retorna el documento cuando existe", async () => {
      const fakeDoc = {
        id: "Enero 2026",
        exists: true,
        data: () => ({ total: 50000 }),
      };

      mockDb.collection = vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(fakeDoc),
        })),
      }));

      const result = await adminRepo.getCierresContables("Enero 2026");
      expect(result).not.toBeNull();
      expect(result!.data().total).toBe(50000);
    });

    it("retorna null cuando no existe cierre para el mes", async () => {
      const fakeDoc = {
        id: "No existe",
        exists: false,
        data: () => ({}),
      };

      mockDb.collection = vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(fakeDoc),
        })),
      }));

      const result = await adminRepo.getCierresContables("Febrero 2099");
      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  // setCierreContable
  // ──────────────────────────────────────────────

  describe("setCierreContable", () => {
    it("setea con merge en Cierres_contables/{mesAnio}", async () => {
      const mockSet = vi.fn().mockResolvedValue({});
      const mockDoc = { set: mockSet };

      mockDb.collection = vi.fn(() => ({
        doc: vi.fn(() => mockDoc),
      }));

      const data = { gananciaNeta: 10000, categoria: "Test", mesAnio: "Enero 2026" };
      await adminRepo.setCierreContable("Enero 2026", "Test", data);

      expect(mockSet).toHaveBeenCalledWith(
        { Test: data },
        { merge: true }
      );
    });
  });

  // ──────────────────────────────────────────────
  // setAdminAction
  // ──────────────────────────────────────────────

  describe("setAdminAction", () => {
    it("setea con merge en AdminActions/{mesAnio}", async () => {
      const mockSet = vi.fn().mockResolvedValue({});
      const mockDoc = { set: mockSet };

      mockDb.collection = vi.fn(() => ({
        doc: vi.fn(() => mockDoc),
      }));

      const data = { accion: "cierre_categoria", categoria: "Test", mesAnio: "Enero 2026" };
      await adminRepo.setAdminAction("Enero 2026", "Test", data);

      expect(mockSet).toHaveBeenCalledWith(
        { Test: data },
        { merge: true }
      );
    });
  });
});
