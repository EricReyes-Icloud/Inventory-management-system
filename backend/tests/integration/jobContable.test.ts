import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import Module from "module";
import path from "path";

// Module augmentation for Module._cache (internal Node.js API)
declare module "module" {
  interface Module {
    _cache: Record<string, NodeModule | undefined>;
  }
}

// ── Path constants for Module._cache injection ──
const PROJECT_ROOT = process.cwd();
const FIRESTORE_PATH = path.resolve(PROJECT_ROOT, "src/lib/firestore.js");
const FIREBASE_FIRESTORE_PATH = path.resolve(
  PROJECT_ROOT,
  "node_modules/firebase-admin/lib/firestore/index.js",
);
const VENTAS_REPO_PATH = path.resolve(
  PROJECT_ROOT,
  "src/repositories/ventas.repository.js",
);
const CONTABILIDAD_REPO_PATH = path.resolve(
  PROJECT_ROOT,
  "src/repositories/contabilidad.repository.js",
);
const JOB_PATH = path.resolve(PROJECT_ROOT, "src/jobs/jobContableMensual.js");

// ── Types ──
interface PedidoInput {
  id: string;
  pagado: boolean;
  contabilidadAplicada: boolean;
  detalle: any[];
  fechaPedido: Date;
}

interface MockRefs {
  batchSet: ReturnType<typeof vi.fn>;
  batchUpdate: ReturnType<typeof vi.fn>;
  batchCommit: ReturnType<typeof vi.fn>;
}

// ── Module-level mutable state ──
let mockDb: any;
let mockRefs: MockRefs;
let processPendingOrders: (...args: any[]) => any;

// ═══════════════════════════════════════════════════════════════
// Mock builders
// ═══════════════════════════════════════════════════════════════

/**
 * createMockDb — returns a fresh Firestore mock object and batch refs.
 * The returned mockDb has stubs for collection, doc (passthrough), and batch.
 * Tests configure collection("Ventas") via configurarEscenario().
 */
function createMockDb(): { mockDb: any; refs: MockRefs } {
  const batchSet = vi.fn();
  const batchUpdate = vi.fn();
  const batchCommit = vi.fn().mockResolvedValue(undefined);

  const batch = { set: batchSet, update: batchUpdate, commit: batchCommit };

  const mockDb = {
    // collection is set per-test by configurarEscenario
    collection: vi.fn(),
    // passthrough: returns the ref string as-is for batch.set
    doc: vi.fn((ref: string) => ref),
    batch: vi.fn(() => batch),
  };

  return {
    mockDb,
    refs: { batchSet, batchUpdate, batchCommit },
  };
}

/**
 * Configures the Firestore mock chain for the Ventas collection.
 * Builds the full nested mock so that the real repos (ventas.repository,
 * contabilidad.repository) can traverse it:
 *
 *   collection("Ventas").get()
 *     → clientes snapshot
 *   collection("Ventas").doc(id).collection("Pedidos").get()
 *     → meses snapshot
 *   collection("Ventas").doc(id).collection("Pedidos").doc(mes)
 *     .collection("pedidos").where("estadoContable","==","pendiente").get()
 *     → pedidos snapshot { docs, empty, size }
 *
 * @param clientes — array of { id, months: { [monthKey]: PedidoInput[] } }
 */
function configurarEscenario(
  clientes: Array<{
    id: string;
    months: Record<string, PedidoInput[]>;
  }>,
) {
  mockDb.collection = vi.fn((name: string) => {
    if (name === "Ventas") {
      return {
        get: vi.fn().mockResolvedValue({
          docs: clientes.map((c) => ({ id: c.id })),
          empty: clientes.length === 0,
        }),
        doc: vi.fn((clienteId: string) => {
          const cliente = clientes.find((c) => c.id === clienteId);
          return {
            collection: vi.fn((subName: string) => {
              if (subName === "Pedidos") {
                const months = cliente?.months ?? {};
                const monthKeys = Object.keys(months);
                return {
                  get: vi.fn().mockResolvedValue({
                    docs: monthKeys.map((m) => ({ id: m })),
                    empty: monthKeys.length === 0,
                  }),
                  doc: vi.fn((mes: string) => {
                    const pedidos = months[mes] ?? [];
                    return {
                      collection: vi.fn((colName: string) => {
                        if (colName !== "pedidos") {
                          return { where: vi.fn(), get: vi.fn() };
                        }
                        return {
                          where: vi.fn(() => ({
                            get: vi.fn().mockResolvedValue({
                              docs: pedidos.map((p) => ({
                                id: p.id,
                                data: () => ({
                                  pagado: p.pagado,
                                  contabilidadAplicada: p.contabilidadAplicada,
                                  detalle: p.detalle,
                                  fechaPedido: p.fechaPedido,
                                }),
                                ref: {
                                  id: p.id,
                                  path: `Ventas/${clienteId}/Pedidos/${mes}/pedidos/${p.id}`,
                                },
                              })),
                              empty: pedidos.length === 0,
                              size: pedidos.length,
                            }),
                          })),
                        };
                      }),
                    };
                  }),
                };
              }
              return { get: vi.fn(), doc: vi.fn() };
            }),
          };
        }),
      };
    }
    // Safe default for other collections
    return { get: vi.fn(), doc: vi.fn(), collection: vi.fn() };
  });
}

// ═══════════════════════════════════════════════════════════════
// Lifecycle
// ═══════════════════════════════════════════════════════════════

beforeAll(async () => {
  // 1. Create base mockDb (collection chain is set per-test)
  const built = createMockDb();
  mockDb = built.mockDb;
  mockRefs = built.refs;

  // 2. FieldValue mock — plain functions (not vi.fn), so they survive
  //    restoreAllMocks. buildOperacionesContables uses these internally.
  const mockFieldValue = {
    increment: (n: number) => ({ _increment: n }),
    serverTimestamp: () => ({ _serverTimestamp: true }),
  };

  // 3. Inject mocks into Module._cache before any module is loaded
  Module._cache[FIRESTORE_PATH] = {
    exports: mockDb,
    loaded: true,
    id: FIRESTORE_PATH,
    paths: [],
  } as any;

  Module._cache[FIREBASE_FIRESTORE_PATH] = {
    exports: { FieldValue: mockFieldValue },
    loaded: true,
    id: FIREBASE_FIRESTORE_PATH,
    paths: [],
  } as any;

  // 4. Clear cached repos so they re-require with mocked firestore/FieldValue
  delete Module._cache[VENTAS_REPO_PATH];
  delete Module._cache[CONTABILIDAD_REPO_PATH];

  // 5. Dynamic import — the module chain now loads with mocked deps
  const jobModule = await import("../../../src/jobs/jobContableMensual");
  processPendingOrders = jobModule.processPendingOrders;
}, 30000);

beforeEach(() => {
  vi.clearAllMocks();

  // Replace mockDb methods with fresh vi.fn instances
  // The repos already hold a reference to the mockDb OBJECT (from beforeAll),
  // so mutating its methods is picked up by their closures.
  const fresh = createMockDb();
  mockRefs = fresh.refs;
  mockDb.collection = fresh.mockDb.collection;
  mockDb.doc = fresh.mockDb.doc;
  mockDb.batch = fresh.mockDb.batch;
});

afterEach(() => {
  // Clear repo cache entries so next test gets fresh require
  delete Module._cache[VENTAS_REPO_PATH];
  delete Module._cache[CONTABILIDAD_REPO_PATH];
  // restoreAllMocks is safe — FieldValue sentinels are plain functions, not vi.fn
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

const enero2026Date = new Date("2026-01-15");

const unPedidoClavo: PedidoInput = {
  id: "pedido-001",
  pagado: true,
  contabilidadAplicada: false,
  detalle: [{ nombre: "Clavo", cantidad: 2, subtotal: 5000 }],
  fechaPedido: enero2026Date,
};

const unPedidoMiel: PedidoInput = {
  id: "pedido-002",
  pagado: true,
  contabilidadAplicada: false,
  detalle: [{ nombre: "Miel", cantidad: 1, subtotal: 10000 }],
  fechaPedido: enero2026Date,
};

const unClienteConMes = (id: string, pedidos: PedidoInput[]) => ({
  id,
  months: { "Enero 2026": pedidos },
});

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

describe("processPendingOrders - integration", () => {
  describe("happy path", () => {
    // ── INT-FLOW-001 ──────────────────────────────────────────
    it("INT-FLOW-001: single client, single month, single pending paid order", async () => {
      configurarEscenario([unClienteConMes("Cliente_A", [unPedidoClavo])]);

      const result = await processPendingOrders();

      // Return value
      expect(result).toEqual({ pedidosProcesados: 1, pedidosFallidos: 0 });

      // batch.set was called (buildOperacionesContables ran with real impl)
      expect(mockRefs.batchSet).toHaveBeenCalled();
      // batch.set calls contain FieldValue sentinel objects from real impl
      const setCalls = mockRefs.batchSet.mock.calls;
      const hasIncrementSentinel = setCalls.some(
        ([_ref, data]: [any, any]) =>
          data?.total?._increment !== undefined,
      );
      expect(hasIncrementSentinel).toBe(true);

      // batch.update marks order as processed
      expect(mockRefs.batchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ id: "pedido-001" }),
        expect.objectContaining({ estadoContable: "procesado" }),
      );

      // Single commit
      expect(mockRefs.batchCommit).toHaveBeenCalledTimes(1);
    });

    // ── INT-FLOW-002 ──────────────────────────────────────────
    it("INT-FLOW-002: two clients, one order each", async () => {
      configurarEscenario([
        unClienteConMes("Cliente_A", [unPedidoClavo]),
        unClienteConMes("Cliente_B", [unPedidoMiel]),
      ]);

      const result = await processPendingOrders();

      expect(result).toEqual({ pedidosProcesados: 2, pedidosFallidos: 0 });

      // Each order gets its own batch commit (job loops per pedido)
      expect(mockRefs.batchCommit).toHaveBeenCalledTimes(2);

      // Both orders marked as processed
      expect(mockRefs.batchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ id: "pedido-001" }),
        expect.objectContaining({ estadoContable: "procesado" }),
      );
      expect(mockRefs.batchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ id: "pedido-002" }),
        expect.objectContaining({ estadoContable: "procesado" }),
      );
    });

    // ── INT-EDGE-004 ──────────────────────────────────────────
    it("INT-EDGE-004: two product items, verify FieldValue.increment sentinels", async () => {
      const pedidoConDosItems: PedidoInput = {
        id: "pedido-multi",
        pagado: true,
        contabilidadAplicada: false,
        detalle: [
          { nombre: "Clavo", cantidad: 2, subtotal: 5000 },
          { nombre: "Miel", cantidad: 1, subtotal: 10000 },
        ],
        fechaPedido: enero2026Date,
      };

      configurarEscenario([
        unClienteConMes("Cliente_A", [pedidoConDosItems]),
      ]);

      const result = await processPendingOrders();

      expect(result).toEqual({ pedidosProcesados: 1, pedidosFallidos: 0 });

      // batch.set was called multiple times (main docs + 6 per item = 14)
      expect(mockRefs.batchSet.mock.calls.length).toBeGreaterThan(10);

      // At least one call has subtotal increment sentinel
      const subtotalSentinels = mockRefs.batchSet.mock.calls.filter(
        ([_ref, data]: [any, any]) => data?.total?._increment === 5000,
      );
      expect(subtotalSentinels.length).toBeGreaterThan(0);

      // At least one call has cantidad increment sentinel
      const cantidadSentinels = mockRefs.batchSet.mock.calls.filter(
        ([_ref, data]: [any, any]) => data?.total?._increment === 2,
      );
      expect(cantidadSentinels.length).toBeGreaterThan(0);

      // Paths follow expected document structure for categorized items
      const paths = mockRefs.batchSet.mock.calls.map(
        ([ref]: [string, any]) => ref,
      );
      expect(paths).toEqual(
        expect.arrayContaining([
          expect.stringContaining("Total Productos/Enero 2026"),
          expect.stringContaining("Cartones_vendidos/Enero 2026"),
          expect.stringContaining("/productos/Clavo"),
          expect.stringContaining("/productos/Miel"),
        ]),
      );
    });
  });

  describe("edge cases", () => {
    // ── INT-EDGE-001 ──────────────────────────────────────────
    it("INT-EDGE-001: empty clientes snapshot", async () => {
      // No clients → empty "Ventas" collection
      configurarEscenario([]);

      const result = await processPendingOrders();

      expect(result).toEqual({ pedidosProcesados: 0, pedidosFallidos: 0 });
      expect(mockRefs.batchCommit).not.toHaveBeenCalled();
      expect(mockRefs.batchSet).not.toHaveBeenCalled();
    });

    // ── INT-EDGE-002 ──────────────────────────────────────────
    it("INT-EDGE-002: client with empty months subcollection", async () => {
      // One client but no months
      configurarEscenario([{ id: "Cliente_A", months: {} }]);

      const result = await processPendingOrders();

      expect(result).toEqual({ pedidosProcesados: 0, pedidosFallidos: 0 });
      expect(mockRefs.batchCommit).not.toHaveBeenCalled();
      expect(mockRefs.batchSet).not.toHaveBeenCalled();
    });

    // ── INT-EDGE-003 ──────────────────────────────────────────
    it("INT-EDGE-003: month with zero pending orders", async () => {
      // One client, one month, but no pedidos
      configurarEscenario([
        { id: "Cliente_A", months: { "Enero 2026": [] } },
      ]);

      const result = await processPendingOrders();

      expect(result).toEqual({ pedidosProcesados: 0, pedidosFallidos: 0 });
      expect(mockRefs.batchCommit).not.toHaveBeenCalled();
      expect(mockRefs.batchSet).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    // ── INT-ERROR-001 ──────────────────────────────────────────
    it("INT-ERROR-001: order with empty detalle array is skipped by real job logic", async () => {
      const pedidoSinDetalle: PedidoInput = {
        id: "pedido-vacio",
        pagado: true,
        contabilidadAplicada: false,
        detalle: [],
        fechaPedido: enero2026Date,
      };

      configurarEscenario([
        unClienteConMes("Cliente_A", [pedidoSinDetalle]),
      ]);

      const result = await processPendingOrders();

      expect(result).toEqual({ pedidosProcesados: 0, pedidosFallidos: 0 });
      expect(mockRefs.batchCommit).not.toHaveBeenCalled();
      expect(mockRefs.batchSet).not.toHaveBeenCalled();
    });
  });
});
