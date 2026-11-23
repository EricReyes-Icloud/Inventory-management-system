// backend/tests/integration/auth.routes.test.ts
// T2 / S2: POST /api/auth/login accepts the client's Firebase ID token.

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
const AUTH_SERVICE_PATH = path.resolve(PROJECT_ROOT, "src/services/auth.service.js");
const RATE_LIMIT_PATH = path.resolve(PROJECT_ROOT, "src/middlewares/rateLimit.js");
const AUTH_ROUTES_PATH = path.resolve(PROJECT_ROOT, "src/routes/auth.js");

const loginMock = vi.fn();
const limiterMock = vi.fn((req: any, res: any, next: any) => next());

function AuthServiceError(code: string) {
  const error: any = new Error(code);
  error.code = code;
  return error;
}

function createApp() {
  const express = require("express");
  const app = express();
  app.use(express.json());
  app.use("/api/auth", require(AUTH_ROUTES_PATH));
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  Module._cache[AUTH_SERVICE_PATH] = {
    exports: {
      loginWithIdToken: (...args: any[]) => loginMock(...args),
      AuthServiceError: Error,
    },
  } as any;
  Module._cache[RATE_LIMIT_PATH] = {
    exports: { createLoginRateLimiter: () => limiterMock },
  } as any;
  delete Module._cache[AUTH_ROUTES_PATH];
});

afterEach(() => {
  delete Module._cache[AUTH_SERVICE_PATH];
  delete Module._cache[RATE_LIMIT_PATH];
  delete Module._cache[AUTH_ROUTES_PATH];
});

describe("POST /api/auth/login (S2)", () => {
  it("rejects a body without idToken with 400 invalid_request", async () => {
    const res = await request(createApp()).post("/api/auth/login").send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "invalid_request" });
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("passes the client idToken to the service verbatim", async () => {
    loginMock.mockResolvedValueOnce({
      token: "id-token-123",
      admin: { uid: "u1", email: "e@example.com", nombre: "Eric" },
      passwordChangeRequired: false,
    });

    const res = await request(createApp())
      .post("/api/auth/login")
      .send({ idToken: "id-token-123" });

    expect(loginMock).toHaveBeenCalledWith("id-token-123");
    expect(res.status).toBe(200);
  });

  it("returns the service payload unchanged on success", async () => {
    const payload = {
      token: "id-token-123",
      admin: { uid: "u1", email: "e@example.com", nombre: "Eric" },
      passwordChangeRequired: true,
    };
    loginMock.mockResolvedValueOnce(payload);

    const res = await request(createApp())
      .post("/api/auth/login")
      .send({ idToken: "id-token-123" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(payload);
  });

  it("maps invalid_token to 401", async () => {
    loginMock.mockRejectedValueOnce(AuthServiceError("invalid_token"));

    const res = await request(createApp())
      .post("/api/auth/login")
      .send({ idToken: "bad" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "invalid_token" });
  });

  it("maps admin_not_found to 403", async () => {
    loginMock.mockRejectedValueOnce(AuthServiceError("admin_not_found"));

    const res = await request(createApp())
      .post("/api/auth/login")
      .send({ idToken: "valid-but-not-admin" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "admin_not_found" });
  });

  it("maps unexpected service failures to 500 internal_error", async () => {
    loginMock.mockRejectedValueOnce(new Error("firestore unavailable"));

    const res = await request(createApp())
      .post("/api/auth/login")
      .send({ idToken: "id-token-123" });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "internal_error" });
  });

  it("runs the login rate limiter before the service", async () => {
    limiterMock.mockImplementationOnce((_req: any, res: any) =>
      res.status(429).json({ error: "too_many_requests" })
    );

    const res = await request(createApp())
      .post("/api/auth/login")
      .send({ idToken: "id-token-123" });

    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: "too_many_requests" });
    expect(loginMock).not.toHaveBeenCalled();
    limiterMock.mockImplementation((_req: any, _res: any, next: any) => next());
  });
});
