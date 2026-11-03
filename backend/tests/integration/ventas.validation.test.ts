// Tests added for price validation RED
// Run with: npm run test:run -- ventas.validation.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Module from "module";
import path from "path";
import request from "supertest";
import { getBackendRoot } from "../helpers/paths";

declare module "module" {
  interface Module {
    _cache: Record<string, NodeModule | undefined>;
  }
}

const PROJECT_ROOT = getBackendRoot();
const FIRESTORE_PATH = path.resolve(PROJECT_ROOT, "src/lib/firestore.js");
const INTURIS_PATH = path.resolve(PROJECT_ROOT, "src/brain/inturis.js");
const VENTAS_SERVICE_PATH = path.resolve(PROJECT_ROOT, "src/services/ventas.service.js");
const VENTAS_REPO_PATH = path.resolve(PROJECT_ROOT, "src/repositories/ventas.repository.js");
const VENTAS_ROUTE_PATH = path.resolve(PROJECT_ROOT, "src/routes/ventas.js");

interface MockRefs {
  clientesSnapshot: any;
  productosDocRef: any;
  ventasSet: ReturnType<typeof vi.fn>;
  pedidoMesSet: ReturnType<typeof vi.fn>;
  pedidosGet: ReturnType<typeof vi.fn>;
  crearPedidoSet: ReturnType<typeof vi.fn>;
}

let mockRefs: MockRefs;

function createApp() {
  const express = require("express");
  const app = express();
  app.use(express.json());
  app.use("/api/ventas", require("../../src/routes/ventas"));
  return app;
}

function createMockDb() {
  const ventasSet = vi.fn().mockResolvedValue(undefined);
  const pedidoMesSet = vi.fn().mockResolvedValue(undefined);
  const pedidosGet = vi.fn();
  const crearPedidoSet = vi.fn().mockResolvedValue(undefined);
  const pedidoDocRef = { set: crearPedidoSet, get: vi.fn() };
  const pedidosCollectionRef = {
    doc: vi.fn(() => pedidoDocRef),
    get: pedidosGet,
  };
  const mesDocRef = {
    collection: vi.fn(() => pedidosCollectionRef),
    set: pedidoMesSet,
  };
  const mesesCollectionRef = { doc: vi.fn(() => mesDocRef) };
  const ventaDocRef = {
    collection: vi.fn(() => mesesCollectionRef),
    set: ventasSet,
    get: vi.fn(),
  };
  const ventasCollectionRef = { doc: vi.fn(() => ventaDocRef), get: vi.fn() };
  const defaultProductoDocRef = { get: vi.fn(), set: vi.fn() };
  const defaultSubRef = {
    limit: vi.fn(() => ({ get: vi.fn() })),
    doc: vi.fn(() => defaultProductoDocRef),
    get: vi.fn(),
  };
  const productosDocRef = { collection: vi.fn(() => defaultSubRef) };
  const productosCollectionRef = { doc: vi.fn(() => productosDocRef), get: vi.fn() };
  const clientesSnapshot = { forEach: vi.fn(), docs: [], empty: true };
  const clientesCollectionRef = { get: vi.fn().mockResolvedValue(clientesSnapshot), doc: vi.fn() };

  const mockDb = {
    collection: vi.fn((name: string) => {
      if (name === "Clientes") return clientesCollectionRef;
      if (name === "Ventas") return ventasCollectionRef;
      if (name === "Productos") return productosCollectionRef;
      return { doc: vi.fn(), get: vi.fn(), collection: vi.fn() };
    }),
  };

  return { mockDb, refs: { clientesSnapshot, productosDocRef, ventasSet, pedidoMesSet, pedidosGet, crearPedidoSet } };
}

function setupClientFound(clienteId = "Cliente_1", nombre = "Test") {
  const mockClienteDoc = { id: clienteId, data: () => ({ Nombre: nombre }) };
  mockRefs.clientesSnapshot.forEach = vi.fn((cb: any) => cb(mockClienteDoc));
}

function setupProductosMiel(subcollectionExists: boolean, productExists: boolean, price = 50000) {
  const subSnapshot = subcollectionExists
    ? { empty: false, docs: [{ id: "Miel_1" }], forEach: vi.fn() }
    : { empty: true, docs: [], forEach: vi.fn() };
  const docSnapshot = productExists
    ? { exists: true, data: () => ({ "Precio carton": price }), id: "Miel_1" }
    : { exists: false, data: () => null, id: "Miel_1" };
  const mielSubRef = {
    limit: vi.fn(() => ({ get: vi.fn().mockResolvedValue(subSnapshot) })),
    doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue(docSnapshot) })),
  };
  mockRefs.productosDocRef.collection = vi.fn((name: string) => {
    if (name === "Miel") return mielSubRef;
    return {
      limit: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ empty: true, docs: [] }) })),
      doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: false, data: () => null }) })),
    };
  });
}

describe("Price Validation - producto_sin_precio", () => {
  beforeEach(() => {
    process.env.INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || "test-internal-token";
    vi.resetAllMocks();
    const built = createMockDb();
    mockRefs = built.refs;
    Module._cache[FIRESTORE_PATH] = { exports: built.mockDb, loaded: true } as any;
    Module._cache[INTURIS_PATH] = { exports: { interpretarPedido: vi.fn() }, loaded: true } as any;
    [VENTAS_REPO_PATH, VENTAS_SERVICE_PATH, VENTAS_ROUTE_PATH].forEach((p) => { delete Module._cache[p]; });
  });

  afterEach(() => {
    [FIRESTORE_PATH, INTURIS_PATH, VENTAS_SERVICE_PATH].forEach((p) => { delete Module._cache[p]; });
    vi.restoreAllMocks();
  });

  it("returns 400 with error 'producto_sin_precio' when product price is 0", async () => {
    setupClientFound();
    Module._cache[INTURIS_PATH].exports.interpretarPedido = vi.fn().mockResolvedValue([{ producto: "Miel", cantidad: 2 }]);
    setupProductosMiel(true, true, 0);
    mockRefs.pedidosGet.mockResolvedValue({ docs: [], forEach: vi.fn(), empty: true });
    const app = createApp();
    const res = await request(app)
      .post("/api/ventas/pedido-libre")
      .set("x-internal-token", process.env.INTERNAL_API_TOKEN || "test-internal-token")
      .send({ cliente: "Test", mensaje: "2 miel" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("producto_sin_precio");
    expect(res.body.detalle).toBe("Miel");
  });

  it("returns 400 with error 'producto_sin_precio' when product has no price field", async () => {
    setupClientFound();
    Module._cache[INTURIS_PATH].exports.interpretarPedido = vi.fn().mockResolvedValue([{ producto: "Miel", cantidad: 2 }]);
    // Producto sin campo Precio carton
    const docSnapshot = { exists: true, data: () => ({ Nombre: "Miel" }), id: "Miel_1" };
    const mielSubRef = {
      limit: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ empty: false, docs: [{ id: "Miel_1" }], forEach: vi.fn() }) })),
      doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue(docSnapshot) })),
    };
    mockRefs.productosDocRef.collection = vi.fn((name: string) => {
      if (name === "Miel") return mielSubRef;
      return { limit: vi.fn(), doc: vi.fn() };
    });
    mockRefs.pedidosGet.mockResolvedValue({ docs: [], forEach: vi.fn(), empty: true });
    const app = createApp();
    const res = await request(app)
      .post("/api/ventas/pedido-libre")
      .set("x-internal-token", process.env.INTERNAL_API_TOKEN || "test-internal-token")
      .send({ cliente: "Test", mensaje: "2 miel" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("producto_sin_precio");
  });
});