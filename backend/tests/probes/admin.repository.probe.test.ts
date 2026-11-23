// Independent probes for getAdminByEmailAnyCollection and the unchanged shared
// getAdminByEmail (real repository code, faked Firestore db).
import { describe, it, expect, beforeEach } from "vitest";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");
const REPO = path.resolve(ROOT, "src/repositories/admin.repository.js");
const FIRESTORE = path.resolve(ROOT, "src/lib/firestore.js");

type Trace = string[];

function makeDb(trace: Trace, data: Record<string, any[]>, throwOn?: string) {
  const db = {
    collection: (c1: string) => {
      const chain1 = {
        doc: (d1: string) => ({
          collection: (c2: string) => {
            const q: any = {
              where: (field: string, op: string, value: any) => {
                trace.push(`${c1}/${d1}/${c2} where ${field} ${op} ${value}`);
                return q;
              },
              limit: (n: number) => {
                trace.push(`${c1}/${d1}/${c2} limit ${n}`);
                return q;
              },
              get: async () => {
                trace.push(`${c1}/${d1}/${c2} GET`);
                if (throwOn === c2) throw new Error(`firestore read failed on ${c2}`);
                const docs = (data[c2] || []).map((d) => ({ data: () => d }));
                return { empty: docs.length === 0, docs };
              },
            };
            return q;
          },
        }),
      };
      return chain1 as any;
    },
  };
  return db;
}

function loadRepo(db: any) {
  (require.cache as any)[FIRESTORE] = {
    id: FIRESTORE, filename: FIRESTORE, loaded: true, exports: db,
  } as any;
  delete (require.cache as any)[REPO];
  return require(REPO);
}

describe("probe: getAdminByEmailAnyCollection", () => {
  it("Q1 finds an admin stored in Admin_2 without touching Admin_3", async () => {
    const trace: Trace = [];
    const repo = loadRepo(makeDb(trace, { Admin: [], Admin_2: [{ Email: "a2@x.com", Nombre: "Dos" }], Admin_3: [] }));
    const snap = await repo.getAdminByEmailAnyCollection("a2@x.com");
    expect(snap.empty).toBe(false);
    expect(snap.docs[0].data().Nombre).toBe("Dos");
    expect(trace).toEqual([
      "Usuarios/Usuarios/Admin where Email == a2@x.com",
      "Usuarios/Usuarios/Admin where Activo == true",
      "Usuarios/Usuarios/Admin where Rol == admin",
      "Usuarios/Usuarios/Admin limit 1",
      "Usuarios/Usuarios/Admin GET",
      "Usuarios/Usuarios/Admin_2 where Email == a2@x.com",
      "Usuarios/Usuarios/Admin_2 where Activo == true",
      "Usuarios/Usuarios/Admin_2 where Rol == admin",
      "Usuarios/Usuarios/Admin_2 limit 1",
      "Usuarios/Usuarios/Admin_2 GET",
    ]);
  });

  it("Q2 finds an admin stored only in Admin_3", async () => {
    const trace: Trace = [];
    const repo = loadRepo(makeDb(trace, { Admin: [], Admin_2: [], Admin_3: [{ Email: "a3@x.com", Nombre: "Tres" }] }));
    const snap = await repo.getAdminByEmailAnyCollection("a3@x.com");
    expect(snap.empty).toBe(false);
    expect(snap.docs[0].data().Nombre).toBe("Tres");
    expect(trace.filter((t) => t.endsWith("GET"))).toHaveLength(3);
    expect(trace[trace.length - 1]).toBe("Usuarios/Usuarios/Admin_3 GET");
  });

  it("Q3 unknown email returns an empty snapshot after querying all three collections", async () => {
    const trace: Trace = [];
    const repo = loadRepo(makeDb(trace, { Admin: [], Admin_2: [], Admin_3: [] }));
    const snap = await repo.getAdminByEmailAnyCollection("nobody@x.com");
    expect(snap.empty).toBe(true);
    expect(snap.docs).toEqual([]);
    expect(trace.filter((t) => t.endsWith("GET"))).toHaveLength(3);
  });

  it("Q4 a Firestore failure propagates and stops the scan", async () => {
    const trace: Trace = [];
    const repo = loadRepo(makeDb(trace, { Admin: [], Admin_2: [], Admin_3: [] }, "Admin_2"));
    await expect(repo.getAdminByEmailAnyCollection("x@x.com")).rejects.toThrow("firestore read failed on Admin_2");
    expect(trace.filter((t) => t.endsWith("GET"))).toEqual([
      "Usuarios/Usuarios/Admin GET",
      "Usuarios/Usuarios/Admin_2 GET",
    ]);
  });

  it("Q5 inactive or non-admin docs are excluded by the query filters", async () => {
    const trace: Trace = [];
    const repo = loadRepo(makeDb(trace, { Admin: [], Admin_2: [], Admin_3: [] }));
    await repo.getAdminByEmailAnyCollection("x@x.com");
    for (const col of ["Admin", "Admin_2", "Admin_3"]) {
      expect(trace).toContain(`Usuarios/Usuarios/${col} where Activo == true`);
      expect(trace).toContain(`Usuarios/Usuarios/${col} where Rol == admin`);
    }
  });
});

describe("probe: getAdminByEmail behavior is preserved", () => {
  it("Q6 still queries only the Admin subcollection with the same filter order and limit", async () => {
    const trace: Trace = [];
    const repo = loadRepo(makeDb(trace, { Admin: [{ Email: "a@x.com", Nombre: "A" }], Admin_2: [], Admin_3: [] }));
    const snap = await repo.getAdminByEmail("a@x.com");
    expect(snap.docs[0].data().Nombre).toBe("A");
    expect(trace).toEqual([
      "Usuarios/Usuarios/Admin where Email == a@x.com",
      "Usuarios/Usuarios/Admin where Activo == true",
      "Usuarios/Usuarios/Admin where Rol == admin",
      "Usuarios/Usuarios/Admin limit 1",
      "Usuarios/Usuarios/Admin GET",
    ]);
  });

  it("Q7 exports are additive: no existing repository function was removed", () => {
    const repo = loadRepo(makeDb([], {}));
    expect(repo.getAdminByEmail).toBeTypeOf("function");
    expect(repo.getAdminByEmailAnyCollection).toBeTypeOf("function");
    expect(Object.keys(repo)).toContain("getAdminByTelefono");
    expect(Object.keys(repo)).toContain("setAdminAction");
  });
});
