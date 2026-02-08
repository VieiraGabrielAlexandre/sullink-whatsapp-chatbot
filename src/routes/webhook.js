const express = require('express');
const whatsappService = require('../services/whatsappService');
const stateService = require('../services/stateService');
const validarCPF = require('../utils/validarCPF');
const notifyService = require('../services/notifyService');

const router = express.Router();

router.get('/', async (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.status(403).send('forbidden');
});

router.post('/', async (req, res) => {
  console.log('Recebido POST /webhook');
  const body = req.body;
  console.log('Body recebido:', JSON.stringify(body));
  const change = body.entry?.[0]?.changes?.[0]?.value;
  const msg = change?.messages?.[0];
  if (!msg) {
    console.log('Nenhuma mensagem encontrada no webhook.');
    return res.status(200).send('ok');
  }

  const from = msg.from;
  const phoneId = change.metadata.phone_number_id;
  const stateKey = `user:${from}`;
  let state = await stateService.get(stateKey);

  const text = (
    msg.text?.body || msg.button?.text || msg.interactive?.list_reply?.title || ''
  ).trim();
  console.log(`Mensagem recebida de ${from}:`, text);

  // RESET
  if (/^reset$/i.test(text)) {
    await stateService.del(stateKey);
    await whatsappService.sendText(phoneId, from, '✅ Conversa reiniciada. Digite *menu* para começar novamente.');
    return res.status(200).send('ok');
  }

  if (state?.handoff) return res.status(200).send('ok');

  // MENU
  if (!state?.stage || /^menu|^0$/.test(text.toLowerCase())) {
    await whatsappService.sendButtons(phoneId, from, 'Como posso ajudar?', [
      { id: 'opt1', title: '1) Quero ser cliente' },
      { id: 'opt2', title: '2) Segunda via de boleto' },
      { id: 'opt3', title: '3) Suporte ou reparos' }
    ]);
    await stateService.set(stateKey, { stage: 'idle' });
    return res.status(200).send('ok');
  }

  // FLUXO 1: NOVO CLIENTE
  if (/^(1|opt1|quero ser cliente)/i.test(text)) {
    await whatsappService.sendText(phoneId, from, 'Fico feliz, por favor aguarde um momento…');
    await whatsappService.sendText(phoneId, from, 'Agora me informe seu endereço.');
    await stateService.set(stateKey, { stage: 'wait_address', intent: 'novo_cliente' });
    return res.status(200).send('ok');
  }

  if (state?.stage === 'wait_address') {
    if (text.length < 5) {
      await whatsappService.sendText(phoneId, from, 'Endereço parece incompleto. Envie rua, número e bairro.');
      return res.status(200).send('ok');
    }
    await whatsappService.sendText(phoneId, from, 'Prontinho, agora aguarde um de nossos atendentes.');
    await notifyService.notify({ from, intent: state.intent, endereco: text });
    await stateService.set(stateKey, { handoff: true, stage: 'handoff' });
    return res.status(200).send('ok');
  }

  // FLUXO 2: SEGUNDA VIA
  if (/^(2|opt2)/.test(text)) {
    const url = process.env.URL_SEGUNDA_VIA || 'https://suaempresa.com/segunda-via';
    await whatsappService.sendText(phoneId, from, `Para acessar a segunda via, clique: ${url}`);
    await stateService.set(stateKey, { stage: 'idle' });
    return res.status(200).send('ok');
  }

  // FLUXO 3: SUPORTE
  if (/^(3|opt3)/.test(text)) {
    await whatsappService.sendText(phoneId, from, 'Suporte técnico: descreva seu problema.');
    await stateService.set(stateKey, { stage: 'wait_issue', intent: 'suporte' });
    return res.status(200).send('ok');
  }

  if (state?.stage === 'wait_issue') {
    await whatsappService.sendText(phoneId, from, 'Obrigado. Agora, digite seu CPF para localizar seu cadastro (apenas números).');
    await stateService.set(stateKey, { ...state, issue: text, stage: 'wait_cpf' });
    return res.status(200).send('ok');
  }

  if (state?.stage === 'wait_cpf') {
    const cpf = text.replace(/\D/g, '');
    if (!validarCPF(cpf)) {
      await whatsappService.sendText(phoneId, from, 'CPF inválido. Envie novamente (11 dígitos válidos, apenas números).');
      return res.status(200).send('ok');
    }
    await whatsappService.sendText(phoneId, from, 'Aguarde um de nossos atendentes.');
    await notifyService.notify({ from, intent: state.intent, issue: state.issue, cpf });
    await stateService.set(stateKey, { handoff: true, stage: 'handoff' });
    return res.status(200).send('ok');
  }

  await whatsappService.sendText(phoneId, from, 'Digite *menu* para ver as opções.');
  res.status(200).send('ok');
});

module.exports = router;
