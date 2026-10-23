import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import crypto from "crypto";
import Module from "module";
import path from "path";
import { getBackendRoot } from "../../helpers/paths";

// Module augmentation for Module._cache
declare module "module" {
  interface Module {
    _cache: Record<string, NodeModule | undefined>;
  }
}

// ── Module paths ────────────────────────────────────────────────────────
const PROJECT_ROOT = getBackendRoot();
const CONFIG_PATH = path.resolve(PROJECT_ROOT, "src/config.js");
const ADMIN_REPO_PATH = path.resolve(PROJECT_ROOT, "src/repositories/admin.repository.js");
const INTURIS_PATH = path.resolve(PROJECT_ROOT, "src/brain/inturis.js");
const WHATSAPP_PATH = path.resolve(PROJECT_ROOT, "src/whatsapp/index.js");

// ── Mocks ───────────────────────────────────────────────────────────────
// Same injection pattern as webhook.security.test.ts: the Twilio SDK is not
// mocked, the payload is signed with Twilio's own algorithm so the real
// signature validation runs end to end.
const getAdminByTelefonoMock = vi.fn();
const procesarMensajeTwilioMock = vi.fn();

const AUTH_TOKEN = "test-auth-token";
const WEBHOOK_URL = "http://127.0.0.1/api/whatsapp/webhook";

const ADMIN_ERIC = "+573138861417";
const ADMIN_JULY = "+573213413474";

/** Small budget so the limit is reachable without 60 requests per test. */
const RATE_LIMIT_MAX = "2";
const RATE_LIMIT_WINDOW_MS = "900000";

/** Twilio signature algorithm: HMAC-SHA1(url + sorted params) → base64. */
function signParams(
  params: Record<string, string>,
  url: string = WEBHOOK_URL,
  authToken: string = AUTH_TOKEN,
) {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);

  return crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
}

function createApp() {
  const express = require("express");
  const app = express();
  app.use("/api/whatsapp", require(WHATSAPP_PATH));
  return app;
}

function adminSnapshot() {
  return {
    empty: false,
    docs: [
      {
        data: () => ({ Nombre: "Eric", Telefono: ADMIN_ERIC }),
      },
    ],
  };
}

function post(body: Record<string, string>, signature?: string) {
  const req = request(createApp())
    .post("/api/whatsapp/webhook")
    .set("Host", "127.0.0.1")
    .type("form")
    .send(body);

  if (signature !== undefined) {
    req.set("X-Twilio-Signature", signature);
  }

  return req;
}

describe("POST /api/whatsapp/webhook — rate limiting (S4)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
    process.env.ADMIN_ALLOWED_NUMBERS = [ADMIN_ERIC, ADMIN_JULY].join(",");
    process.env.RATE_LIMIT_MAX = RATE_LIMIT_MAX;
    process.env.RATE_LIMIT_WINDOW_MS = RATE_LIMIT_WINDOW_MS;

    getAdminByTelefonoMock.mockResolvedValue(adminSnapshot());
    procesarMensajeTwilioMock.mockResolvedValue({ pedidoRegistrado: true });

    Module._cache[ADMIN_REPO_PATH] = {
      exports: {
        getAdminByTelefono: (...args: any[]) => getAdminByTelefonoMock(...args),
        normalizarTelefono: (telefono: string) => String(telefono || "").replace(/\D/g, ""),
      },
    } as any;

    Module._cache[INTURIS_PATH] = {
      exports: {
        procesarMensajeTwilio: (...args: any[]) => procesarMensajeTwilioMock(...args),
      },
    } as any;

    // Fresh config (new RATE_LIMIT_MAX) and a fresh router so it builds a
    // fresh limiter with its own in-memory budget.
    delete Module._cache[CONFIG_PATH];
    delete Module._cache[WHATSAPP_PATH];
  });

  afterEach(() => {
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.ADMIN_ALLOWED_NUMBERS;
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.RATE_LIMIT_WINDOW_MS;
    delete Module._cache[CONFIG_PATH];
    delete Module._cache[ADMIN_REPO_PATH];
    delete Module._cache[INTURIS_PATH];
    delete Module._cache[WHATSAPP_PATH];
  });

  it("allows requests up to the configured maximum", async () => {
    const body = { From: ADMIN_ERIC, Body: "2 miel" };

    const first = await post(body, signParams(body));
    const second = await post(body, signParams(body));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(procesarMensajeTwilioMock).toHaveBeenCalledTimes(2);
  });

  it("returns 429 once the maximum is exceeded", async () => {
    const body = { From: ADMIN_ERIC, Body: "2 miel" };

    await post(body, signParams(body));
    await post(body, signParams(body));
    const third = await post(body, signParams(body));

    expect(third.status).toBe(429);
    expect(third.body).toEqual({ error: "too_many_requests" });
    // The rejected request never reached the order pipeline.
    expect(procesarMensajeTwilioMock).toHaveBeenCalledTimes(2);
  });

  it("keeps a separate budget per admin sender", async () => {
    const ericBody = { From: ADMIN_ERIC, Body: "2 miel" };
    const julyBody = { From: ADMIN_JULY, Body: "2 miel" };

    await post(ericBody, signParams(ericBody));
    await post(ericBody, signParams(ericBody));
    const ericThird = await post(ericBody, signParams(ericBody));

    const julyFirst = await post(julyBody, signParams(julyBody));

    expect(ericThird.status).toBe(429);
    expect(julyFirst.status).toBe(200);
  });

  it("does not consume budget for requests rejected before the limiter", async () => {
    const body = { From: ADMIN_ERIC, Body: "2 miel" };

    // Bad signature → rejected by validateTwilioSignature, before the limiter.
    for (let i = 0; i < 3; i++) {
      const rejected = await post(body, "invalid-signature");
      expect(rejected.status).toBe(403);
    }

    const accepted = await post(body, signParams(body));

    expect(accepted.status).toBe(200);
    expect(procesarMensajeTwilioMock).toHaveBeenCalledTimes(1);
  });
});
