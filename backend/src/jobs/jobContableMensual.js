const db = require("../lib/firestore");
const contabilidadRepo = require("../repositories/contabilidad.repository");
const ventasRepo = require("../repositories/ventas.repository");

async function jobContableMensual() {
  console.log("🔄 Iniciando Job Contable");

  const clientesSnap = await ventasRepo.getTodosClientesConVentas();

  if (clientesSnap.empty) {
    console.log("ℹ️ No hay clientes con ventas");
    return;
  }

  let pedidosProcesados = 0;
  let pedidosFallidos = 0;

  for (const clienteDoc of clientesSnap.docs) {
    const clienteId = clienteDoc.id;

    console.log(`👤 Cliente: ${clienteId}`);

    const mesesSnap = await ventasRepo.getMesesPedidos(clienteId);

    console.log(
      `📂 Rutas encontradas para ${clienteId}:`,
      mesesSnap.docs.map(d => d.id)
    );

    if (mesesSnap.empty) {
      console.log(`ℹ️ Cliente ${clienteId} sin meses`);
      continue;
    }

    for (const mesDoc of mesesSnap.docs) {
      const mesAnio = mesDoc.id;

      console.log(`📅 Mes: ${mesAnio}`);

      const pedidosSnap = await ventasRepo.getPedidosPendientes(clienteId, mesAnio);

      console.log(
        `📦 ${clienteId} | ${mesAnio} → pedidos pendientes: ${pedidosSnap.size}`
      );

      if (pedidosSnap.empty) continue;

      for (const pedidoDoc of pedidosSnap.docs) {
        const pedido = pedidoDoc.data();
        const pedidoRef = pedidoDoc.ref;

        // 🔐 Validación defensiva de pago
        if (!pedido.pagado) {
          console.log(`⏭ Pedido ${pedidoDoc.id} no está pagado`);
          continue;
        }

        // 🔐 Evita doble procesamiento
        if (pedido.contabilidadAplicada === true) {
          console.log(`⏭ Pedido ${pedidoDoc.id} ya contabilizado`);
          continue;
        }

        // 🔎 Validar detalle
        if (!Array.isArray(pedido.detalle) || pedido.detalle.length === 0) {
          console.warn(`⚠️ Pedido ${pedidoDoc.id} sin detalles`);
          continue;
        }

        // 📅 Validar fecha
        const fechaPedido =
          pedido.fechaPedido?.toDate?.() ?? pedido.fechaPedido;

        if (!(fechaPedido instanceof Date)) {
          console.error(`❌ Pedido ${pedidoDoc.id} sin fecha válida`);
          continue;
        }

        console.log(
          `➡️ Procesando pedido ${pedidoDoc.id} | ${clienteId} | ${mesAnio}`
        );

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
            `❌ Error procesando pedido ${pedidoDoc.id} | Cliente: ${clienteId} | Mes: ${mesAnio}`
          );
          console.error("🧨 Detalle:", error.message);
        }
      }
    }
  }

  console.log("🏁 Job Contable finalizado");
  console.log(`✅ Procesados: ${pedidosProcesados}`);
  console.log(`❌ Fallidos: ${pedidosFallidos}`);
}

module.exports = jobContableMensual;
