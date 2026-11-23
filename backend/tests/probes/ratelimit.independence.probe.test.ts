// Probe: the login limiter owns its own budget (does not starve order endpoints).
import { describe, it, expect } from "vitest";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");
process.env.RATE_LIMIT_MAX = "2";

describe("probe: login limiter isolation", () => {
  it("L1 exhausting the login limiter does not consume the order limiter budget", async () => {
    delete (require.cache as any)[path.resolve(ROOT, "src/config.js")];
    const { createLoginRateLimiter, createPedidoLibreRateLimiter } = require(
      path.resolve(ROOT, "src/middlewares/rateLimit.js")
    );
    const express = require("express");
    const request = require("supertest");
    const app = express();
    app.post("/login", createLoginRateLimiter(), (_q: any, r: any) => r.status(200).json({ ok: "login" }));
    app.post("/pedido", createPedidoLibreRateLimiter(), (_q: any, r: any) => r.status(200).json({ ok: "pedido" }));

    const l1 = await request(app).post("/login");
    const l2 = await request(app).post("/login");
    const l3 = await request(app).post("/login");
    expect([l1.status, l2.status, l3.status]).toEqual([200, 200, 429]);

    const p1 = await request(app).post("/pedido");
    const p2 = await request(app).post("/pedido");
    expect([p1.status, p2.status]).toEqual([200, 200]);
    expect(p1.body).toEqual({ ok: "pedido" });
  });
});
