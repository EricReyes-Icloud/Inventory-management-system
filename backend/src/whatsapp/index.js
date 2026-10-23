const express = require("express");
const bodyParser = require("body-parser"); //Para leer el body de la request
const twilio = require("twilio"); //SDK de Twilio
const { procesarMensajeTwilio } = require("../brain/inturis.js");
const adminRepo = require("../repositories/admin.repository");
const { admin: adminConfig } = require("../config");
const { createWebhookRateLimiter } = require("../middlewares/rateLimit");

const router = express.Router(); // Mini-servidor modular
router.use(bodyParser.urlencoded({ extended: false })); // Permite el formato de Twilio

// El limitador va DESPUÉS de la validación de firma y de la autorización del
// remitente: solo el tráfico autenticado consume presupuesto.
const webhookRateLimiter = createWebhookRateLimiter();

function normalizeNumber(telefono) {
  if (!telefono) return "";
  let t = String(telefono).replace(/whatsapp:/i, "").trim();
  t = t.replace(/[\s\-\(\)]/g, "");
  if (t.startsWith("00")) t = "+" + t.slice(2);
  if (!t.startsWith("+")) {
    if (t.startsWith("57") && t.length === 12) t = "+" + t;
    else if (t.length === 10) t = "+57" + t;
    else t = "+" + t;
  }
  return t;
}

// Allowlist de remitentes, resuelta desde ADMIN_ALLOWED_NUMBERS al cargar el
// módulo. Se normaliza acá porque la config guarda los números tal cual.
const ALLOWED_ADMIN_NUMBERS = adminConfig.allowedNumbers
  .map(normalizeNumber)
  .filter((n) => n !== "");

if (ALLOWED_ADMIN_NUMBERS.length === 0) {
  console.warn(
    "[whatsapp] ADMIN_ALLOWED_NUMBERS no esta definido: todos los remitentes van a ser rechazados con 403."
  );
}

function validateTwilioSignature(req, res, next) {
  try {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const signature = req.headers["x-twilio-signature"];

    if (!authToken || !signature) {
      return res.status(403).json({ error: "forbidden" });
    }

    const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const url = `${protocol}://${host}${req.originalUrl}`;
    const params = req.body || {};

    const isValid = twilio.validateRequest(authToken, signature, url, params);
    if (!isValid) {
      return res.status(403).json({ error: "forbidden" });
    }

    return next();
  } catch (err) {
    console.error("❌ Error validating Twilio signature:", err.message);
    return res.status(403).json({ error: "forbidden" });
  }
}

async function authorizeAdminSender(req, res, next) {
  try {
    const from = req.body?.From || "";
    const clean = normalizeNumber(from);

    if (!ALLOWED_ADMIN_NUMBERS.includes(clean)) {
      console.log(`🚫 Número no autorizado para enviar pedidos: ${from} -> ${clean}`);
      const twiml = new twilio.twiml.MessagingResponse();
      twiml.message("🚫 No autorizado para enviar pedidos. Solo los administradores autorizados pueden registrar pedidos.");
      res.writeHead(403, { "Content-Type": "text/xml" });
      return res.end(twiml.toString());
    }

    const adminSnap = await adminRepo.getAdminByTelefono(clean);
    if (adminSnap.empty) {
      console.log(`🚫 Número autorizado en lista pero no encontrado como admin: ${clean}`);
      const twiml = new twilio.twiml.MessagingResponse();
      twiml.message("🚫 No autorizado para enviar pedidos. Solo los administradores autorizados pueden registrar pedidos.");
      res.writeHead(403, { "Content-Type": "text/xml" });
      return res.end(twiml.toString());
    }

    req.adminSender = {
      telefono: clean,
      adminDoc: adminSnap.docs[0].data(),
    };
    return next();
  } catch (err) {
    console.error("❌ Error autorizando remitente:", err.message);
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message("⚠️ Ocurrió un error interno. Por favor, intenta más tarde.");
    res.writeHead(403, { "Content-Type": "text/xml" });
    return res.end(twiml.toString());
  }
}

// Limpieza previa del mensaje para eliminar saludos, nombres o texto no útil
function limpiarMensajePedido(texto) {
  let mensaje = texto.toLowerCase();

  // Elimina texto antes de los dos puntos (ej: "hernan:", "juan dice:") a travez de regex
  mensaje = mensaje.replace(/^[a-záéíóúñ\s]+:\s*/i, "");

  // Elimina saludos comunes
  mensaje = mensaje
    .replace(/\b(hola|buenos dias|buenas tardes|buenas noches|que tal|como estas)\b/gi, "")
    .replace(/\b(le escribo|le comento|le envio|aqui va|te mando)\b/gi, "");

  // Elimina espacios duplicados
  mensaje = mensaje.replace(/\s+/g, " ").trim();

  return mensaje;
}

// Detecta si el mensaje contiene el nombre de un cliente
function detectarYRemoverCliente(mensaje) {
  const clientes = ["hernan", "mauricio", "esperanza", "edwin"];// Debemos cambiar por DB
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

// Verifica si el mensaje tiene la estructura de un pedido
function esPedidoValido(texto) {
  const mensaje = texto.toLowerCase();
  const patronPedido = /\b\d+\s+(?:[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)*)\b/;
  const palabrasNumeros = /\b(una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b\s+[a-záéíóúñ]+/;
  return patronPedido.test(mensaje) || palabrasNumeros.test(mensaje);
}

// Endpoint público de Twilio
router.post("/webhook", validateTwilioSignature, authorizeAdminSender, webhookRateLimiter, async (req, res) => {
  const twiml = new twilio.twiml.MessagingResponse();

  try {
    let mensaje = req.body.Body?.trim() || "";
    const telefono = req.body.From;

    console.log("Mensaje original:", mensaje, "de", telefono);

    // Limpieza general
    mensaje = limpiarMensajePedido(mensaje);
    console.log("✨ Mensaje limpio:", mensaje);

    // Detectar cliente y limpiar el mensaje de su nombre
    const { clienteDetectado, mensajeLimpio } = detectarYRemoverCliente(mensaje);
    mensaje = mensajeLimpio;

    if (clienteDetectado) {
      console.log(`👤 Cliente detectado: ${clienteDetectado}`);
    } else {
      console.log("⚠️ No se detectó ningún cliente en el mensaje.");
    }

    // Validar estructura del pedido
    if (!esPedidoValido(mensaje)) {
      console.log("⚠️ Mensaje no válido como pedido. Se notifica al cliente.");
      twiml.message("⚠️ Esto no es un pedido. Por favor, escribe el pedido en formato correcto (ej: '2 clavos de 100').");
      res.writeHead(200, { "Content-Type": "text/xml" });
      return res.end(twiml.toString());
    }

    // Enviar mensaje limpio a Inturis junto con el cliente detectado
    const interpretacion = await procesarMensajeTwilio(mensaje, telefono, clienteDetectado);
    console.log("🧠 Interpretación:", JSON.stringify(interpretacion, null, 2));

    if (!interpretacion || interpretacion.error) {
      console.log("🚫 El sistema no comprendió el mensaje.");
      twiml.message("🚫 Este mensaje no ha sido comprendido. Comunícate con servicio técnico de inmediato.");
      res.writeHead(200, { "Content-Type": "text/xml" });
      return res.end(twiml.toString());
    }

    if (interpretacion.pedidoRegistrado === false) {
      console.log("⚠️ No se pudo registrar el pedido.");
      twiml.message("⚠️ No pudimos registrar tu pedido. Por favor, intenta más tarde y comunícate con servicio técnico de inmediato.");
      res.writeHead(200, { "Content-Type": "text/xml" });
      return res.end(twiml.toString());
    }

    // Responder con confirmación
    twiml.message(`✅ Pedido recibido correctamente${clienteDetectado ? `, ${clienteDetectado}` : ""}. ¡Gracias por tu mensaje!`);
    res.writeHead(200, { "Content-Type": "text/xml" });
    res.end(twiml.toString());

  } catch (error) {
    console.error("❌ Error al procesar mensaje:", error);
    const errorTwiml = new twilio.twiml.MessagingResponse();
    errorTwiml.message("⚠️ Ocurrió un error interno. Por favor, intenta más tarde y comunícate con servicio técnico de inmediato.");
    res.writeHead(200, { "Content-Type": "text/xml" });
    res.end(errorTwiml.toString());
  }
});

module.exports = router;
