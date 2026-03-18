const db = require("../lib/firestore");
const { procesarTotalesYCartones } = require("../services/contabilidad.service");

async function jobContableMensual() {
  console.log("🔄 Iniciando Job Contable");

  const clientesSnap = await db.collection("Ventas").get();

  if (clientesSnap.empty) {
    console.log("ℹ️ No hay clientes con ventas");
    return;
  }

  let pedidosProcesados = 0;

  for (const clienteDoc of clientesSnap.docs) {
    const clienteId = clienteDoc.id;

    console.log(`👤 Cliente: ${clienteId}`);

    const pedidosRootRef = db
      .collection("Ventas")
      .doc(clienteId)
      .collection("Pedidos");

    const mesesSnap = await pedidosRootRef.get();

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

      const pedidosCollectionRef = pedidosRootRef
        .doc(mesAnio)
        .collection("pedidos");

      const pedidosSnap = await pedidosCollectionRef
        .where("estadoContable", "==", "pendiente")
        .get();

      console.log(
        `📦 ${clienteId} | ${mesAnio} → pedidos pendientes: ${pedidosSnap.size}`
      );

      if (pedidosSnap.empty) continue;

      for (const pedidoDoc of pedidosSnap.docs) {
        const pedido = pedidoDoc.data();
        const pedidoRef = pedidoDoc.ref;
      
        // 🔐 Validación defensiva de pago
        if (!pedido.pagado) {
          console.log(`⏭ Pedido ${pedidoDoc.id} no está pagado, no se puede procesar`);
          continue;
        }
      
        // 🔐 Evita doble procesamiento
        if (pedido.contabilidadAplicada === true) {
          console.log(`⏭ Pedido ${pedidoDoc.id} ya esta contabilizado`);
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
          await procesarTotalesYCartones(
            pedido.detalle,
            fechaPedido
          );
      
          await pedidoRef.update({
            estadoContable: "procesado", // ← mejor nombre que "procesado"
            contabilidadAplicada: true,
            fechaProcesado: new Date(),
          });
      
          pedidosProcesados++;
        } catch (error) {
          console.error(
            `❌ Error procesando pedido ${pedidoDoc.id}:`,
            error.message
          );
        }
      }
    }
  }

  if (pedidosProcesados === 0) {
    console.log("ℹ️ No hay pedidos pendientes");
  } else {
    console.log(`✅ ${pedidosProcesados} pedidos procesados correctamente`);
  }

  console.log("🏁 Job Contable finalizado");
}

module.exports = jobContableMensual;
