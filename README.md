# Sullink WhatsApp Chatbot

Este projeto é um chatbot para WhatsApp, pronto para rodar localmente, em AWS EC2, Lambda ou Cloudflare Workers. Ele gerencia fluxos de atendimento, envia notificações para atendentes via WhatsApp e pode ser facilmente adaptado para outros canais.

## Funcionalidades
- Fluxo de atendimento automatizado para clientes
- Suporte a múltiplos fluxos (novo cliente, segunda via, suporte)
- Notificação de handoff para atendente via WhatsApp
- Validação de CPF
- Armazenamento de estado em memória (pode ser adaptado para Redis)

---

## Como rodar localmente

1. **Clone o repositório:**
   ```bash
   git clone <url-do-repo>
   cd sullink-whatsapp-chatbot
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente:**
   - Copie o arquivo `.env.example` para `.env`:
     ```bash
     cp .env.example .env
     ```
   - Preencha as variáveis conforme instruções abaixo.

4. **Inicie o servidor:**
   ```bash
   node src/server.js
   ```

5. **Exponha localmente (opcional):**
   Para receber webhooks da Meta, use [ngrok](https://ngrok.com/):
   ```bash
   ngrok http 3000
   ```
   Use a URL gerada para configurar o webhook na Meta.

6. **Verifique se está rodando:**
   Acesse `http://localhost:3000/status` para checar se a aplicação está funcionando.

---

## Variáveis de ambiente (`.env.example`)

```
PORT=3000
VERIFY_TOKEN=sua_verify_token_aqui
WHATSAPP_TOKEN=seu_token_whatsapp_aqui
URL_SEGUNDA_VIA=https://suaempresa.com/segunda-via
WHATSAPP_PHONE_ID=seu_phone_id_aqui
WHATSAPP_NOTIFY_NUMBER=5599999999999
```

- `PORT`: Porta do servidor Express
- `VERIFY_TOKEN`: Token de verificação do webhook (definido por você na Meta)
- `WHATSAPP_TOKEN`: Token de acesso da API do WhatsApp Business
- `URL_SEGUNDA_VIA`: Link para segunda via de boleto
- `WHATSAPP_PHONE_ID`: ID do número do WhatsApp Business (Meta)
- `WHATSAPP_NOTIFY_NUMBER`: Número do atendente para receber notificações (formato 55DDDXXXXXXXX)

---

## Como obter os tokens e credenciais na Meta (WhatsApp Business API)

1. **Crie uma conta no [Meta for Developers](https://developers.facebook.com/)**
2. **Crie um App:**
   - Vá em "Meus Apps" > "Criar App"
   - Escolha o tipo "Negócios"
   - Siga o passo a passo
3. **Adicione o produto WhatsApp:**
   - No painel do app, clique em "Adicionar produto" > "WhatsApp"
4. **Configure o WhatsApp Business:**
   - Siga as instruções para criar um número de teste ou conectar um número real
   - Copie o `WHATSAPP_TOKEN` (token de acesso temporário ou gere um token permanente via sistema de contas)
   - Copie o `WHATSAPP_PHONE_ID` (ID do número do WhatsApp)
5. **Configure o Webhook:**
   - No painel do WhatsApp, configure a URL do webhook (ex: `https://<seu-ngrok>.ngrok.io/webhook`)
   - Defina o `VERIFY_TOKEN` (pode ser qualquer string, mas deve ser igual ao do seu `.env`)
   - Selecione os eventos desejados (messages, message_status, etc)
6. **Adicione o número do atendente como destinatário:**
   - O número definido em `WHATSAPP_NOTIFY_NUMBER` precisa ter enviado uma mensagem para o número do bot pelo menos uma vez para receber notificações.

---

## Testando o ngrok

1. Instale o ngrok (caso não tenha):
   ```bash
   npm install -g ngrok
   # ou use npx ngrok diretamente
   ```

2. Autentique sua conta ngrok (apenas na primeira vez):
   ```bash
   ngrok config add-authtoken SEU_AUTHTOKEN_AQUI
   ```
   - O authtoken é obtido em https://dashboard.ngrok.com/get-started/your-authtoken

3. Inicie o túnel apontando para a porta do seu servidor:
   ```bash
   ngrok http 3000
   ```

4. Use a URL gerada (ex: https://xxxxxx.ngrok-free.dev) para configurar o webhook na Meta:
   - Exemplo de callback URL: `https://xxxxxx.ngrok-free.dev/webhook`

5. Teste se o ngrok está funcionando:
   - Acesse a URL gerada pelo ngrok no navegador ou use curl:
     ```bash
     curl "https://xxxxxx.ngrok-free.dev/status"
     ```
   - Deve retornar `{ "status": "ok", "message": "Aplicação está funcionando" }`

---

## Observações
- Para produção, recomenda-se usar armazenamento de estado persistente (ex: Redis).
- O envio de mensagens proativas (notificações) só funciona se o destinatário já interagiu com o bot nas últimas 24h ou se usar templates aprovados pela Meta.
- O projeto pode ser adaptado para Cloudflare Workers (ver `src/worker.js`).

---

## Suporte
Dúvidas ou sugestões? Abra uma issue ou entre em contato.
