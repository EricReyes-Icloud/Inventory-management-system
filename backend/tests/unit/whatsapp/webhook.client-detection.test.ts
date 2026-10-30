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
const FIRESTORE_PATH = path.resolve(PROJECT_ROOT, "src/lib/firestore.js");
const CLIENT_CACHE_PATH = path.resolve(PROJECT_ROOT, "src/services/clientCache.service.js");

// ── Mocks ───────────────────────────────────────────────────────────────
const getAdminByTelefonoMock = vi.fn();
const procesarMensajeTwilioMock = vi.fn();

const AUTH_TOKEN = "test-auth-token";
const WEBHOOK_URL = "http://127.0.0.1/api/whatsapp/webhook";

const ADMIN_ERIC = "+573138861417";

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

describe("POST /api/whatsapp/webhook — client detection (dynamic cache)", () => {
  let mockCollectionGet: any;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();

    process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;
    process.env.ADMIN_ALLOWED_NUMBERS = ADMIN_ERIC;

    // Mock Firestore for clientCache
    mockCollectionGet = vi.fn();
    const mockDb = {
      collection: vi.fn((name: string) => ({
        get: mockCollectionGet,
      })),
    };
    Module._cache[FIRESTORE_PATH] = {
      exports: mockDb,
      loaded: true,
    } as any;

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

    // Fresh config and router instance so it picks up injected modules
    delete Module._cache[CONFIG_PATH];
    delete Module._cache[WHATSAPP_PATH];
    delete Module._cache[CLIENT_CACHE_PATH];
  });

  afterEach(() => {
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.ADMIN_ALLOWED_NUMBERS;
    delete Module._cache[CONFIG_PATH];
    delete Module._cache[ADMIN_REPO_PATH];
    delete Module._cache[INTURIS_PATH];
    delete Module._cache[WHATSAPP_PATH];
    delete Module._cache[FIRESTORE_PATH];
    delete Module._cache[CLIENT_CACHE_PATH];
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("detectarYRemoverCliente with dynamic client names", () => {
    it("detects a client loaded from Firestore cache and passes it to inturis", async () => {
      // Arrange: Firestore returns client names
      mockCollectionGet.mockResolvedValue({
        empty: false,
        docs: [
          { data: () => ({ Nombre: "Hernan" }), id: "1" },
          { data: () => ({ Nombre: "Mauricio" }), id: "2" },
          { data: () => ({ Nombre: "Esperanza" }), id: "3" },
          { data: () => ({ Nombre: "Edwin" }), id: "4" },
        ],
        forEach: vi.fn(),
      });

      const body = { From: ADMIN_ERIC, Body: "hernan 2 clavos de 100" };
      const res = await post(body, signParams(body));

      // Assert
      expect(res.status).toBe(200);
      expect(procesarMensajeTwilioMock).toHaveBeenCalledTimes(1);

      const [, , clienteDetectado] = procesarMensajeTwilioMock.mock.calls[0];
      expect(clienteDetectado).toBe("hernan");
    });

    it("prefers longer name match over shorter (length-descending precedence)", async () => {
      // Arrange: Firestore returns "juan" and "juan carlos"
      mockCollectionGet.mockResolvedValue({
        empty: false,
        docs: [
          { data: () => ({ Nombre: "Juan" }), id: "1" },
          { data: () => ({ Nombre: "Juan Carlos" }), id: "2" },
        ],
        forEach: vi.fn(),
      });

      const body = { From: ADMIN_ERIC, Body: "juan carlos 5 ajies" };
      const res = await post(body, signParams(body));

      expect(res.status).toBe(200);
      const [, , clienteDetectado] = procesarMensajeTwilioMock.mock.calls[0];
      expect(clienteDetectado).toBe("juan carlos");
    });

    it("handles tildes/accents correctly in client names", async () => {
      // Arrange: Firestore returns names with accents
      mockCollectionGet.mockResolvedValue({
        empty: false,
        docs: [
          { data: () => ({ Nombre: "José" }), id: "1" },
          { data: () => ({ Nombre: "Peña" }), id: "2" },
        ],
        forEach: vi.fn(),
      });

      const body = { From: ADMIN_ERIC, Body: "jose 3 miel" };
      const res = await post(body, signParams(body));

      expect(res.status).toBe(200);
      const [, , clienteDetectado] = procesarMensajeTwilioMock.mock.calls[0];
      expect(clienteDetectado).toBe("jose");
    });

    it("uses word boundary so partial names don't match", async () => {
      // Arrange: Firestore returns "ed" and "edwin" — "ed" should not match "edicion"
      mockCollectionGet.mockResolvedValue({
        empty: false,
        docs: [
          { data: () => ({ Nombre: "Ed" }), id: "1" },
          { data: () => ({ Nombre: "Edwin" }), id: "2" },
        ],
        forEach: vi.fn(),
      });

      // Message with "edicion" should NOT match "ed"
      const body = { From: ADMIN_ERIC, Body: "edicion 2 clavos" };
      const res = await post(body, signParams(body));

      expect(res.status).toBe(200);
      const [, , clienteDetectado] = procesarMensajeTwilioMock.mock.calls[0];
      expect(clienteDetectado).toBeNull();
    });

    it("falls back gracefully when Firestore is empty (no client detected)", async () => {
      // Arrange: Firestore returns empty collection
      mockCollectionGet.mockResolvedValue({
        empty: true,
        docs: [],
        forEach: vi.fn(),
      });

      const body = { From: ADMIN_ERIC, Body: "hernan 2 clavos de 100" };
      const res = await post(body, signParams(body));

      // Should still process the message, just with clienteDetectado = null
      expect(res.status).toBe(200);
      const [, , clienteDetectado] = procesarMensajeTwilioMock.mock.calls[0];
      expect(clienteDetectado).toBeNull();
    });

    it("falls back gracefully when Firestore throws (no client detected)", async () => {
      // Arrange: Firestore throws
      mockCollectionGet.mockRejectedValue(new Error("Firestore unavailable"));

      const body = { From: ADMIN_ERIC, Body: "hernan 2 clavos de 100" };
      const res = await post(body, signParams(body));

      // Should still process the message
      expect(res.status).toBe(200);
      const [, , clienteDetectado] = procesarMensajeTwilioMock.mock.calls[0];
      expect(clienteDetectado).toBeNull();
    });

    it("does not crash webhook when client cache is empty and returns null", async () => {
      // Arrange: cache is empty
      mockCollectionGet.mockResolvedValue({
        empty: true,
        docs: [],
        forEach: vi.fn(),
      });

      const body = { From: ADMIN_ERIC, Body: "maria 2 clavos" };
      const res = await post(body, signParams(body));

      expect(res.status).toBe(200);
      const [, , clienteDetectado] = procesarMensajeTwilioMock.mock.calls[0];
      expect(clienteDetectado).toBeNull();
    });

    it("removes the detected client name from the message before sending to inturis", async () => {
      mockCollectionGet.mockResolvedValue({
        empty: false,
        docs: [
          { data: () => ({ Nombre: "Mauricio" }), id: "1" },
        ],
        forEach: vi.fn(),
      });

      const body = { From: ADMIN_ERIC, Body: "mauricio 10 clavos de 100" };
      const res = await post(body, signParams(body));

      expect(res.status).toBe(200);
      const [mensajeEnviado] = procesarMensajeTwilioMock.mock.calls[0];
      // The message passed to inturis should NOT contain "mauricio"
      expect(mensajeEnviado.toLowerCase()).not.toContain("mauricio");
      // But should contain the rest of the order
      expect(mensajeEnviado.toLowerCase()).toContain("10 clavos de 100");
    });
  });
});