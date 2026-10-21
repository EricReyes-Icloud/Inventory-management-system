// backend/tests/unit/cors.test.ts
// Unit suite for the CORS allowlist (S5).
//
// RED against the pre-change baseline: backend/src/middlewares/cors.js does not
// exist and backend/src/index.js mounted `cors({ origin: true })`, which
// reflects ANY browser origin — any website could read the API responses of a
// logged-in user from the browser.
//
// The suite covers two layers:
//   1. config.cors.allowedOrigins — how CORS_ALLOWED_ORIGINS is parsed.
//   2. the guard/headers middleware — what a request from each origin does.

import { describe, it, expect, afterEach, vi } from "vitest";
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
const CONFIG_PATH = path.resolve(PROJECT_ROOT, "src/config.js");
const CORS_MIDDLEWARE_PATH = path.resolve(PROJECT_ROOT, "src/middlewares/cors.js");

const ALLOWED_ORIGIN = "https://app.example.com";
const BLOCKED_ORIGIN = "https://evil.example.com";

function loadConfig() {
  delete Module._cache[CONFIG_PATH];
  return require("../../src/config");
}

/**
 * Builds a minimal app with the CORS middleware mounted, exactly like
 * backend/src/index.js does. The middleware is required lazily so that a
 * missing module fails the test instead of the whole file collection.
 */
function createApp() {
  const express = require("express");
  const app = express();

  const { createCorsHeaders, createCorsGuard } = require(CORS_MIDDLEWARE_PATH);

  app.use(createCorsHeaders());
  app.use(createCorsGuard());

  app.get("/api/ping", (req, res) => res.json({ ok: true }));

  return app;
}

// ═══════════════════════════════════════════════════════════
// config.cors.allowedOrigins — parsing of CORS_ALLOWED_ORIGINS
// ═══════════════════════════════════════════════════════════

describe("config.cors.allowedOrigins", () => {
  const original = process.env.CORS_ALLOWED_ORIGINS;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.CORS_ALLOWED_ORIGINS;
    } else {
      process.env.CORS_ALLOWED_ORIGINS = original;
    }
    delete Module._cache[CONFIG_PATH];
  });

  it("is empty when CORS_ALLOWED_ORIGINS is not set", () => {
    delete process.env.CORS_ALLOWED_ORIGINS;

    const { cors } = loadConfig();

    expect(cors.allowedOrigins).toEqual([]);
  });

  it("is empty when CORS_ALLOWED_ORIGINS is blank", () => {
    process.env.CORS_ALLOWED_ORIGINS = "   ";

    const { cors } = loadConfig();

    expect(cors.allowedOrigins).toEqual([]);
  });

  it("parses a single origin", () => {
    process.env.CORS_ALLOWED_ORIGINS = ALLOWED_ORIGIN;

    const { cors } = loadConfig();

    expect(cors.allowedOrigins).toEqual([ALLOWED_ORIGIN]);
  });

  it("parses a comma separated list and trims each entry", () => {
    process.env.CORS_ALLOWED_ORIGINS =
      "http://localhost:5173, https://app.example.com ,https://admin.example.com";

    const { cors } = loadConfig();

    expect(cors.allowedOrigins).toEqual([
      "http://localhost:5173",
      "https://app.example.com",
      "https://admin.example.com",
    ]);
  });

  it("drops empty entries produced by stray commas", () => {
    process.env.CORS_ALLOWED_ORIGINS = ",https://app.example.com,,";

    const { cors } = loadConfig();

    expect(cors.allowedOrigins).toEqual(["https://app.example.com"]);
  });

  it("normalizes a trailing slash so the origin still matches", () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://app.example.com/";

    const { cors } = loadConfig();

    expect(cors.allowedOrigins).toEqual(["https://app.example.com"]);
  });

  it("keeps the wildcard as an explicit opt-in", () => {
    process.env.CORS_ALLOWED_ORIGINS = "*";

    const { cors } = loadConfig();

    expect(cors.allowedOrigins).toEqual(["*"]);
  });
});

// ═══════════════════════════════════════════════════════════
// CORS guard — what happens per origin
// ═══════════════════════════════════════════════════════════

describe("CORS allowlist (S5)", () => {
  const original = process.env.CORS_ALLOWED_ORIGINS;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.CORS_ALLOWED_ORIGINS;
    } else {
      process.env.CORS_ALLOWED_ORIGINS = original;
    }
    delete Module._cache[CONFIG_PATH];
    delete Module._cache[CORS_MIDDLEWARE_PATH];
  });

  it("lets an allowlisted origin through and answers with the CORS header", async () => {
    process.env.CORS_ALLOWED_ORIGINS = ALLOWED_ORIGIN;
    delete Module._cache[CONFIG_PATH];

    const res = await request(createApp())
      .get("/api/ping")
      .set("Origin", ALLOWED_ORIGIN);

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
  });

  it("blocks an origin that is not in the allowlist with 403", async () => {
    process.env.CORS_ALLOWED_ORIGINS = ALLOWED_ORIGIN;
    delete Module._cache[CONFIG_PATH];

    const res = await request(createApp())
      .get("/api/ping")
      .set("Origin", BLOCKED_ORIGIN);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "origin_not_allowed" });
  });

  it("never reaches the handler when the origin is blocked", async () => {
    process.env.CORS_ALLOWED_ORIGINS = ALLOWED_ORIGIN;
    delete Module._cache[CONFIG_PATH];

    const express = require("express");
    const app = express();
    const { createCorsHeaders, createCorsGuard } = require(CORS_MIDDLEWARE_PATH);
    const handler = vi.fn((req: any, res: any) => res.json({ ok: true }));

    app.use(createCorsHeaders());
    app.use(createCorsGuard());
    app.get("/api/ping", handler);

    const res = await request(app).get("/api/ping").set("Origin", BLOCKED_ORIGIN);

    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("blocks every browser origin when the allowlist is not configured", async () => {
    delete process.env.CORS_ALLOWED_ORIGINS;
    delete Module._cache[CONFIG_PATH];

    const res = await request(createApp())
      .get("/api/ping")
      .set("Origin", ALLOWED_ORIGIN);

    expect(res.status).toBe(403);
  });

  it("allows requests without an Origin header (server to server: Twilio, curl, cron)", async () => {
    process.env.CORS_ALLOWED_ORIGINS = ALLOWED_ORIGIN;
    delete Module._cache[CONFIG_PATH];

    const res = await request(createApp()).get("/api/ping");

    expect(res.status).toBe(200);
  });

  it("allows any origin when the allowlist holds the wildcard", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "*";
    delete Module._cache[CONFIG_PATH];

    const res = await request(createApp())
      .get("/api/ping")
      .set("Origin", BLOCKED_ORIGIN);

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(BLOCKED_ORIGIN);
  });
});
