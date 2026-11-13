/**
 * ENVIO DE WHATSAPP
 * Provedor padrão: CallMeBot (API gratuita para uso pessoal).
 * Para ativar, a Maria precisa enviar "I allow callmebot to send me messages"
 * para +34 644 26 33 77 e guardar a API key recebida.
 *
 * Provedores futuros podem ser adicionados no mesmo contrato: send(text).
 */

const DEFAULT_PHONE = "5545998557194"; // WhatsApp da Maria (o mesmo do site)
const CALLMEBOT_ENDPOINT = "https://api.callmebot.com/whatsapp.php";

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export function createWhatsApp(options = {}) {
  const provider = String(
    options.provider || process.env.WHATSAPP_PROVIDER || "callmebot"
  ).toLowerCase();

  const to = onlyDigits(options.to || process.env.WHATSAPP_PHONE || DEFAULT_PHONE);
  const apiKey = String(options.apiKey || process.env.CALLMEBOT_APIKEY || "").trim();

  return {
    provider,
    to,

    isConfigured() {
      return Boolean(to) && (provider !== "callmebot" || Boolean(apiKey));
    },

    describe() {
      return `${provider} → +${to}`;
    },

    async send(text) {
      if (provider === "callmebot") return sendViaCallMeBot({ to, apiKey, text });
      throw new Error(`Provedor de WhatsApp desconhecido: ${provider}`);
    }
  };
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
