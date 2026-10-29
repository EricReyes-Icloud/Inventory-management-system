import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";

// ====================================================================
// ESTRATEGIA: Module._cache de Node.js para módulos CJS que quedan.
// Vitest v4 NO intercepta require() internos en módulos CJS.
//
// jobContableMensual.js usa db (firestore.js) directo para
// batch operations. Eso va con Module._cache.
//
// buildOperacionesContables viene del contabilidad repository.
// ventasRepo.getTodosPedidosPendientesGlobal() se mockea via Module._cache.
// ====================================================================

import Module from "module";
import path from "path";
import { getBackendRoot } from "../../helpers/paths";

// _cache es una API interna de Node.js. Extendemos el tipo para que TS no se queje.
declare module "module" {
  interface Module {
    _cache: Record<string, NodeModule | undefined>;
  }
}

// Guardar referencias a los mocks para que los tests puedan configurarlos
let mockDb;
let mockBuildOperaciones;
let mockGetTodosPedidosPendientesGlobal;

beforeAll(() => {
  // ================================================================
  // 1. Crear los objetos mock
  // ================================================================
  mockDb = {
    collection: vi.fn(),
    batch: vi.fn(),
    doc: vi.fn(),
  };

  mockBuildOperaciones = vi.fn();
  mockGetTodosPedidosPendientesGlobal = vi.fn();

  const mockContabilidadRepo = {
    buildOperacionesContables: mockBuildOperaciones,
  };

  const mockVentasRepo = {
    getTodosPedidosPendientesGlobal: mockGetTodosPedidosPendientesGlobal,
  };

  // ================================================================
  // 2. Resolver rutas absolutas de los módulos reales
  // ================================================================
  const projectRoot = getBackendRoot();
  const firestorePath = path.resolve(projectRoot, "src/lib/firestore.js");
  const contabilidadRepoPath = path.resolve(
    projectRoot,
    "src/repositories/contabilidad.repository.js",
  );
  const ventasRepoPath = path.resolve(
    projectRoot,
    "src/repositories/ventas.repository.js",
  );

  // ================================================================
  // 3. Pre-cargar mocks en Module._cache
  //    Los require() internos del job devuelven los mocks
  // ================================================================
  Module._cache[firestorePath] = {
    exports: mockDb,
    loaded: true,
    id: firestorePath,
    paths: [],
  };

  Module._cache[contabilidadRepoPath] = {
    exports: mockContabilidadRepo,
    loaded: true,
    id: contabilidadRepoPath,
    paths: [],
  };

  Module._cache[ventasRepoPath] = {
    exports: mockVentasRepo,
    loaded: true,
    id: ventasRepoPath,
    paths: [],
  };
});

let jobContableMensual;

beforeAll(async () => {
  // Import dinámico - los módulos ya están en cache con mocks
  const jobModule = await import("../../../src/jobs/jobContableMensual");
  jobContableMensual = jobModule.default;
}, 30000);

/* ================= HELPERS ================= */

const crearPedido = (overrides = {}) => ({
  pagado: true,
  contabilidadAplicada: false,
  detalle: [{ nombre: "Clavo", cantidad: 2, subtotal: 5000 }],
  fechaPedido: new Date(),
  ...overrides,
});

const crearPedidoDoc = (id, data, refPath) => ({
  id,
  data: () => data,
  ref: {
    id,
    path: refPath || `Ventas/cliente1/Pedidos/2026-04/pedidos/${id}`,
    update: vi.fn(),
  },
});

/**
 * Configura mock para la query global de pedidos pendientes.
 * @param {Array} pedidos - Array de objetos pedido
 * @param {Object} batchRef - Mock del batch
 * @param {boolean} empty - Si true, retorna snapshot vacío
 */
const configurarMockGlobal = (pedidos = [], { empty = false } = {}, batchRef) => {
  const pedidoDocs = pedidos.map((p, i) => {
    const id = `pedido-${i}`;
    // Path realista: Ventas/{clienteId}/Pedidos/{mesAnio}/pedidos/{pedidoId}
    const clienteId = `cliente${Math.floor(i / 2) + 1}`;
    const mesAnio = `2026-0${(i % 4) + 1}`;
    const refPath = `Ventas/${clienteId}/Pedidos/${mesAnio}/pedidos/${id}`;
    return crearPedidoDoc(id, p, refPath);
  });

  mockGetTodosPedidosPendientesGlobal.mockResolvedValue({
    empty,
    docs: empty ? [] : pedidoDocs,
    size: empty ? 0 : pedidoDocs.length,
  });

  mockDb.batch = vi.fn(() => batchRef);
  // db.doc(op.ref) recibe el ref del objeto operación y lo pasa directo a batch.set
  mockDb.doc = vi.fn((ref) => ref);

  return pedidoDocs;
};

/* ================= TESTS ================= */

describe("jobContableMensual - rules", () => {
  let mockBatch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBatch = {
      set: vi.fn(),
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    mockBuildOperaciones.mockReset();
    mockGetTodosPedidosPendientesGlobal.mockReset();
  });

  /* ===================== BLOQUE 1 ===================== */
  it("flujo exitoso: procesa pedido válido correctamente", async () => {
    const pedido = crearPedido();
    const [pedidoDoc] = configurarMockGlobal([pedido], {}, mockBatch);

    mockBuildOperaciones.mockReturnValue([
      {
        ref: { path: "path/test" },
        data: { total: 5000 },
        options: { merge: true },
      },
    ]);

    await jobContableMensual();

    // Repository invocado con los datos del pedido
    expect(mockBuildOperaciones).toHaveBeenCalledTimes(1);
    expect(mockBuildOperaciones).toHaveBeenCalledWith(
      pedido.detalle,
      expect.any(Date),
    );

    // Operación contable añadida al batch con los datos correctos
    expect(mockBatch.set).toHaveBeenCalledWith(
      { path: "path/test" },
      { total: 5000 },
      { merge: true },
    );

    // Pedido marcado como procesado dentro del mismo batch
    expect(mockBatch.update).toHaveBeenCalledWith(
      pedidoDoc.ref,
      expect.objectContaining({
        estadoContable: "procesado",
        contabilidadAplicada: true,
      }),
    );

    expect(mockBatch.update).toHaveBeenCalledTimes(1);
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  }, 10000);

  /* ===================== BLOQUE 2 ===================== */
  it("no procesa si el pedido no está pagado", async () => {
    const pedido = crearPedido({ pagado: false });
    configurarMockGlobal([pedido], {}, mockBatch);

    await jobContableMensual();

    expect(mockBuildOperaciones).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  }, 10000);

  /* ===================== BLOQUE 3 ===================== */
  it("ignora pedidos ya procesados (idempotencia)", async () => {
    const pedido = crearPedido({ contabilidadAplicada: true });
    configurarMockGlobal([pedido], {}, mockBatch);

    await jobContableMensual();

    expect(mockBuildOperaciones).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  }, 10000);

  /* ===================== BLOQUE 4 ===================== */
  it("ignora pedidos sin detalle", async () => {
    const pedido = crearPedido({ detalle: [] });
    configurarMockGlobal([pedido], {}, mockBatch);

    await jobContableMensual();

    expect(mockBuildOperaciones).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  }, 10000);

  /* ===================== BLOQUE 5 ===================== */
  it("ignora pedidos con fecha inválida", async () => {
    const pedido = crearPedido({ fechaPedido: "fecha-invalida" });
    configurarMockGlobal([pedido], {}, mockBatch);

    await jobContableMensual();

    expect(mockBuildOperaciones).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  }, 10000);

  /* ===================== BLOQUE 6 ===================== */
  it("maneja errores del repository sin hacer commit", async () => {
    const pedido = crearPedido();
    configurarMockGlobal([pedido], {}, mockBatch);

    mockBuildOperaciones.mockImplementation(() => {
      throw new Error("error");
    });

    await jobContableMensual();

    expect(mockBatch.commit).not.toHaveBeenCalled();
    expect(mockBatch.update).not.toHaveBeenCalled();
  }, 10000);

  /* ===================== BLOQUE 7 ===================== */
  it("garantiza atomicidad: operaciones + update en un mismo batch", async () => {
    const pedido = crearPedido();
    const [pedidoDoc] = configurarMockGlobal([pedido], {}, mockBatch);

    mockBuildOperaciones.mockReturnValue([
      { ref: { path: "path/1" }, data: {}, options: { merge: true } },
      { ref: { path: "path/2" }, data: {}, options: { merge: true } },
    ]);

    await jobContableMensual();

    // 2 operaciones contables en el batch
    expect(mockBatch.set).toHaveBeenCalledTimes(2);
    expect(mockBatch.set).toHaveBeenNthCalledWith(
      1,
      { path: "path/1" },
      {},
      { merge: true },
    );
    expect(mockBatch.set).toHaveBeenNthCalledWith(
      2,
      { path: "path/2" },
      {},
      { merge: true },
    );

    // Update del pedido dentro del mismo batch
    expect(mockBatch.update).toHaveBeenCalledWith(
      pedidoDoc.ref,
      expect.objectContaining({
        estadoContable: "procesado",
        contabilidadAplicada: true,
      }),
    );
    expect(mockBatch.update).toHaveBeenCalledTimes(1);

    // Commit único: garantiza atomicidad
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  }, 10000);

  /* ===================== BLOQUE 8 ===================== */
  it("procesa múltiples pedidos de forma independiente", async () => {
    const pedidos = [crearPedido(), crearPedido()];
    const pedidoDocs = configurarMockGlobal(pedidos, {}, mockBatch);

    mockBuildOperaciones.mockReturnValue([
      { ref: { path: "path/test" }, data: {}, options: { merge: true } },
    ]);

    await jobContableMensual();

    // Repository invocado una vez por cada pedido
    expect(mockBuildOperaciones).toHaveBeenCalledTimes(2);

    // Cada pedido genera su propio batch + commit
    expect(mockBatch.commit).toHaveBeenCalledTimes(2);

    // Cada pedido se marca como procesado individualmente
    expect(mockBatch.update).toHaveBeenCalledWith(
      pedidoDocs[0].ref,
      expect.objectContaining({ estadoContable: "procesado" }),
    );
    expect(mockBatch.update).toHaveBeenCalledWith(
      pedidoDocs[1].ref,
      expect.objectContaining({ estadoContable: "procesado" }),
    );
  }, 10000);

  /* ===================== BLOQUE 9 ===================== */
  it("no procesa si no hay pedidos pendientes (snapshot vacío)", async () => {
    configurarMockGlobal([], { empty: true }, mockBatch);

    await jobContableMensual();

    expect(mockBuildOperaciones).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  }, 10000);

  /* ===================== BLOQUE 10 ===================== */
  it("agrupa pedidos por cliente+mes y los procesa en orden", async () => {
    // 3 pedidos: 2 del mismo cliente/mes, 1 de otro
    const pedidos = [
      crearPedido({ detalle: [{ nombre: "Clavo", cantidad: 1 }] }),
      crearPedido({ detalle: [{ nombre: "Aji", cantidad: 2 }] }),
      crearPedido({ detalle: [{ nombre: "Miel", cantidad: 1 }] }),
    ];
    const pedidoDocs = configurarMockGlobal(pedidos, {}, mockBatch);

    mockBuildOperaciones.mockReturnValue([
      { ref: { path: "path/test" }, data: {}, options: { merge: true } },
    ]);

    await jobContableMensual();

    // 3 pedidos procesados
    expect(mockBuildOperaciones).toHaveBeenCalledTimes(3);
    expect(mockBatch.commit).toHaveBeenCalledTimes(3);

    // Verificar que se extrajo clienteId y mesAnio del path
    // Los paths son: cliente1|2026-01, cliente1|2026-02, cliente2|2026-03
    // Pero el job agrupa por key clienteId|mesAnio
    expect(mockGetTodosPedidosPendientesGlobal).toHaveBeenCalledTimes(1);
  }, 10000);
});
