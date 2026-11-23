import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import Module from "module";
import path from "path";
import { getBackendRoot } from "../../helpers/paths";

declare module "module" {
  interface Module {
    _cache: Record<string, NodeModule | undefined>;
  }
}

/** T2 / S2: the login endpoint owns its own IP-keyed rate limiter. */

const PROJECT_ROOT = getBackendRoot();
const CONFIG_PATH = path.resolve(PROJECT_ROOT, "src/config.js");
const RATE_LIMIT_PATH = path.resolve(PROJECT_ROOT, "src/middlewares/rateLimit.js");

beforeEach(() => {
  Module._cache[CONFIG_PATH] = {
    exports: { rateLimit: { windowMs: 60_000, max: 2 } },
  } as any;
  delete Module._cache[RATE_LIMIT_PATH];
});

afterEach(() => {
  delete Module._cache[CONFIG_PATH];
  delete Module._cache[RATE_LIMIT_PATH];
});

function createApp() {
  const express = require("express");
  const { createLoginRateLimiter } = require("../../../src/middlewares/rateLimit");
  const app = express();
  app.set("trust proxy", 1);
  app.post("/login", createLoginRateLimiter(), (_req: any, res: any) =>
    res.json({ ok: true })
  );
  return app;
}

describe("createLoginRateLimiter", () => {
  it("answers 429 too_many_requests after the configured budget", async () => {
    const app = createApp();
    const ip = "203.0.113.10";

    expect((await request(app).post("/login").set("X-Forwarded-For", ip)).status).toBe(200);
    expect((await request(app).post("/login").set("X-Forwarded-For", ip)).status).toBe(200);

    const blocked = await request(app).post("/login").set("X-Forwarded-For", ip);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: "too_many_requests" });
  });

  it("keeps independent buckets per client IP", async () => {
    const app = createApp();

    await request(app).post("/login").set("X-Forwarded-For", "203.0.113.20");
    await request(app).post("/login").set("X-Forwarded-For", "203.0.113.20");

    const other = await request(app)
      .post("/login")
      .set("X-Forwarded-For", "203.0.113.21");
    expect(other.status).toBe(200);
  });
});
