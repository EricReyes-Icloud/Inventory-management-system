/**
 * Tests for productos.repository.getCatalogo — nombreCanonico preference
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";

const projectRoot = path.resolve(__dirname, "../../..");
const firestorePath = path.resolve(projectRoot, "src/lib/firestore.js");

function mockGetCatalogo(nombreCanonico: string | null, subcolId: string) {
  const subcol = {
    id: subcolId,
    get: vi.fn().mockResolvedValue({
      empty: false,
      docs: [
        {
          id: "doc1",
          data: () => ({
            ...(nombreCanonico ? { nombreCanonico } : {}),
            sinonimos: ["sin1"],
            categoria: "Cat1",
          }),
        },
      ],
    }),
  };

  const productoDocRef = {
    listCollections: vi.fn().mockResolvedValue([subcol]),
  };

  const firestore = {
    collection: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({
        docs: [
          {
            ref: productoDocRef,
          },
        ],
      }),
    }),
  };

  return { firestore };
}

describe("productos.repository — nombreCanonico preference", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete require.cache[require.resolve("../../../src/repositories/productos.repository")];
    delete require.cache[require.resolve(firestorePath)];
  });

  it("prefers data.nombreCanonico over subcol.id when present", async () => {
    const { firestore } = mockGetCatalogo("Nombre Correcto", "subcol-old-name");
    require.cache[firestorePath] = { exports: firestore, loaded: true };
    const repo = require("../../../src/repositories/productos.repository");
    const catalog = await repo.getCatalogo();
    expect(catalog).toHaveLength(1);
    expect(catalog[0].nombre).toBe("Nombre Correcto");
  });

  it("falls back to subcol.id when nombreCanonico is absent", async () => {
    const { firestore } = mockGetCatalogo(null, "Subcollection Name");
    require.cache[firestorePath] = { exports: firestore, loaded: true };
    const repo = require("../../../src/repositories/productos.repository");
    const catalog = await repo.getCatalogo();
    expect(catalog).toHaveLength(1);
    expect(catalog[0].nombre).toBe("Subcollection Name");
  });
});
