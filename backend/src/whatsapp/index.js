const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const { procesarMensajeTwilio } = require("../brain/inturis.js");

const router = express.Router();
router.use(bodyParser.urlencoded({ extended: false }));

// 🧹 Limpieza previa del mensaje para eliminar saludos, nombres o texto no útil
function limpiarMensajePedido(texto) {
  let mensaje = texto.toLowerCase();

  // Elimina texto antes de los dos puntos (ej: "hernan:", "juan dice:")
  mensaje = mensaje.replace(/^[a-záéíóúñ\s]+:\s*/i, "");

  // Elimina saludos comunes
  mensaje = mensaje
    .replace(/\b(hola|buenos dias|buenas tardes|buenas noches|que tal|como estas)\b/gi, "")
    .replace(/\b(le escribo|le comento|le envio|aqui va|te mando)\b/gi, "");

  // Elimina espacios duplicados
  mensaje = mensaje.replace(/\s+/g, " ").trim();

  return mensaje;
}

// 🧠 Detecta si el mensaje contiene el nombre de un cliente
function detectarYRemoverCliente(mensaje) {
  const clientes = ["hernan", "mauricio", "esperanza", "edwin"];
  let clienteDetectado = null;

  for (const nombre of clientes) {
    const regex = new RegExp(`\\b${nombre}\\b`, "i");
    if (regex.test(mensaje)) {
      clienteDetectado = nombre;
      mensaje = mensaje.replace(regex, "").trim(); // 🧹 Elimina el nombre del texto
      break;
    }
  }

  return { clienteDetectado, mensajeLimpio: mensaje };
}

// 🔍 Verifica si el mensaje tiene la estructura de un pedido
function esPedidoValido(texto) {
  const mensaje = texto.toLowerCase();
  const patronPedido = /\b\d+\s+(?:[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)*)\b/;
  const palabrasNumeros = /\b(una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b\s+[a-záéíóúñ]+/;
  return patronPedido.test(mensaje) || palabrasNumeros.test(mensaje);
}

// 🟢 Endpoint público de Twilio
router.post("/webhook/whatsapp", async (req, res) => {
  const twiml = new twilio.twiml.MessagingResponse();

  try {
    let mensaje = req.body.Body?.trim() || "";
    const telefono = req.body.From;

    console.log("📩 Mensaje original:", mensaje, "de", telefono);

    // 🧹 Limpieza general
    mensaje = limpiarMensajePedido(mensaje);
    console.log("✨ Mensaje limpiado:", mensaje);

    // 🧠 Detectar cliente y limpiar el mensaje de su nombre
    const { clienteDetectado, mensajeLimpio } = detectarYRemoverCliente(mensaje);
    mensaje = mensajeLimpio;

    if (clienteDetectado) {
      console.log(`👤 Cliente detectado: ${clienteDetectado}`);
    } else {
      console.log("⚠️ No se detectó ningún cliente en el mensaje.");
    }

    // ✅ Validar estructura del pedido
    if (!esPedidoValido(mensaje)) {
      console.log("⚠️ Mensaje no válido como pedido. Se notifica al cliente.");
      twiml.message("⚠️ Esto no es un pedido. Por favor, escribe el pedido en formato correcto (ej: '2 clavos de 100').");
      res.writeHead(200, { "Content-Type": "text/xml" });
      return res.end(twiml.toString());
    }

    // 🔁 Enviar mensaje limpio a Inturis junto con el cliente detectado
    const interpretacion = await procesarMensajeTwilio(mensaje, telefono, clienteDetectado);
    console.log("🧠 Interpretación:", JSON.stringify(interpretacion, null, 2));

    if (!interpretacion || interpretacion.error) {
      console.log("🚫 El sistema no comprendió el mensaje.");
      twiml.message("🚫 Este mensaje no ha sido comprendido. Comunícate con servicio técnico de inmediato.");
      res.writeHead(200, { "Content-Type": "text/xml" });
      return res.end(twiml.toString());
    }

    // ✅ Responder con confirmación
    twiml.message(`✅ Pedido recibido correctamente${clienteDetectado ? `, ${clienteDetectado}` : ""}. ¡Gracias por tu mensaje!`);
    res.writeHead(200, { "Content-Type": "text/xml" });
    res.end(twiml.toString());

  } catch (error) {
    console.error("❌ Error al procesar mensaje:", error);
    const errorTwiml = new twilio.twiml.MessagingResponse();
    errorTwiml.message("⚠️ Ocurrió un error interno. Por favor, intenta más tarde.");
    res.writeHead(200, { "Content-Type": "text/xml" });
    res.end(errorTwiml.toString());
  }
});

module.exports = router;
