import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";

// ====================================================================
// ESTRATEGIA: Module._cache de Node.js para módulos CJS que quedan.
// Vitest v4 NO intercepta require() internos en módulos CJS.
//
// jobContableMensual.js aún importa db (firestore.js) directo para
// la colección Ventas y batch operations. Eso va con Module._cache.
//
// PERO: buildOperacionesContables ahora viene del repository, no del
// service. Mockeamos el repository en Module._cache.
// ====================================================================

import Module from "module";
import path from "path";

// _cache es una API interna de Node.js. Extendemos el tipo para que TS no se queje.
declare module "module" {
  interface Module {
    _cache: Record<string, NodeModule | undefined>;
  }
}

// Guardar referencias a los mocks para que los tests puedan configurarlos
let mockDb;
let mockBuildOperaciones;

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

  const mockContabilidadRepo = {
    buildOperacionesContables: mockBuildOperaciones,
  };

  // ================================================================
  // 2. Resolver rutas absolutas de los módulos reales
  // ================================================================
  const projectRoot = process.cwd();
  const firestorePath = path.resolve(projectRoot, "src/lib/firestore.js");
  const contabilidadRepoPath = path.resolve(
    projectRoot,
    "src/repositories/contabilidad.repository.js",
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

/**
 * Configura la cadena completa de mocks de Firestore.
 * @param {Object} batchRef - Referencia al mockBatch del test actual
 */
const configurarMocks = (pedidos = [], { clientesEmpty = false, mesesEmpty = false } = {}, batchRef) => {
  const pedidoDocs = pedidos.map((p, i) => ({
    id: `pedido-${i}`,
    data: () => p,
    ref: {
      id: `pedido-${i}`,
      update: vi.fn(),
    },
  }));

  mockDb.collection = vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue({
      empty: clientesEmpty,
      docs: clientesEmpty ? [] : [{ id: "cliente1" }],
    }),
    doc: vi.fn(() => ({
      collection: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          empty: mesesEmpty,
          docs: mesesEmpty ? [] : [{ id: "2026-04" }],
        }),
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({
            where: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({
                empty: pedidos.length === 0,
                size: pedidos.length,
                docs: pedidoDocs,
              }),
            })),
          })),
        })),
      }),
    })),
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
  });

  /* ===================== BLOQUE 1 ===================== */
  it("flujo exitoso: procesa pedido válido correctamente", async () => {
    const pedido = crearPedido();
    const [pedidoDoc] = configurarMocks([pedido], {}, mockBatch);

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
    configurarMocks([pedido], {}, mockBatch);

    await jobContableMensual();

    expect(mockBuildOperaciones).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  }, 10000);

  /* ===================== BLOQUE 3 ===================== */
  it("ignora pedidos ya procesados (idempotencia)", async () => {
    const pedido = crearPedido({ contabilidadAplicada: true });
    configurarMocks([pedido], {}, mockBatch);

    await jobContableMensual();

    expect(mockBuildOperaciones).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  }, 10000);

  /* ===================== BLOQUE 4 ===================== */
  it("ignora pedidos sin detalle", async () => {
    const pedido = crearPedido({ detalle: [] });
    configurarMocks([pedido], {}, mockBatch);

    await jobContableMensual();

    expect(mockBuildOperaciones).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  }, 10000);

  /* ===================== BLOQUE 5 ===================== */
  it("ignora pedidos con fecha inválida", async () => {
    const pedido = crearPedido({ fechaPedido: "fecha-invalida" });
    configurarMocks([pedido], {}, mockBatch);

    await jobContableMensual();

    expect(mockBuildOperaciones).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  }, 10000);

  /* ===================== BLOQUE 6 ===================== */
  it("maneja errores del repository sin hacer commit", async () => {
    const pedido = crearPedido();
    configurarMocks([pedido], {}, mockBatch);

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
    const [pedidoDoc] = configurarMocks([pedido], {}, mockBatch);

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
    const pedidoDocs = configurarMocks(pedidos, {}, mockBatch);

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
  it("no procesa si no hay clientes (clientesSnap.empty)", async () => {
    configurarMocks([], { clientesEmpty: true }, mockBatch);

    await jobContableMensual();

    expect(mockBuildOperaciones).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  }, 10000);

  /* ===================== BLOQUE 10 ===================== */
  it("salta cliente sin meses (mesesSnap.empty)", async () => {
    const pedido = crearPedido();
    configurarMocks([pedido], { mesesEmpty: true }, mockBatch);

    await jobContableMensual();

    expect(mockBuildOperaciones).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  }, 10000);

  /* ===================== BLOQUE 11 ===================== */
  it("salta mes sin pedidos pendientes (pedidosSnap.empty)", async () => {
    configurarMocks([], { clientesEmpty: false, mesesEmpty: false }, mockBatch);

    await jobContableMensual();

    expect(mockBuildOperaciones).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  }, 10000);
});
