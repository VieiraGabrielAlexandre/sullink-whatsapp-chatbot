export default {
    async fetch(request, env) {
        // === Verificação do webhook (Meta) ===
        if (request.method === 'GET') {
            const u = new URL(request.url);
            if (u.searchParams.get('hub.mode') === 'subscribe' &&
                u.searchParams.get('hub.verify_token') === env.VERIFY_TOKEN) {
                return new Response(u.searchParams.get('hub.challenge'), { status: 200 });
            }
            return new Response('forbidden', { status: 403 });
        }

        // === Recepção de mensagens ===
        if (request.method === 'POST') {
            const body = await request.json();
            const change = body.entry?.[0]?.changes?.[0]?.value;
            const msg = change?.messages?.[0];
            if (!msg) return new Response('ok', { status: 200 });

            const from = msg.from;
            const phoneId = change.metadata.phone_number_id;

            // Estado do usuário
            const stateKey = `user:${from}`;
            let state = JSON.parse((await env.WA_STATE.get(stateKey)) || '{}');

            const text = (
                msg.text?.body ||
                msg.button?.text ||
                msg.interactive?.list_reply?.title ||
                ''
            ).trim();

            const send = (payload) =>
                fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${env.WHATSAPP_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

            const textMessage = (to, body) => ({
                messaging_product: 'whatsapp', to, type: 'text', text: { body }
            });

            const replyButtons = (to, body, buttons) => ({
                messaging_product: 'whatsapp',
                to,
                type: 'interactive',
                interactive: {
                    type: 'button',
                    body: { text: body },
                    action: {
                        buttons: buttons.slice(0,3).map(b => ({
                            type: 'reply',
                            reply: { id: b.id, title: b.title }
                        }))
                    }
                }
            });

            // === Comando RESET ===
            if (/^reset$/i.test(text)) {
                await env.WA_STATE.delete(stateKey);
                await send(textMessage(from, '✅ Conversa reiniciada. Digite *menu* para começar novamente.'));
                return new Response('ok', { status: 200 });
            }

            // Se está em handoff, ignora (exceto reset)
            if (state.handoff) return new Response('ok', { status: 200 });

            // === Menu inicial ===
            if (!state.stage || /^menu|^0$/.test(text.toLowerCase())) {
                await send(replyButtons(from, 'Como posso ajudar?', [
                    { id: 'opt1', title: '1) Quero ser cliente' },
                    { id: 'opt2', title: '2) Segunda via de boleto' },
                    { id: 'opt3', title: '3) Suporte ou reparos' }
                ]));
                state = { stage: 'idle' };
                await env.WA_STATE.put(stateKey, JSON.stringify(state));
                return new Response('ok', { status: 200 });
            }

            // === Fluxo 1: Quero ser cliente ===
            if (/^(1|opt1|quero ser cliente)/i.test(text)) {
                await send(textMessage(from, 'Fico feliz, por favor aguarde um momento…'));
                await send(textMessage(from, 'Agora me informe seu endereço.'));
                state.stage = 'wait_address';
                state.intent = 'novo_cliente';
                await env.WA_STATE.put(stateKey, JSON.stringify(state));
                return new Response('ok', { status: 200 });
            }

            if (state.stage === 'wait_address') {
                const endereco = text;
                if (endereco.length < 5) {
                    await send(textMessage(from, 'Endereço parece incompleto. Envie rua, número e bairro.'));
                    return new Response('ok', { status: 200 });
                }
                await send(textMessage(from, 'Prontinho, agora aguarde um de nossos atendentes.'));
                await notifyHandoff(env, { from, intent: state.intent, endereco });
                state = { handoff: true, stage: 'handoff' };
                await env.WA_STATE.put(stateKey, JSON.stringify(state));
                return new Response('ok', { status: 200 });
            }

            // === Fluxo 2: Segunda via de boleto ===
            if (/^(2|opt2)/.test(text)) {
                const url = env.URL_SEGUNDA_VIA || 'https://suaempresa.com/segunda-via';
                await send(textMessage(from, `Para acessar a segunda via, clique: ${url}`));
                state.stage = 'idle';
                await env.WA_STATE.put(stateKey, JSON.stringify(state));
                return new Response('ok', { status: 200 });
            }

            // === Fluxo 3: Suporte ou reparos ===
            if (/^(3|opt3)/.test(text)) {
                await send(textMessage(from, 'Suporte técnico: descreva seu problema.'));
                state.stage = 'wait_issue';
                state.intent = 'suporte';
                await env.WA_STATE.put(stateKey, JSON.stringify(state));
                return new Response('ok', { status: 200 });
            }

            if (state.stage === 'wait_issue') {
                state.issue = text;
                await send(textMessage(from, 'Obrigado. Agora, digite seu CPF para localizar seu cadastro (apenas números).'));
                state.stage = 'wait_cpf';
                await env.WA_STATE.put(stateKey, JSON.stringify(state));
                return new Response('ok', { status: 200 });
            }

            if (state.stage === 'wait_cpf') {
                const cpf = text.replace(/\D/g, '');
                if (!validarCPF(cpf)) {
                    await send(textMessage(from, 'CPF inválido. Envie novamente (11 dígitos válidos, apenas números).'));
                    return new Response('ok', { status: 200 });
                }
                await send(textMessage(from, 'Aguarde um de nossos atendentes.'));
                await notifyHandoff(env, {
                    from, intent: state.intent, issue: state.issue, cpf
                });
                state = { handoff: true, stage: 'handoff' };
                await env.WA_STATE.put(stateKey, JSON.stringify(state));
                return new Response('ok', { status: 200 });
            }

            // === Fallback ===
            await send(textMessage(from, 'Digite *menu* para ver as opções.'));
            return new Response('ok', { status: 200 });
        }

        return new Response('not found', { status: 404 });
    }
};

// === Função: validar CPF com dígitos verificadores ===
function validarCPF(cpf) {
    cpf = (cpf || '').replace(/\D/g, '');
    if (!cpf || cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    if (resto !== parseInt(cpf[9])) return false;

    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    return resto === parseInt(cpf[10]);
}

// === Notificar canal de atendimento (Slack/CRM) ===
async function notifyHandoff(env, payload) {
    if (!env.SLACK_WEBHOOK_URL) return;
    const lines = Object.entries(payload).map(([k, v]) => `• ${k}: ${v}`);
    await fetch(env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `🧩 Handoff WhatsApp\n${lines.join('\n')}` })
    });
}

if (url.pathname === '/reset' && url.searchParams.get('phone')) {
    await env.WA_STATE.delete(`user:${url.searchParams.get('phone')}`);
    return new Response('reset ok', { status: 200 });
}
