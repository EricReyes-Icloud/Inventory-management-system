require("dotenv").config();
console.log("TWILIO_ACCOUNT_SID:", process.env.TWILIO_ACCOUNT_SID);
console.log("TWILIO_AUTH_TOKEN:", process.env.TWILIO_AUTH_TOKEN ? "✅ cargado" : "❌ no cargado");
const twilio = require("twilio");

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function sendWhatsAppMessage() {
  try {
    const message = await client.messages.create({
      from: "whatsapp:+14155238886",
      to: "whatsapp:+573138861417",
      body: "Nuevo mensaje, Lo lograste Eric"
    });

    console.log("Mensaje enviado:", message.sid);
  } catch (error) {
    console.error("❌ Error enviando mensaje:", error);
  }
}

sendWhatsAppMessage();
