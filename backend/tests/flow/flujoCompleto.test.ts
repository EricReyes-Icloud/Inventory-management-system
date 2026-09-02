import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import Module from "module";
import path from "path";
import {
  createMockDb,
  buildMockStore,
  buildTotalProductosAfterStage1,
  buildCartonesVendidosAfterStage1,
} from "../helpers/firestoreMock";
import type { Scenario, MockRefs, PedidoInput } from "../helpers/firestoreMockTypes";

// ── Module augmentation for Module._cache ──
declare module "module" {
  interface Module {
    _cache: Record<string, NodeModule | undefined>;
  }
}

// ── Path constants (derived from this file's location) ──
// This file is at backend/tests/flow/flujoCompleto.test.ts
// PROJECT_ROOT = backend/
const __filename = new URL(import.meta.url).pathname;
const __here = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__here, "../..");
const FIRESTORE_PATH = path.resolve(PROJECT_ROOT, "src/lib/firestore.js");
const FIREBASE_FIRESTORE_PATH = path.resolve(PROJECT_ROOT, "node_modules/firebase-admin/lib/firestore/index.js");
const VENTAS_REPO_PATH = path.resolve(PROJECT_ROOT, "src/repositories/ventas.repository.js");
const CONTABILIDAD_REPO_PATH = path.resolve(PROJECT_ROOT, "src/repositories/contabilidad.repository.js");
const CONTABLE_REPO_PATH = path.resolve(PROJECT_ROOT, "src/repositories/contable.repository.js");
const ADMIN_REPO_PATH = path.resolve(PROJECT_ROOT, "src/repositories/admin.repository.js");
const ORCHESTRATOR_PATH = path.resolve(PROJECT_ROOT, "src/services/monthlyClosing.orchestrator.js");
const CONTABILIDAD_SERVICE_PATH = path.resolve(PROJECT_ROOT, "src/services/contabilidad.service.js");
const GANANCIAS_SERVICE_PATH = path.resolve(PROJECT_ROOT, "src/services/ganancias.service.js");
const ADMIN_SERVICE_PATH = path.resolve(PROJECT_ROOT, "src/services/admin.actions.service.js");
const JOB_PATH = path.resolve(PROJECT_ROOT, "src/jobs/jobContableMensual.js");

// ── Module-level state ──
let mockDb: any;
let mockRefs: MockRefs;
let cerrarMes: (...args: any[]) => any;

// ── Test data ──
const enero2026Date = new Date("2026-01-15");

const unPedidoClavo: PedidoInput = {
  id: "pedido-clavo",
  pagado: true,
  contabilidadAplicada: false,
  estadoContable: "pendiente",
  detalle: [{ nombre: "Clavo * 100", cantidad: 2, subtotal: 5000 }],
  fechaPedido: enero2026Date,
};

const unPedidoMiel: PedidoInput = {
  id: "pedido-miel",
  pagado: true,
  contabilidadAplicada: false,
  estadoContable: "pendiente",
  detalle: [{ nombre: "Miel * 100", cantidad: 1, subtotal: 10000 }],
  fechaPedido: enero2026Date,
};

const unClienteConMes = (id: string, pedidos: PedidoInput[]) => ({
  id,
  months: { "Enero 2026": pedidos },
});

// ═══════════════════════════════════════════════════════════════
// Lifecycle
// ═══════════════════════════════════════════════════════════════

beforeAll(async () => {
  const built = createMockDb();
  mockDb = built.mockDb;
  mockRefs = built.refs;

  const mockFieldValue = {
    increment: (n: number) => ({ _increment: n }),
    serverTimestamp: () => ({ _serverTimestamp: true }),
  };

  Module._cache[FIRESTORE_PATH] = { exports: mockDb, loaded: true, id: FIRESTORE_PATH, paths: [] } as any;
  Module._cache[FIREBASE_FIRESTORE_PATH] = { exports: { FieldValue: mockFieldValue }, loaded: true, id: FIREBASE_FIRESTORE_PATH, paths: [] } as any;

  [VENTAS_REPO_PATH, CONTABILIDAD_REPO_PATH, CONTABLE_REPO_PATH, ADMIN_REPO_PATH,
   CONTABILIDAD_SERVICE_PATH, GANANCIAS_SERVICE_PATH, ADMIN_SERVICE_PATH, JOB_PATH, ORCHESTRATOR_PATH]
    .forEach((p) => { delete Module._cache[p]; });

  const orchestratorModule = await import("../../src/services/monthlyClosing.orchestrator");
  cerrarMes = orchestratorModule.cerrarMes;
}, 30000);

beforeEach(() => {
  vi.clearAllMocks();
  const fresh = createMockDb();
  mockRefs = fresh.refs;
  mockDb.collection = fresh.mockDb.collection;
  mockDb.doc = fresh.mockDb.doc;
  mockDb.batch = fresh.mockDb.batch;
});

afterEach(() => {
  [VENTAS_REPO_PATH, CONTABILIDAD_REPO_PATH, CONTABLE_REPO_PATH, ADMIN_REPO_PATH,
   CONTABILIDAD_SERVICE_PATH, GANANCIAS_SERVICE_PATH, ADMIN_SERVICE_PATH, JOB_PATH, ORCHESTRATOR_PATH]
    .forEach((p) => { delete Module._cache[p]; });
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

describe("cerrarMes - full pipeline (Phases 1-2)", () => {
  const admin = { uid: "admin-1", nombre: "Admin Uno" };

  describe("FLUJO-FLOW-001: Multi-category (Clavo + Miel) full pipeline", () => {
    it("executes all 4 stages with 2 categories and returns ganancias.length === 2", async () => {
      const scenario: Scenario = {
        ventas: [
          unClienteConMes("Client_A", [unPedidoClavo]),
          unClienteConMes("Client_B", [unPedidoMiel]),
        ],
        totalProductos: buildTotalProductosAfterStage1("Enero 2026", [
          { name: "Clavo", total: 5000, skus: { "Clavo * 100": 5000 } },
          { name: "Miel", total: 10000, skus: { "Miel * 100": 10000 } },
        ]),
        cartonesVendidos: buildCartonesVendidosAfterStage1("Enero 2026", [
          { name: "Clavo", total: 2, skus: { "Clavo * 100": 2 } },
          { name: "Miel", total: 1, skus: { "Miel * 100": 1 } },
        ]),
        historicoMensual: {},
        invertir: {
          Clavo: {
            costos_fijos: { flete: 500, empaque: 200 },
            costos_variables: { envase: 300, etiqueta: 100 },
          },
          Miel: {
            costos_fijos: { frasco: 1000, tapa: 200 },
            costos_variables: { Frascos: { envase: 500, etiqueta: 200 } },
          },
        },
      };

      buildMockStore(scenario, mockDb, mockRefs);

      const result = await cerrarMes("Enero 2026", admin);

      // Stage 1: batch operations
      expect(mockRefs.batchSet).toHaveBeenCalled();
      expect(mockRefs.batchUpdate).toHaveBeenCalled();
      const updateCalls = mockRefs.batchUpdate.mock.calls;
      expect(updateCalls.some(([ref]: [any]) => ref?.id === "pedido-clavo")).toBe(true);
      expect(updateCalls.some(([ref]: [any]) => ref?.id === "pedido-miel")).toBe(true);
      expect(mockRefs.batchCommit).toHaveBeenCalled();

      // Stage 2: historical snapshot
      expect(mockRefs.setHistoricoMensual).toHaveBeenCalledWith(
        "Enero 2026",
        expect.objectContaining({
          totalProductos: expect.objectContaining({ Clavo: expect.any(Object), Miel: expect.any(Object) }),
        }),
      );

      // Stage 3: earnings
      expect(mockRefs.setGanancias).toHaveBeenCalled();

      // Stage 4: audit trail
      expect(mockRefs.setCierreContable).toHaveBeenCalled();
      expect(mockRefs.setAdminAction).toHaveBeenCalled();

      // Result shape
      expect(result).toHaveProperty("mesAnio", "Enero 2026");
      expect(result).toHaveProperty("snapshot");
      expect(result).toHaveProperty("ganancias");
      expect(result.ganancias.length).toBe(2);

      for (const ganancia of result.ganancias) {
        expect(ganancia).toHaveProperty("categoria");
        expect(ganancia).toHaveProperty("gananciaNeta");
        expect(ganancia).toHaveProperty("ventaTotal");
        expect(ganancia).toHaveProperty("estado", "cerrado");
        expect(typeof ganancia.gananciaNeta).toBe("number");
      }

      const categorias = result.ganancias.map((g: any) => g.categoria);
      expect(categorias).toContain("Clavo");
      expect(categorias).toContain("Miel");
    });
  });

  describe("FLUJO-FLOW-002: Single category happy path", () => {
    it("returns ganancias[0].categoria === 'Clavo' and gananciaNeta is number", async () => {
      const scenario: Scenario = {
        ventas: [unClienteConMes("Client_A", [unPedidoClavo])],
        totalProductos: buildTotalProductosAfterStage1("Enero 2026", [
          { name: "Clavo", total: 5000, skus: { "Clavo * 100": 5000 } },
        ]),
        cartonesVendidos: buildCartonesVendidosAfterStage1("Enero 2026", [
          { name: "Clavo", total: 2, skus: { "Clavo * 100": 2 } },
        ]),
        historicoMensual: {},
        invertir: {
          Clavo: {
            costos_fijos: { flete: 500, empaque: 200 },
            costos_variables: { envase: 300, etiqueta: 100 },
          },
        },
      };

      buildMockStore(scenario, mockDb, mockRefs);

      const result = await cerrarMes("Enero 2026", admin);

      expect(result.ganancias.length).toBe(1);
      expect(result.ganancias[0].categoria).toBe("Clavo");
      expect(typeof result.ganancias[0].gananciaNeta).toBe("number");

      expect(mockRefs.batchSet).toHaveBeenCalled();
      expect(mockRefs.batchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ id: "pedido-clavo" }),
        expect.objectContaining({ estadoContable: "procesado" }),
      );
      expect(mockRefs.setHistoricoMensual).toHaveBeenCalled();
      expect(mockRefs.setGanancias).toHaveBeenCalled();
      expect(mockRefs.setCierreContable).toHaveBeenCalled();
      expect(mockRefs.setAdminAction).toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// Phase 3: Edge Cases
// ═══════════════════════════════════════════════════════════════

describe("cerrarMes - edge cases (Phase 3)", () => {
  const admin = { uid: "admin-1", nombre: "Admin Uno" };

  describe("FLUJO-EDGE-001: No pending orders, pre-populated data", () => {
    it("processPendingOrders returns 0/0, stages 2-4 execute from pre-populated data", async () => {
      const scenario: Scenario = {
        ventas: [],
        totalProductos: buildTotalProductosAfterStage1("Enero 2026", [
          { name: "Clavo", total: 5000, skus: { "Clavo * 100": 5000 } },
        ]),
        cartonesVendidos: buildCartonesVendidosAfterStage1("Enero 2026", [
          { name: "Clavo", total: 2, skus: { "Clavo * 100": 2 } },
        ]),
        historicoMensual: {},
        invertir: {
          Clavo: {
            costos_fijos: { flete: 500, empaque: 200 },
            costos_variables: { envase: 300, etiqueta: 100 },
          },
        },
      };

      buildMockStore(scenario, mockDb, mockRefs);

      const result = await cerrarMes("Enero 2026", admin);

      // Stage 1: no batch operations for orders
      expect(mockRefs.batchCommit).not.toHaveBeenCalled();

      // Stage 2: snapshot from pre-populated data
      expect(mockRefs.setHistoricoMensual).toHaveBeenCalledWith(
        "Enero 2026",
        expect.objectContaining({
          totalProductos: expect.objectContaining({ Clavo: expect.any(Object) }),
        }),
      );

      // Stage 3: earnings calculated
      expect(mockRefs.setGanancias).toHaveBeenCalled();
      expect(result.ganancias.length).toBe(1);
      expect(result.ganancias[0].categoria).toBe("Clavo");

      // Stage 4: audit written
      expect(mockRefs.setCierreContable).toHaveBeenCalled();
      expect(mockRefs.setAdminAction).toHaveBeenCalled();
    });
  });

  describe("FLUJO-EDGE-002: Already-closed month", () => {
    it("Stage 2 throws historical already generated, stages 3-4 skip", async () => {
      const scenario: Scenario = {
        ventas: [],
        totalProductos: {},
        cartonesVendidos: {},
        historicoMensual: {
          "Enero 2026": {
            totalProductos: { Clavo: { total: 5000 } },
            cartonesVendidos: { Clavo: { total: 2 } },
            estado: "cerrado",
          },
        },
        invertir: {},
      };

      buildMockStore(scenario, mockDb, mockRefs);

      await expect(cerrarMes("Enero 2026", admin)).rejects.toThrow(
        "Error en etapa 2 (generar histórico): El histórico para Enero 2026 ya fue generado",
      );

      expect(mockRefs.setGanancias).not.toHaveBeenCalled();
      expect(mockRefs.setCierreContable).not.toHaveBeenCalled();
      expect(mockRefs.setAdminAction).not.toHaveBeenCalled();
    });
  });

  describe("FLUJO-EDGE-003: Empty Productos/Cartones subcollections", () => {
    it("stage 2 produces empty snapshot, stage 3 iterates zero categories, stage 4 writes empty audit", async () => {
      const scenario: Scenario = {
        ventas: [],
        totalProductos: {
          "Total Productos/Enero 2026": { mesAnio: "Enero 2026", totalGeneral: 0, estado: "abierto" },
        },
        cartonesVendidos: {
          "Cartones_vendidos/Enero 2026": { mesAnio: "Enero 2026", totalGeneral: 0, estado: "abierto" },
        },
        historicoMensual: {},
        invertir: {},
      };

      buildMockStore(scenario, mockDb, mockRefs);

      const result = await cerrarMes("Enero 2026", admin);

      // Stage 2: snapshot with empty totals
      expect(mockRefs.setHistoricoMensual).toHaveBeenCalledWith(
        "Enero 2026",
        expect.objectContaining({
          totalProductos: {},
          cartonesVendidos: {},
        }),
      );

      // Stage 3: zero categories → empty ganancias
      expect(result.ganancias).toEqual([]);

      // Stage 4: audit with totalCategorias: 0
      expect(mockRefs.setCierreContable).toHaveBeenCalled();
      expect(mockRefs.setAdminAction).toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// Phase 4: Error Cases
// ═══════════════════════════════════════════════════════════════

describe("cerrarMes - error cases (Phase 4)", () => {
  const admin = { uid: "admin-1", nombre: "Admin Uno" };

  describe("FLUJO-ERR-001: Empty mesAnio", () => {
    it("throws immediately with 'mesAnio es obligatorio', no stages execute", async () => {
      const scenario: Scenario = {
        ventas: [],
        totalProductos: {},
        cartonesVendidos: {},
        historicoMensual: {},
        invertir: {},
      };

      buildMockStore(scenario, mockDb, mockRefs);

      await expect(cerrarMes("", admin)).rejects.toThrow("mesAnio es obligatorio");

      expect(mockRefs.batchCommit).not.toHaveBeenCalled();
      expect(mockRefs.setHistoricoMensual).not.toHaveBeenCalled();
      expect(mockRefs.setGanancias).not.toHaveBeenCalled();
      expect(mockRefs.setCierreContable).not.toHaveBeenCalled();
      expect(mockRefs.setAdminAction).not.toHaveBeenCalled();
    });
  });

  describe("FLUJO-ERR-002: Admin without uid", () => {
    it("Stage 1 executes, Stage 2 throws, stages 3-4 skip", async () => {
      const scenario: Scenario = {
        ventas: [unClienteConMes("Client_A", [unPedidoClavo])],
        totalProductos: {},
        cartonesVendidos: {},
        historicoMensual: {},
        invertir: {},
      };

      buildMockStore(scenario, mockDb, mockRefs);

      const adminNoUid = { nombre: "Test Admin" } as any;

      await expect(cerrarMes("Enero 2026", adminNoUid)).rejects.toThrow(
        "Error en etapa 2 (generar histórico): admin.uid es obligatorio",
      );

      // Stage 1 executed and processed the order
      expect(mockRefs.batchCommit).toHaveBeenCalled();

      // Stages 3-4 did NOT execute
      expect(mockRefs.setGanancias).not.toHaveBeenCalled();
      expect(mockRefs.setCierreContable).not.toHaveBeenCalled();
      expect(mockRefs.setAdminAction).not.toHaveBeenCalled();
    });
  });

  describe("FLUJO-ERR-003: Missing Invertir/{categoria} fixed costs", () => {
    it("Stage 1 completes, Stage 2 generates snapshot, Stage 3 throws, Stage 4 skips", async () => {
      const scenario: Scenario = {
        ventas: [unClienteConMes("Client_A", [unPedidoClavo])],
        totalProductos: buildTotalProductosAfterStage1("Enero 2026", [
          { name: "Clavo", total: 5000, skus: { "Clavo * 100": 5000 } },
        ]),
        cartonesVendidos: buildCartonesVendidosAfterStage1("Enero 2026", [
          { name: "Clavo", total: 2, skus: { "Clavo * 100": 2 } },
        ]),
        historicoMensual: {},
        invertir: {},
      };

      buildMockStore(scenario, mockDb, mockRefs);

      await expect(cerrarMes("Enero 2026", admin)).rejects.toThrow(
        "Error en etapa 3 (calcular ganancias): No existen costos fijos para Clavo",
      );

      // Stage 1 completed
      expect(mockRefs.batchCommit).toHaveBeenCalled();

      // Stage 2 generated snapshot
      expect(mockRefs.setHistoricoMensual).toHaveBeenCalled();

      // Stage 3 threw → Stage 4 did NOT execute
      expect(mockRefs.setCierreContable).not.toHaveBeenCalled();
      expect(mockRefs.setAdminAction).not.toHaveBeenCalled();
    });
  });

  describe("FLUJO-ERR-004: Missing costos_variables for non-Miel category", () => {
    it("Stage 1 completes, Stage 2 generates snapshot, Stage 3 throws", async () => {
      const scenario: Scenario = {
        ventas: [unClienteConMes("Client_A", [unPedidoClavo])],
        totalProductos: buildTotalProductosAfterStage1("Enero 2026", [
          { name: "Clavo", total: 5000, skus: { "Clavo * 100": 5000 } },
        ]),
        cartonesVendidos: buildCartonesVendidosAfterStage1("Enero 2026", [
          { name: "Clavo", total: 2, skus: { "Clavo * 100": 2 } },
        ]),
        historicoMensual: {},
        invertir: {
          Clavo: {
            costos_fijos: { flete: 500, empaque: 200 },
            // No costos_variables → triggers error
          },
        },
      };

      buildMockStore(scenario, mockDb, mockRefs);

      await expect(cerrarMes("Enero 2026", admin)).rejects.toThrow(
        "Error en etapa 3 (calcular ganancias): No existen costos variables para Clavo",
      );

      // Stage 1 completed
      expect(mockRefs.batchCommit).toHaveBeenCalled();

      // Stage 2 generated snapshot
      expect(mockRefs.setHistoricoMensual).toHaveBeenCalled();

      // Stage 3 threw → Stage 4 did NOT execute
      expect(mockRefs.setCierreContable).not.toHaveBeenCalled();
      expect(mockRefs.setAdminAction).not.toHaveBeenCalled();
    });
  });
});
