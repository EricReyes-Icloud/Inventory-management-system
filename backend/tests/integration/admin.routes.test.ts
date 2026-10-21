// backend/tests/integration/admin.routes.test.ts
// Integration suite for the admin route protection (S6).
//
// RED against the pre-change baseline: POST /api/admin/job-contable and
// POST /admin/cerrar-categoria were mounted WITHOUT any auth middleware, so
// anyone on the internet could trigger the monthly accounting job or close a
// category's accounting.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import Module from "module";
import path from "path";
import { getBackendRoot } from "../helpers/paths";

declare module "module" {
  interface Module {
    _cache: Record<string, NodeModule | undefined>;
  }
}

const PROJECT_ROOT = getBackendRoot();
const ADMIN_ROUTES_PATH = path.resolve(PROJECT_ROOT, "src/routes/admin.js");
const ADMIN_BUTTON_PATH = path.resolve(PROJECT_ROOT, "src/routes/admin.button.routes.js");
const JOB_PATH = path.resolve(PROJECT_ROOT, "src/jobs/jobContableMensual.js");
const ADMIN_ACTIONS_PATH = path.resolve(
  PROJECT_ROOT,
  "src/services/admin.actions.service.js",
);
const ADMIN_REPO_PATH = path.resolve(PROJECT_ROOT, "src/repositories/admin.repository.js");
const LOADER_PATH = path.resolve(PROJECT_ROOT, "src/catalog/loader.js");
const FIREBASE_ADMIN_PATH = require.resolve("firebase-admin");

// ── Mocks ───────────────────────────────────────────────────────────────
const jobContableMensualMock = vi.fn();
const cerrarCategoriaMock = vi.fn();
const getAdminByEmailMock = vi.fn();
const verifyIdTokenMock = vi.fn();

const ADMIN_TOKEN = "test-admin-token";
const ADMIN_EMAIL = "admin@example.com";
const FIREBASE_UID = "firebase-uid-1";

function createApp() {
  const express = require("express");
  const app = express();
  app.use(express.json());
  app.use("/api/admin", require(ADMIN_ROUTES_PATH));
  app.use("/admin", require(ADMIN_BUTTON_PATH));
  return app;
}

function injectMocks() {
  Module._cache[JOB_PATH] = {
    exports: (...args: any[]) => jobContableMensualMock(...args),
  } as any;

  Module._cache[ADMIN_ACTIONS_PATH] = {
    exports: {
      cerrarCategoria: (...args: any[]) => cerrarCategoriaMock(...args),
      registrarCierre: vi.fn(),
    },
  } as any;

  Module._cache[ADMIN_REPO_PATH] = {
    exports: {
      getAdminByEmail: (...args: any[]) => getAdminByEmailMock(...args),
    },
  } as any;

  Module._cache[LOADER_PATH] = {
    exports: { refresh: vi.fn(), init: vi.fn() },
  } as any;

  Module._cache[FIREBASE_ADMIN_PATH] = {
    exports: {
      auth: () => ({ verifyIdToken: (...args: any[]) => verifyIdTokenMock(...args) }),
    },
  } as any;
}

// ═══════════════════════════════════════════════════════════
// POST /api/admin/job-contable — guarded by the admin token
// ═══════════════════════════════════════════════════════════

describe("POST /api/admin/job-contable (S6)", () => {
  const originalAdminToken = process.env.ADMIN_TOKEN;

  beforeEach(() => {
    vi.resetAllMocks();
    injectMocks();
    delete Module._cache[ADMIN_ROUTES_PATH];
    delete Module._cache[ADMIN_BUTTON_PATH];
    process.env.ADMIN_TOKEN = ADMIN_TOKEN;
  });

  afterEach(() => {
    if (originalAdminToken === undefined) {
      delete process.env.ADMIN_TOKEN;
    } else {
      process.env.ADMIN_TOKEN = originalAdminToken;
    }
    delete Module._cache[JOB_PATH];
    delete Module._cache[ADMIN_ACTIONS_PATH];
    delete Module._cache[ADMIN_REPO_PATH];
    delete Module._cache[LOADER_PATH];
    delete Module._cache[FIREBASE_ADMIN_PATH];
    delete Module._cache[ADMIN_ROUTES_PATH];
    delete Module._cache[ADMIN_BUTTON_PATH];
  });

  it("rejects a request without an authorization header", async () => {
    const res = await request(createApp()).post("/api/admin/job-contable");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "missing_authorization_header" });
    expect(jobContableMensualMock).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong token", async () => {
    const res = await request(createApp())
      .post("/api/admin/job-contable")
      .set("Authorization", "Bearer wrong-token");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "invalid_token" });
    expect(jobContableMensualMock).not.toHaveBeenCalled();
  });

  it("fails closed when ADMIN_TOKEN is not configured", async () => {
    delete process.env.ADMIN_TOKEN;

    const res = await request(createApp())
      .post("/api/admin/job-contable")
      .set("Authorization", "Bearer anything");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "admin_token_not_configured" });
    expect(jobContableMensualMock).not.toHaveBeenCalled();
  });

  it("runs the job when the admin token is correct", async () => {
    jobContableMensualMock.mockResolvedValue({ pedidosProcesados: 2 });

    const res = await request(createApp())
      .post("/api/admin/job-contable")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(jobContableMensualMock).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════
// POST /admin/cerrar-categoria — guarded by the admin auth
// ═══════════════════════════════════════════════════════════

describe("POST /admin/cerrar-categoria (S6)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    injectMocks();
    delete Module._cache[ADMIN_ROUTES_PATH];
    delete Module._cache[ADMIN_BUTTON_PATH];

    verifyIdTokenMock.mockResolvedValue({ uid: FIREBASE_UID, email: ADMIN_EMAIL });
    getAdminByEmailMock.mockResolvedValue({
      empty: false,
      docs: [{ data: () => ({ Nombre: "Eric" }) }],
    });
    cerrarCategoriaMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    delete Module._cache[JOB_PATH];
    delete Module._cache[ADMIN_ACTIONS_PATH];
    delete Module._cache[ADMIN_REPO_PATH];
    delete Module._cache[LOADER_PATH];
    delete Module._cache[FIREBASE_ADMIN_PATH];
    delete Module._cache[ADMIN_ROUTES_PATH];
    delete Module._cache[ADMIN_BUTTON_PATH];
  });

  it("rejects a request without an authorization header", async () => {
    const res = await request(createApp())
      .post("/admin/cerrar-categoria")
      .send({ mesAnio: "Junio 2026", categoria: "Salsas" });

    expect(res.status).toBe(401);
    expect(cerrarCategoriaMock).not.toHaveBeenCalled();
  });

  it("rejects a request with an invalid token", async () => {
    verifyIdTokenMock.mockRejectedValue(new Error("invalid token"));

    const res = await request(createApp())
      .post("/admin/cerrar-categoria")
      .set("Authorization", "Bearer not-a-firebase-token")
      .send({ mesAnio: "Junio 2026", categoria: "Salsas" });

    expect(res.status).toBe(401);
    expect(cerrarCategoriaMock).not.toHaveBeenCalled();
  });

  it("rejects an authenticated user that is not an administrator", async () => {
    getAdminByEmailMock.mockResolvedValue({ empty: true, docs: [] });

    const res = await request(createApp())
      .post("/admin/cerrar-categoria")
      .set("Authorization", "Bearer firebase-token")
      .send({ mesAnio: "Junio 2026", categoria: "Salsas" });

    expect(res.status).toBe(403);
    expect(cerrarCategoriaMock).not.toHaveBeenCalled();
  });

  it("closes the category when the administrator is authenticated", async () => {
    const res = await request(createApp())
      .post("/admin/cerrar-categoria")
      .set("Authorization", "Bearer firebase-token")
      .send({ mesAnio: "Junio 2026", categoria: "Salsas" });

    expect(res.status).toBe(200);
    expect(cerrarCategoriaMock).toHaveBeenCalledTimes(1);
    expect(cerrarCategoriaMock.mock.calls[0][0]).toMatchObject({
      mesAnio: "Junio 2026",
      categoria: "Salsas",
    });
  });

  it("takes the administrator name from the verified token, not from the body", async () => {
    const res = await request(createApp())
      .post("/admin/cerrar-categoria")
      .set("Authorization", "Bearer firebase-token")
      .send({ mesAnio: "Junio 2026", categoria: "Salsas", adminUsuario: "Alguien" });

    expect(res.status).toBe(200);
    expect(cerrarCategoriaMock.mock.calls[0][0].adminUsuario).toBe("Eric");
  });
});
