const whatsappService = require('./whatsappService');

async function notify(payload) {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const to = process.env.WHATSAPP_NOTIFY_NUMBER;
  if (!phoneId || !to) return;
  const lines = Object.entries(payload).map(([k, v]) => `• ${k}: ${v}`);
  const message = `🧩 Handoff WhatsApp\n${lines.join('\n')}`;
  await whatsappService.sendText(phoneId, to, message);
}

module.exports = { notify };
