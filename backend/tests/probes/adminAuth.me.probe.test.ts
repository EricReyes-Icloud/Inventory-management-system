// HTTP probes for GET /api/auth/me and the adminAuth collection lookup.
// Only firebase-admin and the Firestore repository are faked.
import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "path";
import { createRequire } from "module";

const ROOT = path.resolve(__dirname, "../..");
const FIREBASE = createRequire(path.join(ROOT, "src/routes/auth.js")).resolve("firebase-admin");
const REPO = path.resolve(ROOT, "src/repositories/admin.repository.js");
const AUTH_SERVICE = path.resolve(ROOT, "src/services/auth.service.js");
const ADMIN_AUTH = path.resolve(ROOT, "src/middlewares/adminAuth.js");
const RATE_LIMIT = path.resolve(ROOT, "src/middlewares/rateLimit.js");
const ROUTES = path.resolve(ROOT, "src/routes/auth.js");
const CONFIG = path.resolve(ROOT, "src/config.js");

const verifyIdToken = vi.fn();
const findAny = vi.fn();
const findLegacy = vi.fn();

function patch(modPath: string, exports: any) {
  (require.cache as any)[modPath] = {
    id: modPath,
    filename: modPath,
    loaded: true,
    exports,
  } as any;
}

function buildApp() {
  patch(FIREBASE, {
    auth: () => ({ verifyIdToken: (...args: any[]) => verifyIdToken(...args) }),
  });
  patch(REPO, {
    getAdminByEmailAnyCollection: (...args: any[]) => findAny(...args),
    getAdminByEmail: (...args: any[]) => findLegacy(...args),
  });
  for (const mod of [CONFIG, RATE_LIMIT, AUTH_SERVICE, ADMIN_AUTH, ROUTES]) {
    delete (require.cache as any)[mod];
  }

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
  findAny.mockReset();
  findLegacy.mockReset();
  request = require("supertest");
  app = buildApp();
});

describe("probe: GET /api/auth/me", () => {
  it("V1 rejects a request without a Bearer token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("V2 rejects an invalid Firebase ID token", async () => {
    verifyIdToken.mockRejectedValueOnce(new Error("expired"));
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer bad-token");
    expect(res.status).toBe(401);
    expect(findAny).not.toHaveBeenCalled();
  });

  it("V3 rejects a token without an email", async () => {
    verifyIdToken.mockResolvedValueOnce({ uid: "U0" });
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer token-no-email");
    expect(res.status).toBe(403);
    expect(findAny).not.toHaveBeenCalled();
  });

  it("V4 rejects a valid user who is not an admin", async () => {
    verifyIdToken.mockResolvedValueOnce({ uid: "U1", email: "user@colibri.test" });
    findAny.mockResolvedValueOnce(snap([]));
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer non-admin");
    expect(res.status).toBe(403);
    expect(findAny).toHaveBeenCalledWith("user@colibri.test");
  });

  it("V5 accepts an admin stored in Admin_2 using getAdminByEmailAnyCollection", async () => {
    verifyIdToken.mockResolvedValueOnce({ uid: "U2", email: "admin2@colibri.test" });
    findAny.mockResolvedValueOnce(snap([doc({ Nombre: "Admin Dos" })]));
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      admin: {
        uid: "U2",
        email: "admin2@colibri.test",
        nombre: "Admin Dos",
      },
    });
    expect(findAny).toHaveBeenCalledWith("admin2@colibri.test");
    expect(findLegacy).not.toHaveBeenCalled();
  });

  it("V6 never queries the legacy Admin-only lookup", async () => {
    verifyIdToken.mockResolvedValueOnce({ uid: "U3", email: "admin3@colibri.test" });
    findAny.mockResolvedValueOnce(snap([doc({ Nombre: "Admin Tres" })]));
    await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer token-3");
    expect(findLegacy).not.toHaveBeenCalled();
  });

  it("V7 maps a repository failure to 401 without leaking the error", async () => {
    verifyIdToken.mockResolvedValueOnce({ uid: "U4", email: "admin@colibri.test" });
    findAny.mockRejectedValueOnce(new Error("firestore-down"));
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer token-4");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ ok: false, message: "No autorizado" });
    expect(JSON.stringify(res.body)).not.toContain("firestore-down");
  });
});
