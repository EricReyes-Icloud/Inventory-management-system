import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import Module from "module";
import path from "path";
import { getBackendRoot } from "../helpers/paths";

// Module augmentation for Module._cache (internal Node.js API)
declare module "module" {
  interface Module {
    _cache: Record<string, NodeModule | undefined>;
  }
}

// ── Path constants for Module._cache injection ──
const PROJECT_ROOT = getBackendRoot();
const FIRESTORE_PATH = path.resolve(PROJECT_ROOT, "src/lib/firestore.js");
const FIREBASE_FIRESTORE_PATH = require.resolve("firebase-admin/firestore");
const VENTAS_REPO_PATH = path.resolve(
  PROJECT_ROOT,
  "src/repositories/ventas.repository.js",
);
const CONTABILIDAD_REPO_PATH = path.resolve(
  PROJECT_ROOT,
  "src/repositories/contabilidad.repository.js",
);
const JOB_PATH = path.resolve(PROJECT_ROOT, "src/jobs/jobContableMensual.js");
const LOADER_PATH = path.resolve(PROJECT_ROOT, "src/catalog/loader.js");
const SERVICE_PATH = path.resolve(PROJECT_ROOT, "src/services/contabilidad.service.js");

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

// Months seeded as already closed (Historico_Mensual exists)
const closedMonths = new Set<string>();

function marcarMesCerrado(mesAnio: string) {
  closedMonths.add(mesAnio);
}

/**
 * Builds a Historico_Mensual snapshot stub for the given doc path.
 * Default: the document does not exist (month open).
 */
function buildHistoricoSnap(docPath: string) {
  const mesAnio = docPath.substring("Historico_Mensual/".length);
  const exists = closedMonths.has(mesAnio);
  return {
    exists,
    id: mesAnio,
    data: () => ({
      totalProductos: {},
      cartonesVendidos: {},
      estado: "cerrado",
    }),
  };
}

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
    // passthrough: returns the ref string as-is for batch.set,
    // except Historico_Mensual reads, which need a document snapshot.
    doc: vi.fn((ref: string) => {
      if (typeof ref === "string" && ref.startsWith("Historico_Mensual/")) {
        return {
          path: ref,
          get: vi.fn(() => Promise.resolve(buildHistoricoSnap(ref))),
        };
      }
      return ref;
    }),
    batch: vi.fn(() => batch),
    // collectionGroup for global pedidos query (job contable optimizado)
    collectionGroup: vi.fn((name: string) => {
      if (name !== "pedidos") {
        return { where: vi.fn(), orderBy: vi.fn(), get: vi.fn() };
      }
      const emptyResult = { docs: [], empty: true, size: 0 };
      const where2 = vi.fn(() => ({ orderBy: vi.fn(() => ({ get: vi.fn().mockResolvedValue(emptyResult) })) }));
      const where1 = vi.fn(() => ({ where: where2 }));
      return { where: where1 };
    }),
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
  // Collect all pedidos from all clients/months for collectionGroup query
  const allPedidos = [];
  for (const cliente of clientes) {
    for (const [mes, pedidos] of Object.entries(cliente.months)) {
      for (const p of pedidos) {
        allPedidos.push({
          id: p.id,
          data: () => ({
            pagado: p.pagado,
            contabilidadAplicada: p.contabilidadAplicada,
            detalle: p.detalle,
            fechaPedido: p.fechaPedido,
          }),
          ref: {
            id: p.id,
            path: `Ventas/${cliente.id}/Pedidos/${mes}/pedidos/${p.id}`,
          },
        });
      }
    }
  }

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
                        const pedidoDocs = pedidos.map((p) => ({
                          id: p.id,
                          data: () => ({
                            pagado: p.pagado,
                            contabilidadAplicada: p.contabilidadAplicada,
                            detalle: p.detalle,
                            fechaPedido: p.fechaPedido,
                          }),
                          ref: {
                            id: p.id,
                            path: "Ventas/" + clienteId + "/Pedidos/" + mes + "/pedidos/" + p.id,
                          },
                        }));
                        const resolvedValue = {
                          docs: pedidoDocs,
                          empty: pedidos.length === 0,
                          size: pedidos.length,
                        };
                        return {
                          get: vi.fn().mockResolvedValue(resolvedValue),
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

  // Configure collectionGroup("pedidos") for global query
  mockDb.collectionGroup = vi.fn((name: string) => {
    if (name !== "pedidos") {
      return { where: vi.fn(), orderBy: vi.fn(), get: vi.fn() };
    }
    const makeQuery = (docs: any[]) => {
      const result = { docs, empty: docs.length === 0, size: docs.length };
      const orderBy = vi.fn(() => ({ get: vi.fn().mockResolvedValue(result) }));
      const where2 = vi.fn(() => ({ orderBy }));
      const where1 = vi.fn(() => ({ where: where2 }));
      return { where: where1 };
    };
    return makeQuery(allPedidos);
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
  delete Module._cache[LOADER_PATH];
  delete Module._cache[SERVICE_PATH];

  // 4b. Mock catalog loader — category map for buildOperacionesContables
  const loaderCategoryMap: Record<string, string> = {
    "Clavo * 100": "Clavo",
    "Clavo * 50": "Clavo",
    "Miel * 100": "Miel",
    "Miel * 50": "Miel",
    "Aji * 100": "Aji",
    "Aji * 50": "Aji",
    "Canela * 100 pequeña": "Canela",
    "Canela * 50 grande": "Canela",
    "Canela * 50 mediana": "Canela",
    "Canela * 50 pequeña": "Canela",
    "Canela molida * 50": "Canela_molida",
    "Canela molidad * 100": "Canela_molida",
    "Ajo en polvo * 50": "Ajo_en_polvo",
    "Bicarbonato * 100": "Bicarbonato",
    "Bicarbonato * 50": "Bicarbonato",
    "Coco * 30": "Coco",
    "Color * 50": "Color",
    "Comino * 50": "Comino",
    "Copas de miel": "Miel",
    "Frasco de miel": "Miel",
    "Media botella miel": "Miel",
    "Salsina * 50": "Salsina",
    "Uva * 30": "Uva",
  };
  Module._cache[LOADER_PATH] = {
    exports: {
      getCategoria: (nombre: string) => loaderCategoryMap[nombre] || null,
    },
    loaded: true,
    id: LOADER_PATH,
    paths: [],
  } as any;

  // 5. Dynamic import — the module chain now loads with mocked deps
  const jobModule = await import("../../src/jobs/jobContableMensual");
  processPendingOrders = jobModule.processPendingOrders;
}, 30000);

beforeEach(() => {
  vi.clearAllMocks();
  closedMonths.clear();

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
  delete Module._cache[LOADER_PATH];
  delete Module._cache[SERVICE_PATH];
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
  detalle: [{ nombre: "Clavo * 100", cantidad: 2, subtotal: 5000 }],
  fechaPedido: enero2026Date,
};

const unPedidoMiel: PedidoInput = {
  id: "pedido-002",
  pagado: true,
  contabilidadAplicada: false,
  detalle: [{ nombre: "Miel * 100", cantidad: 1, subtotal: 10000 }],
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
      expect(result).toEqual({ pedidosProcesados: 1, pedidosFallidos: 0, pedidosRechazados: 0 });

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

      expect(result).toEqual({ pedidosProcesados: 2, pedidosFallidos: 0, pedidosRechazados: 0 });

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
          { nombre: "Clavo * 100", cantidad: 2, subtotal: 5000 },
          { nombre: "Miel * 100", cantidad: 1, subtotal: 10000 },
        ],
        fechaPedido: enero2026Date,
      };

      configurarEscenario([
        unClienteConMes("Cliente_A", [pedidoConDosItems]),
      ]);

      const result = await processPendingOrders();

      expect(result).toEqual({ pedidosProcesados: 1, pedidosFallidos: 0, pedidosRechazados: 0 });

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

      expect(result).toEqual({ pedidosProcesados: 0, pedidosFallidos: 0, pedidosRechazados: 0 });
      expect(mockRefs.batchCommit).not.toHaveBeenCalled();
      expect(mockRefs.batchSet).not.toHaveBeenCalled();
    });

    // ── INT-EDGE-002 ──────────────────────────────────────────
    it("INT-EDGE-002: client with empty months subcollection", async () => {
      // One client but no months
      configurarEscenario([{ id: "Cliente_A", months: {} }]);

      const result = await processPendingOrders();

      expect(result).toEqual({ pedidosProcesados: 0, pedidosFallidos: 0, pedidosRechazados: 0 });
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

      expect(result).toEqual({ pedidosProcesados: 0, pedidosFallidos: 0, pedidosRechazados: 0 });
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

      expect(result).toEqual({ pedidosProcesados: 0, pedidosFallidos: 0, pedidosRechazados: 0 });
      expect(mockRefs.batchCommit).not.toHaveBeenCalled();
      expect(mockRefs.batchSet).not.toHaveBeenCalled();
    });
  });

  describe("closed-month guard", () => {
    // ── INT-GUARD-001 — S1/S3/S4 ──────────────────────────────
    it("INT-GUARD-001: pending paid order on a closed month is parked with zero accounting writes", async () => {
      marcarMesCerrado("Enero 2026");
      configurarEscenario([unClienteConMes("Cliente_A", [unPedidoClavo])]);

      const result = await processPendingOrders();

      expect(result).toEqual({
        pedidosProcesados: 0,
        pedidosFallidos: 0,
        pedidosRechazados: 1,
      });

      // No accounting operation may be queued
      expect(mockRefs.batchSet).not.toHaveBeenCalled();

      // Exactly one atomic update: the parked state
      expect(mockRefs.batchCommit).toHaveBeenCalledTimes(1);
      expect(mockRefs.batchUpdate).toHaveBeenCalledTimes(1);
      expect(mockRefs.batchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ id: "pedido-001" }),
        expect.objectContaining({
          estadoContable: "rechazado_mes_cerrado",
          contabilidadAplicada: false,
          motivoRechazo: "mes_cerrado",
          mesCerradoObjetivo: "Enero 2026",
        }),
      );

      const [, parkedData] = mockRefs.batchUpdate.mock.calls[0];
      expect(parkedData).not.toHaveProperty("pagado");
      expect(parkedData.fechaRechazo).toBeInstanceOf(Date);
    });

    // ── INT-GUARD-002 — S2 (path-key drift) ───────────────────
    it("INT-GUARD-002: guard keys on obtenerMesAnio(fechaPedido), not on the Pedidos path month", async () => {
      // Path uses the es-CO producer ("Enero de 2026"); accounting uses "Enero 2026"
      marcarMesCerrado("Enero 2026");
      configurarEscenario([
        { id: "Cliente_A", months: { "Enero de 2026": [unPedidoClavo] } },
      ]);

      const result = await processPendingOrders();

      expect(result.pedidosRechazados).toBe(1);
      expect(result.pedidosProcesados).toBe(0);
      expect(mockRefs.batchSet).not.toHaveBeenCalled();
    });

    // ── INT-GUARD-003 — no over-blocking ──────────────────────
    it("INT-GUARD-003: a closed month does not block orders from a different month", async () => {
      marcarMesCerrado("Diciembre 2025");
      configurarEscenario([unClienteConMes("Cliente_A", [unPedidoClavo])]);

      const result = await processPendingOrders();

      expect(result).toEqual({
        pedidosProcesados: 1,
        pedidosFallidos: 0,
        pedidosRechazados: 0,
      });
      expect(mockRefs.batchSet).toHaveBeenCalled();
    });

    // ── INT-GUARD-004 — S7 regression ─────────────────────────
    it("INT-GUARD-004: open month keeps the previous accounting behavior", async () => {
      configurarEscenario([unClienteConMes("Cliente_A", [unPedidoClavo])]);

      const result = await processPendingOrders();

      expect(result.pedidosProcesados).toBe(1);
      expect(mockRefs.batchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ id: "pedido-001" }),
        expect.objectContaining({ estadoContable: "procesado" }),
      );
    });

    // ── INT-GUARD-005 — S9 ────────────────────────────────────
    it("INT-GUARD-005: accounting writes never re-assert estado 'abierto'", async () => {
      configurarEscenario([unClienteConMes("Cliente_A", [unPedidoClavo])]);

      await processPendingOrders();

      const writesWithEstado = mockRefs.batchSet.mock.calls.filter(
        ([, data]: [any, any]) => data?.estado !== undefined,
      );
      expect(writesWithEstado).toHaveLength(0);
    });
  });
});
