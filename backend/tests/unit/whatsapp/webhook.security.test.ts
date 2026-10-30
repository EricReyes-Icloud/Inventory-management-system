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

// ── Module paths (same injection pattern as routes/ventas.test.ts) ──────
const PROJECT_ROOT = getBackendRoot();
const CONFIG_PATH = path.resolve(PROJECT_ROOT, "src/config.js");
const ADMIN_REPO_PATH = path.resolve(PROJECT_ROOT, "src/repositories/admin.repository.js");
const INTURIS_PATH = path.resolve(PROJECT_ROOT, "src/brain/inturis.js");
const WHATSAPP_PATH = path.resolve(PROJECT_ROOT, "src/whatsapp/index.js");
const CLIENT_CACHE_PATH = path.resolve(PROJECT_ROOT, "src/services/clientCache.service.js");

// ── Mocks ───────────────────────────────────────────────────────────────
// The Twilio SDK is NOT mocked: the webhook validates real signatures, so
// the test signs the payload with the same algorithm Twilio uses
// (HMAC-SHA1 over url + sorted params, base64) and lets the SDK verify it.

const getAdminByTelefonoMock = vi.fn();
const procesarMensajeTwilioMock = vi.fn();

const AUTH_TOKEN = "test-auth-token";
const WEBHOOK_URL = "http://127.0.0.1/api/whatsapp/webhook";

const ADMIN_ERIC = "+573138861417";
const ADMIN_JULY = "+573213413474";
const ADMIN_EDWIN = "+573203648967";
const NOT_ALLOWED = "+573001234567";

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

describe("POST /api/whatsapp/webhook — security", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
    // The allowlist is read from config at router load time, so it must be
    // set before the router is required.
    process.env.ADMIN_ALLOWED_NUMBERS = [ADMIN_ERIC, ADMIN_JULY, ADMIN_EDWIN].join(",");

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

    // Mock clientCache to avoid real Firestore calls during tests.
    Module._cache[CLIENT_CACHE_PATH] = {
      exports: {
        getNombresClients: vi.fn().mockResolvedValue([]),
        invalidateCache: vi.fn(),
        CLIENT_TTL_MS: 300000,
      },
    } as any;

    // Fresh config (new ADMIN_ALLOWED_NUMBERS) and a fresh router instance so
    // it picks up the injected modules.
    delete Module._cache[CONFIG_PATH];
    delete Module._cache[WHATSAPP_PATH];
  });

  afterEach(() => {
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.ADMIN_ALLOWED_NUMBERS;
    delete Module._cache[CONFIG_PATH];
    delete Module._cache[ADMIN_REPO_PATH];
    delete Module._cache[INTURIS_PATH];
    delete Module._cache[WHATSAPP_PATH];
    delete Module._cache[CLIENT_CACHE_PATH];
  });

  // ── S1: Twilio signature validation ──────────────────────────────────
  describe("S1 — Twilio signature", () => {
    it("rejects a request without X-Twilio-Signature", async () => {
      const res = await post({ From: ADMIN_ERIC, Body: "2 miel" });

      expect(res.status).toBe(403);
      expect(procesarMensajeTwilioMock).not.toHaveBeenCalled();
    });

    it("rejects a request with an invalid signature", async () => {
      const body = { From: ADMIN_ERIC, Body: "2 miel" };

      const res = await post(body, "invalid-signature");

      expect(res.status).toBe(403);
      expect(procesarMensajeTwilioMock).not.toHaveBeenCalled();
    });

    it("rejects a signature computed for a different body", async () => {
      const signature = signParams({ From: ADMIN_ERIC, Body: "2 miel" });

      const res = await post({ From: ADMIN_ERIC, Body: "10 clavos" }, signature);

      expect(res.status).toBe(403);
      expect(procesarMensajeTwilioMock).not.toHaveBeenCalled();
    });

    it("rejects every request when TWILIO_AUTH_TOKEN is not configured", async () => {
      delete process.env.TWILIO_AUTH_TOKEN;

      const body = { From: ADMIN_ERIC, Body: "2 miel" };
      const res = await post(body, signParams(body));

      expect(res.status).toBe(403);
      expect(procesarMensajeTwilioMock).not.toHaveBeenCalled();
    });

    it("accepts a request with a valid signature from an allowed admin", async () => {
      const body = { From: ADMIN_ERIC, Body: "2 miel" };

      const res = await post(body, signParams(body));

      expect(res.status).toBe(200);
      expect(procesarMensajeTwilioMock).toHaveBeenCalled();
    });
  });

  // ── S2: admin phone allowlist ────────────────────────────────────────
  describe("S2 — admin phone allowlist", () => {
    it("rejects a sender that is not in the allowlist", async () => {
      const body = { From: NOT_ALLOWED, Body: "2 miel" };

      const res = await post(body, signParams(body));

      expect(res.status).toBe(403);
      expect(getAdminByTelefonoMock).not.toHaveBeenCalled();
      expect(procesarMensajeTwilioMock).not.toHaveBeenCalled();
    });

    it("rejects a sender that exists as admin in Firestore but is not in ADMIN_ALLOWED_NUMBERS", async () => {
      // The repo mock still returns an admin document: the env allowlist gate
      // must run first and reject the sender before Firestore is consulted.
      const body = { From: NOT_ALLOWED, Body: "2 miel" };

      const res = await post(body, signParams(body));

      expect(res.status).toBe(403);
      expect(getAdminByTelefonoMock).not.toHaveBeenCalled();
      expect(procesarMensajeTwilioMock).not.toHaveBeenCalled();
    });

    it("fails closed when ADMIN_ALLOWED_NUMBERS is not configured", async () => {
      delete process.env.ADMIN_ALLOWED_NUMBERS;
      delete Module._cache[CONFIG_PATH];
      delete Module._cache[WHATSAPP_PATH];

      const body = { From: ADMIN_ERIC, Body: "2 miel" };
      const res = await post(body, signParams(body));

      expect(res.status).toBe(403);
      expect(procesarMensajeTwilioMock).not.toHaveBeenCalled();
    });

    it("rejects an allowlisted number that is not registered as admin", async () => {
      getAdminByTelefonoMock.mockResolvedValue({ empty: true, docs: [] });

      const body = { From: ADMIN_ERIC, Body: "2 miel" };
      const res = await post(body, signParams(body));

      expect(res.status).toBe(403);
      expect(procesarMensajeTwilioMock).not.toHaveBeenCalled();
    });

    it("accepts each of the three authorized admin numbers", async () => {
      for (const admin of [ADMIN_ERIC, ADMIN_JULY, ADMIN_EDWIN]) {
        const body = { From: admin, Body: "2 miel" };
        const res = await post(body, signParams(body));

        expect(res.status).toBe(200);
      }

      expect(procesarMensajeTwilioMock).toHaveBeenCalledTimes(3);
    });

    it("normalizes the sender to E.164 before matching the allowlist", async () => {
      const body = { From: "whatsapp:+57 313 886 1417", Body: "2 miel" };

      const res = await post(body, signParams(body));

      expect(res.status).toBe(200);
      expect(getAdminByTelefonoMock).toHaveBeenCalledWith("+573138861417");
    });

    it("rejects a request without a From field", async () => {
      const body = { Body: "2 miel" };
      const res = await post(body, signParams(body));

      expect(res.status).toBe(403);
      expect(procesarMensajeTwilioMock).not.toHaveBeenCalled();
    });
  });
});
