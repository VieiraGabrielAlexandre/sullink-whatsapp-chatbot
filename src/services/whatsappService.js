const fetch = require('node-fetch');

function getHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

async function sendText(phoneId, to, body) {
  const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body }
  };
  await fetch(url, {
    method: 'POST',
    headers: getHeaders(process.env.WHATSAPP_TOKEN),
    body: JSON.stringify(payload)
  });
}

async function sendButtons(phoneId, to, body, buttons) {
  const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.slice(0, 3).map(b => ({
          type: 'reply',
          reply: { id: b.id, title: b.title }
        }))
      }
    }
  };
  await fetch(url, {
    method: 'POST',
    headers: getHeaders(process.env.WHATSAPP_TOKEN),
    body: JSON.stringify(payload)
  });
}

module.exports = { sendText, sendButtons };
