import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Module from "module";
import path from "path";
import request from "supertest";

// Module augmentation for Module._cache
declare module "module" {
  interface Module {
    _cache: Record<string, NodeModule | undefined>;
  }
}

// ── Paths for Module._cache injection ──
const PROJECT_ROOT = process.cwd();
const FIRESTORE_PATH = path.resolve(PROJECT_ROOT, "src/lib/firestore.js");
const INTURIS_PATH = path.resolve(PROJECT_ROOT, "src/brain/inturis.js");
const VENTAS_REPO_PATH = path.resolve(
  PROJECT_ROOT,
  "src/repositories/ventas.repository.js",
);
const PRODUCTOS_REPO_PATH = path.resolve(
  PROJECT_ROOT,
  "src/repositories/productos.repository.js",
);
const VENTAS_ROUTE_PATH = path.resolve(PROJECT_ROOT, "src/routes/ventas.js");

// ── Shared mock state ──
let mockDb: any;
let mockInterpretarPedido: any;

// ── Terminal mock references (set via createMockDb) ──
interface MockRefs {
  clientesSnapshot: any;
  productosDocRef: any;
  ventasSet: ReturnType<typeof vi.fn>;
  pedidoMesSet: ReturnType<typeof vi.fn>;
  pedidosGet: ReturnType<typeof vi.fn>;
  crearPedidoSet: ReturnType<typeof vi.fn>;
}

let mockRefs: MockRefs;

// ── Helper: inline Express app (no production code modified) ──
function createApp() {
  const express = require("express");
  const app = express();
  app.use(express.json());
  app.use("/api/ventas", require("../../src/routes/ventas"));
  return app;
}

// ── Helper: build a full chainable Firestore mock ──
function createMockDb(): { mockDb: any; refs: MockRefs } {
  // Terminal mocks — these are what we assert on
  const ventasSet = vi.fn().mockResolvedValue(undefined);
  const pedidoMesSet = vi.fn().mockResolvedValue(undefined);
  const pedidosGet = vi.fn();
  const crearPedidoSet = vi.fn().mockResolvedValue(undefined);

  // ── Ventas chain ──
  // db.collection("Ventas").doc(id)                → ventaDocRef
  //   .set(data)                                    → ventasSet
  //   .collection("Pedidos").doc(mesAnio)           → mesDocRef
  //     .set(data)                                  → pedidoMesSet
  //     .collection("pedidos")                      → pedidosCollectionRef
  //       .get()                                    → pedidosGet
  //       .doc(pedidoId)                            → pedidoDocRef
  //         .set(data)                              → crearPedidoSet

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

  // ── Productos chain ──
  // db.collection("Productos").doc("Productos_ID")  → productosDocRef
  //   .collection(nombre)                           → defaultSubRef (overridable)
  //     .limit(1).get()                             → subcollection snapshot (buscarSubcoleccion)
  //     .doc(id).get()                              → product doc snapshot (getProducto)

  const defaultProductoDocRef = { get: vi.fn(), set: vi.fn() };

  const defaultSubRef = {
    limit: vi.fn(() => ({ get: vi.fn() })),
    doc: vi.fn(() => defaultProductoDocRef),
    get: vi.fn(),
  };

  const productosDocRef = {
    collection: vi.fn(() => defaultSubRef),
  };

  const productosCollectionRef = {
    doc: vi.fn(() => productosDocRef),
    get: vi.fn(),
  };

  // ── Clientes chain ──
  const clientesSnapshot = {
    forEach: vi.fn(),
    docs: [] as any[],
    empty: true,
  };

  const clientesCollectionRef = {
    get: vi.fn().mockResolvedValue(clientesSnapshot),
    doc: vi.fn(),
  };

  // ── Root mockDb ──
  const mockDb = {
    collection: vi.fn((name: string) => {
      if (name === "Clientes") return clientesCollectionRef;
      if (name === "Ventas") return ventasCollectionRef;
      if (name === "Productos") return productosCollectionRef;
      return { doc: vi.fn(), get: vi.fn(), collection: vi.fn() };
    }),
  };

  return {
    mockDb,
    refs: {
      clientesSnapshot,
      productosDocRef,
      ventasSet,
      pedidoMesSet,
      pedidosGet,
      crearPedidoSet,
    },
  };
}

// ── Helper: configure Clientes snapshot to find a client ──
function setupClientFound(clienteId = "Cliente_1", nombre = "Test") {
  const mockClienteDoc = {
    id: clienteId,
    data: () => ({ Nombre: nombre }),
  };
  mockRefs.clientesSnapshot.forEach = vi.fn(
    (cb: (doc: any) => void) => cb(mockClienteDoc),
  );
}

// ── Helper: configure Productos chain for "Miel" subcollection ──
function setupProductosMiel(
  subcollectionExists: boolean,
  productExists: boolean,
  price = 50000,
) {
  const subSnapshot = subcollectionExists
    ? { empty: false, docs: [{ id: "Miel_1" }], forEach: vi.fn() }
    : { empty: true, docs: [], forEach: vi.fn() };

  const docSnapshot = productExists
    ? { exists: true, data: () => ({ "Precio carton": price }), id: "Miel_1" }
    : { exists: false, data: () => null, id: "Miel_1" };

  const mielSubRef = {
    limit: vi.fn(() => ({
      get: vi.fn().mockResolvedValue(subSnapshot),
    })),
    doc: vi.fn(() => ({
      get: vi.fn().mockResolvedValue(docSnapshot),
    })),
  };

  mockRefs.productosDocRef.collection = vi.fn((name: string) => {
    if (name === "Miel") return mielSubRef;
    // Return a safe default for other subcollection names
    return {
      limit: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ empty: true, docs: [] }) })),
      doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: false, data: () => null }) })),
    };
  });
}

// ═══════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════

describe("POST /api/ventas/pedido-libre", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    const built = createMockDb();
    mockDb = built.mockDb;
    mockRefs = built.refs;

    mockInterpretarPedido = vi.fn();

    // Inject mocks into Module._cache so fresh require() picks them up
    Module._cache[FIRESTORE_PATH] = { exports: mockDb, loaded: true } as any;
    Module._cache[INTURIS_PATH] = {
      exports: { interpretarPedido: mockInterpretarPedido },
      loaded: true,
    } as any;

    // Clear cached repos and route so they re-require mocked deps
    [VENTAS_REPO_PATH, PRODUCTOS_REPO_PATH, VENTAS_ROUTE_PATH].forEach((p) => {
      delete Module._cache[p];
    });
  });

  afterEach(() => {
    [FIRESTORE_PATH, INTURIS_PATH].forEach((p) => {
      delete Module._cache[p];
    });
    vi.restoreAllMocks();
  });

  // ──────────────────────────────────────────────────────────
  // Phase 2, Task 2.1 — Validation scenarios
  // ──────────────────────────────────────────────────────────

  describe("validation", () => {
    it("returns 400 cliente_requerido when cliente is absent", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/ventas/pedido-libre")
        .send({ mensaje: "2 miel" });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "cliente_requerido" });
    });

    it("returns 400 mensaje_requerido when mensaje is absent", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/ventas/pedido-libre")
        .send({ cliente: "Test" });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "mensaje_requerido" });
    });

    it("returns 400 mensaje_requerido when mensaje is empty string", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/ventas/pedido-libre")
        .send({ cliente: "Test", mensaje: "" });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "mensaje_requerido" });
    });
  });

  // ──────────────────────────────────────────────────────────
  // Phase 2, Task 2.2 — Client not found
  // ──────────────────────────────────────────────────────────

  describe("client lookup", () => {
    it("returns 404 cliente_no_encontrado when client is not found in Firestore", async () => {
      // clientesSnapshot.forEach is a no-op → no client found
      mockRefs.clientesSnapshot.forEach = vi.fn();

      const app = createApp();
      const res = await request(app)
        .post("/api/ventas/pedido-libre")
        .send({ cliente: "NoExiste", mensaje: "2 miel" });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("cliente_no_encontrado");
    });
  });

  // ──────────────────────────────────────────────────────────
  // Phase 2, Task 2.3 — No interpreted products
  // ──────────────────────────────────────────────────────────

  describe("product interpretation", () => {
    it("returns 400 ningun_producto_identificado when interpretarPedido returns empty", async () => {
      setupClientFound();

      mockInterpretarPedido.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app)
        .post("/api/ventas/pedido-libre")
        .send({ cliente: "Test", mensaje: "algo que no se entiende" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("ningun_producto_identificado");
    });
  });

  // ──────────────────────────────────────────────────────────
  // Phase 2, Task 2.4 — Product not found in Firestore
  // ──────────────────────────────────────────────────────────

  describe("product lookup", () => {
    it("returns 400 producto_no_encontrado when a product document is missing", async () => {
      setupClientFound();

      mockInterpretarPedido.mockResolvedValue([
        { producto: "Miel", cantidad: 2 },
      ]);

      // Subcollection exists (doc found) but product document itself is missing
      setupProductosMiel(true, false);

      const app = createApp();
      const res = await request(app)
        .post("/api/ventas/pedido-libre")
        .send({ cliente: "Test", mensaje: "2 miel" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("producto_no_encontrado");
    });
  });

  // ──────────────────────────────────────────────────────────
  // Phase 2, Task 2.5 — Happy path
  // ──────────────────────────────────────────────────────────

  describe("happy path", () => {
    it("creates a pedido and returns 200 with full response", async () => {
      setupClientFound();

      mockInterpretarPedido.mockResolvedValue([
        { producto: "Miel", cantidad: 2 },
      ]);

      // Product exists with a valid price
      setupProductosMiel(true, true, 50000);

      // getPedidos returns empty → first pedido → Pedido_Id1
      mockRefs.pedidosGet.mockResolvedValue({
        docs: [],
        forEach: vi.fn(),
        empty: true,
      });

      const app = createApp();
      const res = await request(app)
        .post("/api/ventas/pedido-libre")
        .send({ cliente: "Test", mensaje: "2 miel" });

      expect(res.status).toBe(200);

      // Verify response body shape per spec
      expect(res.body).toMatchObject({
        pedidoId: "Pedido_Id1",
        clienteId: "Cliente_1",
        clienteNombre: "Test",
        tipoPedido: "libre",
        estadoContable: "pendiente",
      });
      expect(res.body.total).toBe(100000);

      // Verify Firestore methods were called
      expect(mockRefs.ventasSet).toHaveBeenCalled();
      expect(mockRefs.pedidoMesSet).toHaveBeenCalled();
      expect(mockRefs.pedidosGet).toHaveBeenCalled();
      expect(mockRefs.crearPedidoSet).toHaveBeenCalled();
    });
  });
});
