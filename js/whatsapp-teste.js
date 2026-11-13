/* =============================================================
   WHATSAPP · TESTE DE LEMBRETES (CallMeBot)
   Botões na área da profissional para testar os avisos:
   "Teste de 1 hr" e "Teste de 1 dia".

   A apikey do CallMeBot é salva somente neste navegador
   (localStorage) — nunca vai para o código do site.
   Quem envia os avisos de verdade é o robô do GitHub Actions,
   que usa a apikey guardada em Secrets do repositório.
============================================================= */

(function () {
  var KEY_APIKEY = "melry_callmebot_apikey";
  var KEY_PHONE = "melry_callmebot_phone";
  var DEFAULT_PHONE = "554591096203";

  var phoneInput = $("zap-phone");
  var keyInput = $("zap-apikey");
  var err = $("zap-err");
  var status = $("zap-status");
  if (!phoneInput || !keyInput) return; // aba não existe

  // Carrega o que já foi salvo neste navegador
  phoneInput.value = localStorage.getItem(KEY_PHONE) || DEFAULT_PHONE;
  keyInput.value = localStorage.getItem(KEY_APIKEY) || "";

  function save() {
    var phone = phoneInput.value.replace(/\D/g, "");
    phoneInput.value = phone;
    if (phone) localStorage.setItem(KEY_PHONE, phone);
    var apikey = keyInput.value.trim();
    if (apikey) localStorage.setItem(KEY_APIKEY, apikey);
    setStatus("Salvo neste navegador ✓", true);
  }

  function setStatus(text, ok) {
    if (!status) return;
    status.textContent = text;
    status.style.color = ok === false ? "var(--danger)" : "var(--ok)";
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

  // O CallMeBot não envia cabeçalho CORS, então a resposta vem "às cegas"
  // (status 0, opaque): não dá para ler sucesso/erro pelo site — mas o GET
  // chega ao servidor e a mensagem é enfileirada. Corrida com timeout de 8s
  // para o botão nunca ficar preso em "Enviando…".
  async function sendBlind(url) {
    var timeout = new Promise(function (resolve) { setTimeout(resolve, 8000); });
    try {
      await Promise.race([fetch(url, { mode: "no-cors" }), timeout]);
    } catch (e) {
      // Erro de rede (ex.: sem internet): único caso em que avisamos.
      return false;
    }
    return true;
  }

  async function sendTest(kind, btn) {
    var phone = phoneInput.value.replace(/\D/g, "");
    var apikey = keyInput.value.trim();
    err.textContent = "";

    if (phone.length < 12) {
      err.textContent = "Digite o número com DDI+DDD (ex.: 554591096203).";
      return;
    }
    if (!apikey) {
      err.textContent = "Cole a apikey que chegou no seu WhatsApp quando o CallMeBot foi ativado (ex.: 1234567).";
      return;
    }

    // Salva para as próximas vezes
    localStorage.setItem(KEY_PHONE, phone);
    localStorage.setItem(KEY_APIKEY, apikey);

    var url =
      "https://api.callmebot.com/whatsapp.php?phone=" + encodeURIComponent(phone) +
      "&text=" + encodeURIComponent(buildExampleMessage(kind)) +
      "&apikey=" + encodeURIComponent(apikey);

    var original = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }
    setStatus("Enviando…", true);

    var reached = await sendBlind(url);
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
