// Independent HTTP probes for POST /api/auth/login: real router, real service,
// real express-rate-limit limiter. Only the external boundaries (firebase-admin
// and the Firestore repository) are faked.
import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "path";
import Module from "module";

const ROOT = path.resolve(__dirname, "../..");
const ROUTES = path.resolve(ROOT, "src/routes/auth.js");
const SERVICE = path.resolve(ROOT, "src/services/auth.service.js");
const REPO = path.resolve(ROOT, "src/repositories/admin.repository.js");
const { createRequire } = require("module");
const nodeRequire = createRequire(path.join(ROOT, "src/routes/auth.js"));
const FIREBASE = nodeRequire.resolve("firebase-admin");
const CONFIG = path.resolve(ROOT, "src/config.js");

process.env.RATE_LIMIT_MAX = "2"; // small budget so ordering is observable

const verifyIdToken = vi.fn();
const repoFind = vi.fn();

function patch(modPath: string, exports: any) {
  (require.cache as any)[modPath] = { id: modPath, filename: modPath, loaded: true, exports } as any;
}

function buildApp() {
  patch(FIREBASE, { auth: () => ({ verifyIdToken: (...a: any[]) => verifyIdToken(...a) }) });
  patch(REPO, { getAdminByEmailAnyCollection: (...a: any[]) => repoFind(...a) });
  delete (require.cache as any)[CONFIG];
  delete (require.cache as any)[path.resolve(ROOT, "src/middlewares/rateLimit.js")];
  delete (require.cache as any)[SERVICE];
  delete (require.cache as any)[ROUTES];

  const express = require("express");
  const app = express();
  app.use(express.json());
  app.use("/api/auth", require(ROUTES));
  return app;
}

const snap = (docs: any[]) => ({ empty: docs.length === 0, docs });
const doc = (data: any) => ({ data: () => data });

let app: any;
let request: any;
beforeEach(() => {
  verifyIdToken.mockReset();
  repoFind.mockReset();
  request = require("supertest");
  app = buildApp();
});

describe("probe: POST /api/auth/login HTTP contract", () => {
  it("R1 missing body idToken -> 400 {error:'invalid_request'} and no verification", async () => {
    for (const body of [{}, { idToken: "" }, { idToken: "   " }, { idToken: 123 }, { idToken: null }]) {
      app = buildApp(); // fresh limiter budget per probe (max=2)
      const res = await request(app).post("/api/auth/login").send(body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "invalid_request" });
    }
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("R2 valid token of admin stored in Admin_2 -> 200 exact body, no password field", async () => {
    verifyIdToken.mockResolvedValueOnce({ uid: "UID2", email: "admin2@colibri.com" });
    repoFind.mockResolvedValueOnce(snap([doc({ Nombre: "Admin Dos", passwordChangeRequired: true })]));

    const res = await request(app).post("/api/auth/login").send({ idToken: "ID-TOKEN-2" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      token: "ID-TOKEN-2",
      admin: { uid: "UID2", email: "admin2@colibri.com", nombre: "Admin Dos" },
      passwordChangeRequired: true,
    });
    expect(res.body).not.toHaveProperty("password");
    expect(res.body.admin).not.toHaveProperty("password");
    expect(verifyIdToken).toHaveBeenCalledWith("ID-TOKEN-2");
    expect(repoFind).toHaveBeenCalledWith("admin2@colibri.com");
  });

  it("R3 expired/invalid token -> 401 invalid_token, Firestore untouched", async () => {
    verifyIdToken.mockRejectedValueOnce(new Error("auth/id-token-expired"));
    const res = await request(app).post("/api/auth/login").send({ idToken: "expired" });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "invalid_token" });
    expect(repoFind).not.toHaveBeenCalled();
  });

  it("R4 valid token for a non-admin -> 403 admin_not_found", async () => {
    verifyIdToken.mockResolvedValueOnce({ uid: "U9", email: "random@x.com" });
    repoFind.mockResolvedValueOnce(snap([]));
    const res = await request(app).post("/api/auth/login").send({ idToken: "valid-but-not-admin" });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "admin_not_found" });
  });

  it("R5 Firestore read failure -> 500 internal_error (never 403)", async () => {
    verifyIdToken.mockResolvedValueOnce({ uid: "U1", email: "admin@x.com" });
    repoFind.mockRejectedValueOnce(new Error("firestore unavailable"));
    const res = await request(app).post("/api/auth/login").send({ idToken: "t" });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "internal_error" });
  });

  it("R6 limiter runs BEFORE the service: 2 signed requests allowed, 3rd -> 429 and no verification", async () => {
    verifyIdToken.mockResolvedValue({ uid: "U1", email: "admin@x.com" });
    repoFind.mockResolvedValue(snap([doc({ Nombre: "A", passwordChangeRequired: false })]));

    const r1 = await request(app).post("/api/auth/login").send({ idToken: "t1" });
    const r2 = await request(app).post("/api/auth/login").send({ idToken: "t2" });
    const r3 = await request(app).post("/api/auth/login").send({ idToken: "t3" });

    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect(r3.status).toBe(429);
    expect(r3.body).toEqual({ error: "too_many_requests" });
    expect(verifyIdToken).toHaveBeenCalledTimes(2);
    expect(r3.headers["ratelimit"] ?? r3.headers["ratelimit-policy"]).toBeTruthy();
  });

  it("R7 rate-limited responses do not verify tokens even when the 3rd call is a valid admin token", async () => {
    verifyIdToken.mockResolvedValue({ uid: "U1", email: "a@x.com" });
    repoFind.mockResolvedValue(snap([doc({ Nombre: "A", passwordChangeRequired: true })]));
    for (let i = 0; i < 2; i++) await request(app).post("/api/auth/login").send({ idToken: "t" });
    const blocked = await request(app).post("/api/auth/login").send({ idToken: "VALID" });
    expect(blocked.status).toBe(429);
    expect(verifyIdToken).toHaveBeenCalledTimes(2);
  });

  it("R8 only POST is routed", async () => {
    const g = await request(app).get("/api/auth/login");
    expect(g.status).toBe(404);
  });

  it("R9 malformed JSON body -> documented 400 shape (advisory probe)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"idToken": ');
    // Pre-existing Express behavior: 400 with an HTML body. Keep the assertion
    // loose so this advisory probe does not couple T2 to a global error handler.
    expect([400, 500]).toContain(res.status);
  });
});

// ── End-to-end chain: route -> real service -> real repository -> fake Firestore
const FIRESTORE = path.resolve(ROOT, "src/lib/firestore.js");

function fakeDb(table: Record<string, any[]>) {
  const makeQuery = (col: string) => {
    const preds: Array<(d: any) => boolean> = [];
    const q: any = {
      where(field: string, op: string, value: any) {
        if (op !== "==") throw new Error("unexpected op " + op);
        preds.push((d: any) => d[field] === value);
        return q;
      },
      limit() { return q; },
      async get() {
        const docs = (table[col] || []).filter((d) => preds.every((p) => p(d))).slice(0, 1)
          .map((d) => ({ data: () => d }));
        return { empty: docs.length === 0, docs };
      },
    };
    return q;
  };
  return {
    collection: () => ({
      doc: () => ({ collection: (col: string) => makeQuery(col) }),
    }),
  };
}

function buildRealChainApp(table: Record<string, any[]>) {
  const { createRequire } = require("module");
  const nodeRequire = createRequire(path.join(ROOT, "src/routes/auth.js"));
  const fb = nodeRequire.resolve("firebase-admin");
  (require.cache as any)[fb] = {
    id: fb, filename: fb, loaded: true,
    exports: { auth: () => ({ verifyIdToken: (...a: any[]) => verifyIdToken(...a) }) },
  } as any;
  (require.cache as any)[FIRESTORE] = {
    id: FIRESTORE, filename: FIRESTORE, loaded: true, exports: fakeDb(table),
  } as any;
  for (const p of [CONFIG, path.resolve(ROOT, "src/middlewares/rateLimit.js"),
    path.resolve(ROOT, "src/repositories/admin.repository.js"), SERVICE, ROUTES]) {
    delete (require.cache as any)[p];
  }
  const express = require("express");
  const app = express();
  app.use(express.json());
  app.use("/api/auth", require(ROUTES));
  return app;
}

describe("probe: end-to-end login chain (real service + real repository)", () => {
  it("E1 admin stored only in Admin_3 logs in with the Firestore Nombre and flag", async () => {
    verifyIdToken.mockReset(); repoFind.mockReset();
    verifyIdToken.mockResolvedValueOnce({ uid: "UID3", email: "admin3@colibri.com" });
    const a = buildRealChainApp({
      Admin: [],
      Admin_2: [],
      Admin_3: [{ Email: "admin3@colibri.com", Nombre: "Admin Tres", Rol: "admin", Activo: true, passwordChangeRequired: true }],
    });
    const res = await request(a).post("/api/auth/login").send({ idToken: "IDT3" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      token: "IDT3",
      admin: { uid: "UID3", email: "admin3@colibri.com", nombre: "Admin Tres" },
      passwordChangeRequired: true,
    });
  });

  it("E2 an admin document with Activo=false is rejected as admin_not_found", async () => {
    verifyIdToken.mockReset();
    verifyIdToken.mockResolvedValueOnce({ uid: "UID3", email: "admin3@colibri.com" });
    const a = buildRealChainApp({
      Admin: [],
      Admin_2: [],
      Admin_3: [{ Email: "admin3@colibri.com", Nombre: "Admin Tres", Rol: "admin", Activo: false }],
    });
    const res = await request(a).post("/api/auth/login").send({ idToken: "IDT3" });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "admin_not_found" });
  });

  it("E3 an admin document with Rol != admin is rejected as admin_not_found", async () => {
    verifyIdToken.mockReset();
    verifyIdToken.mockResolvedValueOnce({ uid: "UID1", email: "op@colibri.com" });
    const a = buildRealChainApp({
      Admin: [{ Email: "op@colibri.com", Nombre: "Operador", Rol: "operador", Activo: true }],
      Admin_2: [], Admin_3: [],
    });
    const res = await request(a).post("/api/auth/login").send({ idToken: "IDT1" });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "admin_not_found" });
  });

  it("E4 the superseded {email,password} contract is not accepted (password never reaches auth)", async () => {
    verifyIdToken.mockReset();
    const a = buildRealChainApp({ Admin: [], Admin_2: [], Admin_3: [] });
    const res = await request(a)
      .post("/api/auth/login")
      .send({ email: "admin@colibri.com", password: "SuperSecret1!" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "invalid_request" });
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("E5 a Firestore failure in the real repository chain -> 500 internal_error", async () => {
    verifyIdToken.mockReset();
    verifyIdToken.mockResolvedValueOnce({ uid: "U", email: "a@colibri.com" });
    const a = buildRealChainApp({
      Admin: [], Admin_2: [], Admin_3: [],
    });
    // sabotage: make every get() throw
    const { createRequire } = require("module");
    const nodeRequire = createRequire(path.join(ROOT, "src/routes/auth.js"));
    const firestore = (require.cache as any)[FIRESTORE].exports;
    const orig = firestore.collection;
    firestore.collection = (...args: any[]) => {
      const c: any = orig(...args);
      const d = c.doc;
      c.doc = (...a: any[]) => {
        const doc = d(...a);
        const col = doc.collection;
        doc.collection = (colName: string) => {
          const q = col(colName);
          const get = q.get;
          q.get = async () => { throw new Error("DEADLINE_EXCEEDED"); };
          return q;
        };
        return doc;
      };
      return c;
    };
    const res = await request(a).post("/api/auth/login").send({ idToken: "t" });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "internal_error" });
  });
});
