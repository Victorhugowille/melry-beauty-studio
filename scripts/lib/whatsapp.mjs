/**
 * ENVIO DE WHATSAPP
 * Provedor padrão: GREEN-API (plano Developer, grátis — sendMessage ilimitado).
 * Para ativar, a Maria precisa:
 *   1. Criar conta em console.green-api.com
 *   2. Criar uma instância no plano Developer
 *   3. Escanear o QR Code no WhatsApp dela (Aparelhos conectados)
 *   4. Copiar idInstance + apiTokenInstance para os secrets do GitHub
 *      (GREENAPI_INSTANCE e GREENAPI_TOKEN).
 *
 * O provedor "callmebot" segue disponível só por compatibilidade.
 *
 * Provedores futuros podem ser adicionados no mesmo contrato: send(text).
 */

const DEFAULT_PHONE = "5545998557194"; // WhatsApp do estúdio (Maria) — destino dos avisos
const GREENAPI_ENDPOINT = "https://api.green-api.com";
const CALLMEBOT_ENDPOINT = "https://api.callmebot.com/whatsapp.php";

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export function createWhatsApp(options = {}) {
  const provider = String(
    options.provider || process.env.WHATSAPP_PROVIDER || "greenapi"
  ).toLowerCase();

  const to = onlyDigits(options.to || process.env.WHATSAPP_PHONE || DEFAULT_PHONE);

  if (provider === "callmebot") {
    const apiKey = String(options.apiKey || process.env.CALLMEBOT_APIKEY || "").trim();
    return {
      provider,
      to,
      isConfigured() {
        return Boolean(to) && Boolean(apiKey);
      },
      describe() {
        return `callmebot → +${to}`;
      },
      async send(text) {
        return sendViaCallMeBot({ to, apiKey, text });
      }
    };
  }

  // greenapi (padrão)
  const instance = String(options.instance || process.env.GREENAPI_INSTANCE || "").trim();
  const token = String(options.token || process.env.GREENAPI_TOKEN || "").trim();
  return {
    provider: "greenapi",
    to,
    isConfigured() {
      return Boolean(to) && Boolean(instance) && Boolean(token);
    },
    describe() {
      return `green-api → +${to}`;
    },
    async send(text) {
      return sendViaGreenApi({ to, instance, token, text });
    }
  };
}

async function sendViaGreenApi({ to, instance, token, text }) {
  if (!instance || !token) {
    throw new Error(
      "GREENAPI_INSTANCE / GREENAPI_TOKEN não configurados. Ative a instância no console.green-api.com e salve os secrets no GitHub."
    );
  }

  const url = `${GREENAPI_ENDPOINT}/waInstance${instance}/sendMessage/${token}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId: `${to}@c.us`, message: text }),
    signal: AbortSignal.timeout(30000)
  });
  const body = (await response.text()).trim();

  if (!response.ok) {
    throw new Error(`GREEN-API respondeu HTTP ${response.status}: ${body.slice(0, 200)}`);
  }

  let json = null;
  try { json = JSON.parse(body); } catch (e) { /* resposta não-JSON: OK */ }
  if (json && (json.error || json.errorMessage)) {
    throw new Error(`GREEN-API recusou o envio: ${body.slice(0, 200)}`);
  }

  return (json && json.idMessage) ? json.idMessage : (body || "enviado");
}

async function sendViaCallMeBot({ to, apiKey, text }) {
  if (!apiKey) {
    throw new Error(
      "CALLMEBOT_APIKEY não configurada. Ative o bot e salve a chave nos secrets do GitHub."
    );
  }

  const url = new URL(CALLMEBOT_ENDPOINT);
  url.searchParams.set("phone", `+${to}`);
  url.searchParams.set("text", text);
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  const body = (await response.text()).trim();

  if (!response.ok) {
    throw new Error(`CallMeBot respondeu HTTP ${response.status}: ${body.slice(0, 200)}`);
  }

  if (/error|invalid|not allowed|not activated|denied|blocked/i.test(body)) {
    throw new Error(`CallMeBot recusou o envio: ${body.slice(0, 200)}`);
  }

  return body || "enviado";
}
