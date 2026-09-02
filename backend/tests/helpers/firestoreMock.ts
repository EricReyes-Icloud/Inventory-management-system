// ── Firestore mock helper for flujoCompleto integration tests ──
// Vitest v4 constraint: NO deeply nested arrow functions returning inline objects.
// Use NAMED FUNCTIONS with INTERMEDIATE VARIABLES instead.

import { vi } from "vitest";
import type { Scenario, MockRefs } from "./firestoreMockTypes";

// ═══════════════════════════════════════════════════════════════
// INTERNAL TYPES
// ═══════════════════════════════════════════════════════════════

interface DocSnapshot {
  exists: boolean;
  data: () => any;
  id: string;
  ref: { id: string; path?: string };
}

interface QuerySnapshot {
  docs: DocSnapshot[];
  empty: boolean;
  size: number;
  forEach: (fn: (doc: DocSnapshot) => void) => void;
}

// ═══════════════════════════════════════════════════════════════
// SNAPSHOT BUILDERS
// ═══════════════════════════════════════════════════════════════

function buildDocSnap(id: string, data?: any, path?: string): DocSnapshot {
  const exists = data !== undefined;
  const ref = path ? { id, path } : { id };
  const result: DocSnapshot = {
    exists,
    data: () => data,
    id,
    ref,
  };
  return result;
}

function buildQuerySnap(docs: DocSnapshot[]): QuerySnapshot {
  const result: QuerySnapshot = {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (fn: (doc: DocSnapshot) => void) => {
      docs.forEach(fn);
    },
  };
  return result;
}

// ═══════════════════════════════════════════════════════════════
// STORE HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Returns all immediate child documents under a store prefix.
 * E.g., getChildIds(store, "Ventas") → ["Client_A", "Client_B"]
 * E.g., getChildIds(store, "Total Productos/Enero 2026/productos") → ["Clavo", "Miel"]
 */
function getChildIds(
  storeA: Record<string, any>,
  storeB: Record<string, any>,
  prefix: string,
): string[] {
  const combined: Record<string, any> = { ...storeA, ...storeB };
  const prefixSlash = prefix.endsWith("/") ? prefix : `${prefix}/`;
  const ids = new Set<string>();

  for (const key of Object.keys(combined)) {
    if (key.startsWith(prefixSlash)) {
      const relative = key.substring(prefixSlash.length);
      const childId = relative.split("/")[0];
      if (childId) {
        ids.add(childId);
      }
    }
  }

  return Array.from(ids);
}

/**
 * Looks up data for a path, checking writtenStore first, then store.
 */
function resolveData(
  path: string,
  store: Record<string, any>,
  writtenStore: Record<string, any>,
): any | undefined {
  if (Object.prototype.hasOwnProperty.call(writtenStore, path)) {
    return writtenStore[path];
  }
  if (Object.prototype.hasOwnProperty.call(store, path)) {
    return store[path];
  }
  return undefined;
}

// ═══════════════════════════════════════════════════════════════
// DOC REF BUILDER
// ═══════════════════════════════════════════════════════════════

function buildDocRefGet(
  path: string,
  store: Record<string, any>,
  writtenStore: Record<string, any>,
) {
  const fn = vi.fn(() => {
    const data = resolveData(path, store, writtenStore);
    const snap = buildDocSnap(path.split("/").pop() || "", data);
    return Promise.resolve(snap);
  });
  return fn;
}

/**
 * Routes a doc.set() call to the appropriate MockRefs spy based on path.
 */
function routeDocSet(
  path: string,
  data: any,
  refs: MockRefs,
  _options?: any,
): void {
  const parts = path.split("/");

  // Historico_Mensual/{mesAnio}
  if (parts.length === 2 && parts[0] === "Historico_Mensual") {
    refs.setHistoricoMensual(parts[1], data);
    return;
  }

  // Ganancias/{mesAnio}
  if (parts.length === 2 && parts[0] === "Ganancias") {
    refs.setGanancias(parts[1], data);
    return;
  }

  // Invertir/{categoria}/historico_compras/{mesAnio}
  if (parts.length === 4 && parts[0] === "Invertir" && parts[2] === "historico_compras") {
    refs.setHistoricoCompras(parts[1], parts[3], data);
    return;
  }

  // Cierres_contables/{mesAnio}
  if (parts.length === 2 && parts[0] === "Cierres_contables") {
    refs.setCierreContable(parts[1], data);
    return;
  }

  // AdminActions/{mesAnio}
  if (parts.length === 2 && parts[0] === "AdminActions") {
    refs.setAdminAction(parts[1], data);
    return;
  }

  // All other paths (subcollections, batch ref paths) — no spy routing needed
}

function buildDocRefSet(
  path: string,
  writtenStore: Record<string, any>,
  refs: MockRefs,
) {
  const fn = vi.fn((data: any, options?: any) => {
    // Merge into writtenStore so subsequent reads find this data
    const existing = writtenStore[path] || {};
    writtenStore[path] = { ...existing, ...data };

    // Route to the appropriate ref spy
    routeDocSet(path, data, refs, options);

    return Promise.resolve();
  });
  return fn;
}

function createDocRef(
  path: string,
  store: Record<string, any>,
  writtenStore: Record<string, any>,
  refs: MockRefs,
) {
  const id = path.split("/").pop() || "";
  const get = buildDocRefGet(path, store, writtenStore);
  const set = buildDocRefSet(path, writtenStore, refs);

  const result: Record<string, any> = {
    id,
    path,
    get,
    set,
  };

  result.collection = (name: string) => {
    return createColRef(`${path}/${name}`, store, writtenStore, refs);
  };

  return result;
}

// ═══════════════════════════════════════════════════════════════
// COLLECTION / QUERY REF BUILDER
// ═══════════════════════════════════════════════════════════════

function buildColRefGet(
  path: string,
  store: Record<string, any>,
  writtenStore: Record<string, any>,
) {
  const fn = vi.fn(() => {
    const childIds = getChildIds(store, writtenStore, path);
    const docs = childIds.map((childId) => {
      const childPath = `${path}/${childId}`;
      const data = resolveData(childPath, store, writtenStore);
      return buildDocSnap(childId, data, childPath);
    });
    return Promise.resolve(buildQuerySnap(docs));
  });
  return fn;
}

function createColRef(
  path: string,
  store: Record<string, any>,
  writtenStore: Record<string, any>,
  refs: MockRefs,
) {
  const get = buildColRefGet(path, store, writtenStore);

  const result: Record<string, any> = {
    get,
  };

  result.doc = (id: string) => {
    return createDocRef(`${path}/${id}`, store, writtenStore, refs);
  };

  // where() returns a Query object with its own get()
  // For simplicity, all where() filters just return all docs (no actual filtering)
  result.where = () => {
    return {
      get,
      where: () => result.where(),
    };
  };

  return result;
}

// ═══════════════════════════════════════════════════════════════
// CREATE MOCK DB
// ═══════════════════════════════════════════════════════════════

export function createMockDb(): { mockDb: any; refs: MockRefs } {
  const refs: MockRefs = {
    batchSet: vi.fn(),
    batchUpdate: vi.fn(),
    batchCommit: vi.fn().mockResolvedValue(undefined),
    setHistoricoMensual: vi.fn(),
    setGanancias: vi.fn(),
    setHistoricoCompras: vi.fn(),
    setCierreContable: vi.fn(),
    setAdminAction: vi.fn(),
  };

  const batch = {
    set: refs.batchSet,
    update: refs.batchUpdate,
    commit: refs.batchCommit,
  };

  const mockDb: Record<string, any> = {
    collection: vi.fn(),
    doc: vi.fn(),
    batch: vi.fn(() => batch),
  };

  return { mockDb, refs };
}

// ═══════════════════════════════════════════════════════════════
// STORE POPULATORS
// ═══════════════════════════════════════════════════════════════

/**
 * Populates the store with Ventas collection data from a scenario.
 */
function populateVentas(
  store: Record<string, any>,
  _writtenStore: Record<string, any>,
  ventas: NonNullable<Scenario["ventas"]>,
): void {
  for (const cliente of ventas) {
    const ventaPath = `Ventas/${cliente.id}`;
    store[ventaPath] = { id: cliente.id, ...cliente };

    for (const [mesAnio, pedidos] of Object.entries(cliente.months)) {
      const mesPath = `${ventaPath}/Pedidos/${mesAnio}`;
      store[mesPath] = { mesAnio };

      for (const pedido of pedidos) {
        const pedidoPath = `${mesPath}/pedidos/${pedido.id}`;
        // Store all pedido fields — the real repo reads estadoContable, pagado,
        // contabilidadAplicada, detalle, fechaPedido
        store[pedidoPath] = { ...pedido };
      }
    }
  }
}

/**
 * Populates the store with Total Productos / Cartones data.
 * Accepts a pre-built map of path → data (from buildTotalProductosAfterStage1 etc.)
 */
function populateCollection(
  store: Record<string, any>,
  data: Record<string, any> | undefined,
): void {
  if (!data) return;
  for (const [path, docData] of Object.entries(data)) {
    store[path] = docData;
  }
}

/**
 * Populates the store with Invertir data.
 */
function populateInvertir(
  store: Record<string, any>,
  _writtenStore: Record<string, any>,
  invertir: NonNullable<Scenario["invertir"]>,
): void {
  for (const [categoria, costos] of Object.entries(invertir)) {
    const catPath = `Invertir/${categoria}`;
    store[catPath] = { id: categoria };

    if (costos.costos_fijos) {
      const fijosPath = `${catPath}/costos_fijos/costos_fijos`;
      store[fijosPath] = { ...costos.costos_fijos };
    }

    if (costos.costos_variables) {
      // Production code reads a SINGLE document at Invertir/{cat}/costos_variables/costos_variables
      // via contableRepo.getCostosVariables(categoria).data() → iterates numeric values.
      // For Miel: getCostosVariablesPorProducto("Miel", productName) reads
      //   Invertir/Miel/costos_variables/{productName} as individual docs.
      //
      // Non-Miel: flatten ALL sub-entries into the single costos_variables doc.
      // Miel: store each product name as its own document.
      const isMiel = categoria === "Miel";

      if (isMiel) {
        // Miel: each product (Frascos, Botellas, etc.) is its own doc
        for (const [subKey, subData] of Object.entries(costos.costos_variables)) {
          const varPath = `${catPath}/costos_variables/${subKey}`;
          store[varPath] = { ...(subData as Record<string, any>) };
        }
      } else {
        // Non-Miel: merge all sub-entries into the single costos_variables doc
        const mergedVars: Record<string, any> = {};
        for (const subData of Object.values(costos.costos_variables)) {
          Object.assign(mergedVars, subData);
        }
        const varPath = `${catPath}/costos_variables/costos_variables`;
        store[varPath] = mergedVars;
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// BUILD MOCK STORE
// ═══════════════════════════════════════════════════════════════

export function buildMockStore(
  scenario: Scenario,
  mockDb: any,
  mockRefs: MockRefs,
): void {
  const store: Record<string, any> = {};
  const writtenStore: Record<string, any> = {};

  // ── Populate from scenario ──

  if (scenario.ventas) {
    populateVentas(store, writtenStore, scenario.ventas);
  }

  if (scenario.totalProductos) {
    populateCollection(store, scenario.totalProductos);
  }

  if (scenario.cartonesVendidos) {
    populateCollection(store, scenario.cartonesVendidos);
  }

  // Historico_Mensual: keyed by mesAnio string.
  // Empty object {} or null/undefined → no pre-population → doc doesn't exist (Stage 2 guard passes).
  // Non-empty: { "Enero 2026": { totalProductos: {...}, ... } } → doc exists with that data.
  if (scenario.historicoMensual != null) {
    for (const [mesAnio, data] of Object.entries(scenario.historicoMensual)) {
      if (data != null) {
        store[`Historico_Mensual/${mesAnio}`] = data;
      }
    }
  }

  if (scenario.invertir) {
    populateInvertir(store, writtenStore, scenario.invertir);
  }

  // ── Wire mockDb methods ──

  mockDb.doc = vi.fn((path: string) => {
    return createDocRef(path, store, writtenStore, mockRefs);
  });

  mockDb.collection = vi.fn((name: string) => {
    return createColRef(name, store, writtenStore, mockRefs);
  });

  // batch is already set up by createMockDb — no need to rewire
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO BUILDERS
// ═══════════════════════════════════════════════════════════════

export interface CategoriaInput {
  name: string;
  total: number;
  skus: Record<string, number>;
}

/**
 * Builds the Total Productos store map for scenarios where Stage 1
 * has already processed orders (post-Stage 1 state).
 *
 * Returns a flat map of path → data suitable for populateCollection().
 *
 * @example
 *   buildTotalProductosAfterStage1("Enero 2026", [
 *     { name: "Clavo", total: 5000, skus: { "Clavo * 100": 5000 } },
 *   ])
 */
export function buildTotalProductosAfterStage1(
  mesAnio: string,
  categorias: CategoriaInput[],
): Record<string, any> {
  const result: Record<string, any> = {};

  const totalGeneral = categorias.reduce((sum, c) => sum + c.total, 0);
  const mainPath = `Total Productos/${mesAnio}`;
  result[mainPath] = {
    mesAnio,
    totalGeneral,
    estado: "abierto",
  };

  for (const cat of categorias) {
    const catPath = `${mainPath}/productos/${cat.name}`;
    result[catPath] = { total: cat.total };

    for (const [skuName, skuTotal] of Object.entries(cat.skus)) {
      result[`${catPath}/skus/${skuName}`] = { total: skuTotal };
    }
  }

  return result;
}

/**
 * Builds the Cartones_vendidos store map for scenarios where Stage 1
 * has already processed orders (post-Stage 1 state).
 *
 * @example
 *   buildCartonesVendidosAfterStage1("Enero 2026", [
 *     { name: "Clavo", total: 2, skus: { "Clavo * 100": 2 } },
 *   ])
 */
export function buildCartonesVendidosAfterStage1(
  mesAnio: string,
  categorias: CategoriaInput[],
): Record<string, any> {
  const result: Record<string, any> = {};

  const totalGeneral = categorias.reduce((sum, c) => sum + c.total, 0);
  const mainPath = `Cartones_vendidos/${mesAnio}`;
  result[mainPath] = {
    mesAnio,
    totalGeneral,
    estado: "abierto",
  };

  for (const cat of categorias) {
    const catPath = `${mainPath}/productos/${cat.name}`;
    result[catPath] = { total: cat.total };

    for (const [skuName, skuTotal] of Object.entries(cat.skus)) {
      result[`${catPath}/skus/${skuName}`] = { total: skuTotal };
    }
  }

  return result;
}
