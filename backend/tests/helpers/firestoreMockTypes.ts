// Type-only exports for firestoreMock.js
// This file has no runtime code — imports are erased at build time.

export interface PedidoDetalle {
  nombre: string;
  cantidad: number;
  subtotal: number;
}

export interface PedidoInput {
  id: string;
  pagado: boolean;
  contabilidadAplicada: boolean;
  estadoContable?: string;
  detalle: PedidoDetalle[];
  fechaPedido: Date;
}

export interface ClienteInput {
  id: string;
  months: Record<string, PedidoInput[]>;
}

export interface CostosInput {
  costos_fijos?: Record<string, number>;
  costos_variables?: Record<string, Record<string, number>>;
}

export interface Scenario {
  ventas?: ClienteInput[];
  totalProductos?: Record<string, any>;
  cartonesVendidos?: Record<string, any>;
  historicoMensual?: Record<string, any | null>;
  invertir?: Record<string, CostosInput>;
  /**
   * Flat map of path → data for the `Productos/Productos_ID/...` tree,
   * e.g. `{ "Productos/Productos_ID/Aji * 100/Aji_1": { "Precio carton": 5000 } }`.
   */
  products?: Record<string, any>;
}

export interface MockRefs {
  batchSet: any;
  batchUpdate: any;
  batchCommit: any;
  setHistoricoMensual: any;
  setGanancias: any;
  setHistoricoCompras: any;
  setCierreContable: any;
  setAdminAction: any;
}
