// Importamos la libreria dotenv y cargamos las variables de entorno .env
require("dotenv").config();

// Traemos nuestro SID y Token de Twilio 
console.log("TWILIO_ACCOUNT_SID:", process.env.TWILIO_ACCOUNT_SID);
console.log("TWILIO_AUTH_TOKEN:", process.env.TWILIO_AUTH_TOKEN ? "✅ cargado" : "❌ no cargado");

// Importamos la libreria de Twilio
const twilio = require("twilio");

// Creamos nuestro cliente de Twilio y nos autenticamos
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);


// Funcion asíncronica (porque vamos a hacer una llamada HTTP)
async function sendWhatsAppMessage() {
  try {
    const message = await client.messages.create({
      from: "whatsapp:+14155238886", // Número de Twilio (Sandbox)
      to: "whatsapp:+573138861417", // Número destino
      body: "Nuevo mensaje, Lo lograste Eric" // Contenido del mensaje
    });

    console.log("Mensaje enviado:", message.sid); // message.sid  Id unico del mensaje
  } catch (error) {
    console.error("❌ Error enviando mensaje:", error);
  }
}

sendWhatsAppMessage();
