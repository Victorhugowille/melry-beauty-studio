/* =============================================================
   WHATSAPP · TESTE DE LEMBRETES (GREEN-API)
   Botões na área da profissional para testar os avisos:
   "Teste de 1 hr" e "Teste de 1 dia".

   O token da GREEN-API é salvo somente neste navegador
   (localStorage) — nunca vai para o código do site.
   Quem envia os avisos de verdade é o robô do GitHub Actions,
   que usa os secrets do repositório.
   ============================================================= */

(function () {
  var KEY_INSTANCE = "melry_greenapi_instance";
  var KEY_TOKEN = "melry_greenapi_token";
  var KEY_PHONE = "melry_greenapi_phone";
  var DEFAULT_PHONE = "5545998557194";

  var instanceInput = $("zap-instance");
  var tokenInput = $("zap-token");
  var phoneInput = $("zap-phone");
  var err = $("zap-err");
  var status = $("zap-status");
  if (!instanceInput || !tokenInput) return; // aba não existe

  // Carrega o que já foi salvo neste navegador
  instanceInput.value = localStorage.getItem(KEY_INSTANCE) || "";
  tokenInput.value = localStorage.getItem(KEY_TOKEN) || "";
  phoneInput.value = localStorage.getItem(KEY_PHONE) || DEFAULT_PHONE;

  function save() {
    var phone = phoneInput.value.replace(/\D/g, "");
    var instance = instanceInput.value.replace(/\D/g, "");
    var token = tokenInput.value.trim();
    if (instance) localStorage.setItem(KEY_INSTANCE, instance);
    if (token) localStorage.setItem(KEY_TOKEN, token);
    if (phone) localStorage.setItem(KEY_PHONE, phone);
    phoneInput.value = phone;
    instanceInput.value = instance;
    setStatus("Salvo neste navegador ✓", true);
  }

  function setStatus(text, ok) {
    if (!status) return;
    status.textContent = text;
    status.style.color = ok === false ? "var(--danger)" : "var(--ok)";
  }

  // Registra a tentativa no whatsapp_log (aba Testes). Se a tabela ainda
  // não existir, ignora sem incomodar a usuária.
  async function logAttempt(kind, phone, statusKind, detail) {
    try {
      var cfg = window.SUPABASE_CONFIG || {};
      var url = String(cfg.url || "").replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
      if (!url || !cfg.anonKey) return;
      await fetch(url + "/rest/v1/whatsapp_log", {
        method: "POST",
        headers: {
          apikey: cfg.anonKey,
          Authorization: "Bearer " + cfg.anonKey,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify([{ kind: kind, phone: phone, status: statusKind, detail: detail }])
      });
    } catch (e) { /* o log é só um espelho; não pode travar o teste */ }
  }

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function buildExampleMessage(kind) {
    var now = new Date();
    var when = new Date(now);
    if (kind === "day") when.setDate(now.getDate() + 1);

    var dateLine = capitalize(
      when.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
      })
    );

    var headline =
      kind === "day"
        ? "Oi, Maria! Lembrete: você tem atendimento *amanhã*."
        : "Oi, Maria! Seu atendimento começa *em 1 hora*.";

    return [
      "🌸 *Merly Beauty Studio*",
      "",
      headline,
      "",
      "📅 " + dateLine,
      "🕘 10:00 às 11:00",
      "💅 Manicure + Esmaltação em gel",
      "👤 Cliente: Cliente teste",
      "📱 (45) 9 0000-0000",
      "💰 R$ 90",
      "⏳ Duração: 1h",
      "",
      "(Mensagem de teste)"
    ].join("\n");
  }

  // A GREEN-API não envia cabeçalho CORS, então a resposta vem "às cegas"
  // (status 0, opaque): não dá para ler sucesso/erro pelo site — mas o POST
  // chega ao servidor e a mensagem é enfileirada. Content-Type text/plain
  // evita o preflight (que a API bloqueia). Corrida com timeout de 8s
  // para o botão nunca ficar preso em "Enviando…".
  async function sendBlind(url, payload) {
    var timeout = new Promise(function (resolve) { setTimeout(resolve, 8000); });
    try {
      await Promise.race([
        fetch(url, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain" },
          body: typeof payload === "string" ? payload : JSON.stringify(payload)
        }),
        timeout
      ]);
    } catch (e) {
      // Erro de rede (ex.: sem internet): único caso em que avisamos.
      return false;
    }
    return true;
  }

  async function sendTest(kind, btn) {
    var phone = phoneInput.value.replace(/\D/g, "");
    var instance = instanceInput.value.replace(/\D/g, "");
    var token = tokenInput.value.trim();
    err.textContent = "";

    if (instance.length < 5) {
      err.textContent = "Cole o idInstance (ex.: 7100000001).";
      return;
    }
    if (!token) {
      err.textContent = "Cole o apiTokenInstance da sua instância.";
      return;
    }
    if (phone.length < 12) {
      err.textContent = "Digite o número com DDI+DDD (ex.: 5545998557194).";
      return;
    }

    // Salva para as próximas vezes
    localStorage.setItem(KEY_INSTANCE, instance);
    localStorage.setItem(KEY_TOKEN, token);
    localStorage.setItem(KEY_PHONE, phone);

    var url = "https://api.green-api.com/waInstance" + instance + "/sendMessage/" + token;
    var payload = {
      chatId: phone + "@c.us",
      message: buildExampleMessage(kind)
    };

    var original = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }
    setStatus("Enviando…", true);

    var reached = await sendBlind(url, payload);
    logAttempt(
      "teste",
      phone,
      reached ? "teste-cego" : "erro",
      reached
        ? "Disparado às cegas pelo painel — confira no WhatsApp"
        : "Falha de rede no navegador"
    );
    setStatus(
      reached
        ? (kind === "day"
            ? "Teste de 1 dia enviado — confira o WhatsApp em até 1 minuto ✓"
            : "Teste de 1 hr enviado — confira o WhatsApp em até 1 minuto ✓")
        : "Não foi possível enviar. Verifique sua conexão.",
      reached
    );
    if (btn) { btn.disabled = false; btn.textContent = original; }
  }

  $("zap-save").onclick = save;
  $("zap-test-day").onclick = function () { sendTest("day", this); };
  $("zap-test-hour").onclick = function () { sendTest("hour", this); };
})();
