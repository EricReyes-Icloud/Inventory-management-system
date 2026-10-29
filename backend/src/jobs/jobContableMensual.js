const db = require("../lib/firestore");
const contabilidadRepo = require("../repositories/contabilidad.repository");
const ventasRepo = require("../repositories/ventas.repository");

/**
 * Processes all pending orders across clients and months.
 * Uses Collection Group Query for O(1) discovery instead of O(N×M) nested loops.
 * Idempotent: skips orders that are already processed (contabilidadAplicada === true)
 * or not paid. Builds atomic batch operations via contabilidadRepo and commits them.
 *
 * @returns {Promise<{pedidosProcesados: number, pedidosFallidos: number}>}
 */
async function processPendingOrders() {
  console.log("🔄 Iniciando Job Contable (optimizado)");

  // UNA sola query global — O(1) reads para descubrimiento
  const pedidosSnap = await ventasRepo.getTodosPedidosPendientesGlobal();

  if (pedidosSnap.empty) {
    console.log("ℹ️ No hay pedidos pendientes");
    return { pedidosProcesados: 0, pedidosFallidos: 0 };
  }

  // Agrupar por cliente+mes para batch atómico por pedido (mantener idempotency)
  const pedidosPorClienteMes = new Map();

  for (const pedidoDoc of pedidosSnap.docs) {
    const pedido = pedidoDoc.data();
    const pedidoRef = pedidoDoc.ref;
    
    // Extraer clienteId y mesAnio del path del documento
    // Path: Ventas/{clienteId}/Pedidos/{mesAnio}/pedidos/{pedidoId}
    const pathParts = pedidoRef.path.split("/");
    const clienteId = pathParts[1];
    const mesAnio = pathParts[3];

    const key = `${clienteId}|${mesAnio}`;
    if (!pedidosPorClienteMes.has(key)) {
      pedidosPorClienteMes.set(key, []);
    }
    pedidosPorClienteMes.get(key).push({ pedido, pedidoRef, clienteId, mesAnio });
  }

  let pedidosProcesados = 0;
  let pedidosFallidos = 0;

  // Procesar en grupos por cliente+mes
  for (const [key, pedidos] of pedidosPorClienteMes) {
    const [clienteId, mesAnio] = key.split("|");
    console.log(`👤 Cliente: ${clienteId} | 📅 Mes: ${mesAnio} → ${pedidos.length} pedidos`);

    for (const { pedido, pedidoRef, clienteId, mesAnio } of pedidos) {
      // 🔐 Validación defensiva de pago (ya filtrado en query, pero defensa en profundidad)
      if (!pedido.pagado) {
        console.log(`⏭ Pedido ${pedidoRef.id} no está pagado`);
        continue;
      }

      // 🔐 Evita doble procesamiento — idempotency guard
      if (pedido.contabilidadAplicada === true) {
        console.log(`⏭ Pedido ${pedidoRef.id} ya contabilizado`);
        continue;
      }

      // 🔎 Validar detalle
      if (!Array.isArray(pedido.detalle) || pedido.detalle.length === 0) {
        console.warn(`⚠️ Pedido ${pedidoRef.id} sin detalles`);
        continue;
      }

      // 📅 Validar fecha
      const fechaPedido =
        pedido.fechaPedido?.toDate?.() ?? pedido.fechaPedido;

      if (!(fechaPedido instanceof Date)) {
        console.error(`❌ Pedido ${pedidoRef.id} sin fecha válida`);
        continue;
      }

      console.log(`➡️ Procesando pedido ${pedidoRef.id} | ${clienteId} | ${mesAnio}`);

      try {
        // 🧠 1. Calcular operaciones contables (usando el repositorio)
        const operaciones = contabilidadRepo.buildOperacionesContables(
          pedido.detalle,
          fechaPedido
        );

        // 🧱 2. Crear batch atómico
        const batch = db.batch();

        // 🔁 3. Aplicar operaciones contables
        for (const op of operaciones) {
          const ref = db.doc(op.ref);
          batch.set(ref, op.data, op.options);
        }

        // ✅ 4. Marcar pedido como procesado (DENTRO del batch)
        batch.update(pedidoRef, {
          estadoContable: "procesado",
          contabilidadAplicada: true,
          fechaProcesado: new Date(),
        });

        // 🚀 5. Commit atómico
        await batch.commit();

        pedidosProcesados++;

      } catch (error) {
        pedidosFallidos++;

        console.error(
          `❌ Error procesando pedido ${pedidoRef.id} | Cliente: ${clienteId} | Mes: ${mesAnio}`
        );
        console.error("🧨 Detalle:", error.message);
      }
    }
  }

  console.log("🏁 Job Contable finalizado");
  console.log(`✅ Procesados: ${pedidosProcesados}`);
  console.log(`❌ Fallidos: ${pedidosFallidos}`);

  return { pedidosProcesados, pedidosFallidos };
}

/**
 * Cron entry point for the accounting job.
 * Delegates to processPendingOrders() so the orchestrator can also call it directly.
 * Cron behavior is unchanged.
 */
async function jobContableMensual() {
  return processPendingOrders();
}

module.exports = jobContableMensual;
module.exports.processPendingOrders = processPendingOrders;
