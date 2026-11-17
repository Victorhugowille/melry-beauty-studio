/* =============================================================
   ABA "TESTES" DO PAINEL — Logs de e-mail e WhatsApp
   Lê email_log, whatsapp_log e a fila email_outbox direto do
   Supabase (REST) e mostra aqui. Nada é executado sozinho:
   os botões só disparam ações quando você toca neles.
   ============================================================= */

(function () {
  // ----- Config (mesma fonte do supabaseClient.js) -----
  function getCfg() {
    var cfg = window.SUPABASE_CONFIG || {};
    try {
      var stored = localStorage.getItem("melry_supabase_custom_cfg");
      if (stored) {
        var parsed = JSON.parse(stored);
        if (parsed.url && parsed.anonKey) cfg = parsed;
      }
    } catch (e) {}
    if (cfg.url) cfg.url = String(cfg.url).replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
    return cfg;
  }
  var cfg = getCfg();

  function rest(path, init) {
    var url = cfg.url.replace(/\/+$/, "") + "/rest/v1/" + path;
    return fetch(url, {
      method: (init && init.method) || "GET",
      headers: {
        apikey: cfg.anonKey,
        Authorization: "Bearer " + cfg.anonKey,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: init && init.body ? JSON.stringify(init.body) : undefined
    });
  }

  // ----- Utilitários -----
  function esc(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit"
    });
  }

  var EMAIL_KIND_LABEL = {
    client_email_booked: "Confirmação p/ cliente",
    client_email_day: "Lembrete 24h p/ cliente",
    client_email_hour: "Lembrete 1h p/ cliente",
    studio_email_booked: "Confirmação p/ estúdio",
    studio_email_day: "Lembrete 24h p/ estúdio",
    studio_email_hour: "Lembrete 1h p/ estúdio",
    outbox: "Troca de horário (fila)",
    teste: "E-mail de teste"
  };
  var ZAP_KIND_LABEL = {
    day: "Lembrete 24h",
    hour: "Lembrete 1h",
    teste: "Teste pela aba Testes"
  };

  function badge(cls, text) {
    return '<span class="log-badge ' + cls + '">' + esc(text) + '</span>';
  }
  function okBadge(s) {
    if (s === "ok") return badge("ok", "OK");
    if (s === "erro") return badge("erro", "ERRO");
    if (s === "teste-cego") return badge("cego", "TESTE");
    return badge("pendente", String(s || "?"));
  }

  function renderList(box, rows, mapRow) {
    if (!box) return;
    if (rows == null) return; // mantém o aviso de tabela ausente
    if (!rows.length) {
      box.innerHTML = '<p class="log-empty">Nada registrado ainda.</p>';
      return;
    }
    box.innerHTML = rows.map(mapRow).join("");
  }

  async function loadTable(name, query) {
    try {
      var r = await rest(name + (query || ""));
      if (!r.ok) {
        if (r.status === 404 || r.status === 400) return { missing: true };
        return { error: "HTTP " + r.status };
      }
      var data = await r.json().catch(function () { return []; });
      return { rows: Array.isArray(data) ? data : [] };
    } catch (e) {
      return { error: (e && e.message) || String(e) };
    }
  }

  function missingTableNote(what) {
    return '<p class="log-empty">Tabela ausente ou sem permissão. Rode <strong>sql/logs.sql</strong> no SQL Editor do Supabase para ativar o ' + esc(what) + '.</p>';
  }

  function ago(iso) {
    var t = new Date(iso).getTime();
    if (isNaN(t)) return "";
    var diff = Math.max(0, Date.now() - t);
    var min = Math.floor(diff / 60000);
    if (min < 1) return "agora mesmo";
    if (min < 60) return "há " + min + " min";
    var h = Math.floor(min / 60);
    if (h < 24) return "há " + h + "h";
    var d = Math.floor(h / 24);
    return "há " + d + "d";
  }

  // ----- Carregamento dos dados -----
  async function loadEmailLog() {
    var box = document.getElementById("mail-log-list");
    if (!box) return;
    var res = await loadTable("email_log", "?select=kind,to_email,booking_id,status,detail,created_at&order=created_at.desc&limit=30");
    if (res.missing) { box.innerHTML = missingTableNote("log de e-mails"); return; }
    if (res.error) { box.innerHTML = '<p class="log-empty">Não consegui ler o log: ' + esc(res.error) + "</p>"; return; }
    renderList(box, res.rows, function (row) {
      var title = (EMAIL_KIND_LABEL[row.kind] || row.kind || "e-mail") + (row.to_email ? " → " + row.to_email : "");
      return (
        '<div class="log-row">' + okBadge(row.status) +
          '<div class="log-body">' +
            '<div class="log-title">' + esc(title) + '</div>' +
            (row.detail ? '<div class="log-detail">' + esc(row.detail) + '</div>' : "") +
            '<span class="log-time">' + esc(ago(row.created_at)) + " · " + esc(fmtTime(row.created_at)) + '</span>' +
          '</div>' +
        '</div>'
      );
    });
  }

  async function loadWhatsappLog() {
    var box = document.getElementById("zap-log-list");
    if (!box) return;
    var res = await loadTable("whatsapp_log", "?select=kind,phone,status,detail,created_at&order=created_at.desc&limit=30");
    if (res.missing) { box.innerHTML = missingTableNote("log do WhatsApp"); return; }
    if (res.error) { box.innerHTML = '<p class="log-empty">Não consegui ler o log: ' + esc(res.error) + "</p>"; return; }
    renderList(box, res.rows, function (row) {
      var title = (ZAP_KIND_LABEL[row.kind] || row.kind || "WhatsApp") + (row.phone ? " → +" + row.phone : "");
      return (
        '<div class="log-row">' + okBadge(row.status) +
          '<div class="log-body">' +
            '<div class="log-title">' + esc(title) + '</div>' +
            (row.detail ? '<div class="log-detail">' + esc(row.detail) + '</div>' : "") +
            '<span class="log-time">' + esc(ago(row.created_at)) + " · " + esc(fmtTime(row.created_at)) + '</span>' +
          '</div>' +
        '</div>'
      );
    });
  }

  async function loadOutbox() {
    var box = document.getElementById("outbox-list");
    if (!box) return;
    var res = await loadTable("email_outbox", "?select=id,to_email,params,created_at,sent_at,error&order=created_at.desc&limit=20");
    if (res.missing) { box.innerHTML = missingTableNote("fila de e-mails"); return; }
    if (res.error) { box.innerHTML = '<p class="log-empty">Não consegui ler a fila: ' + esc(res.error) + "</p>"; return; }
    renderList(box, res.rows, function (row) {
      var title = "Troca de horário → " + (row.to_email || "?");
      var status, detail = "";
      if (row.sent_at) { status = "ok"; detail = "Enviado em " + fmtTime(row.sent_at); }
      else if (row.error) { status = "erro"; detail = row.error; }
      else { status = "pendente"; detail = "Aguardando o robô do Supabase enviar (até 1 minuto)."; }
      if (row.params && row.params.title) detail = row.params.title + (detail ? " — " + detail : "");
      return (
        '<div class="log-row">' + (row.sent_at ? badge("ok", "ENVIADO") : row.error ? badge("erro", "ERRO") : badge("pendente", "NA FILA")) +
          '<div class="log-body">' +
            '<div class="log-title">' + esc(title) + '</div>' +
            (detail ? '<div class="log-detail">' + esc(detail) + '</div>' : "") +
            '<span class="log-time">' + esc(ago(row.created_at)) + " · " + esc(fmtTime(row.created_at)) + '</span>' +
          '</div>' +
        '</div>'
      );
    });
  }

  function refreshAll() {
    loadEmailLog();
    loadWhatsappLog();
    loadOutbox();
  }

  // ----- Botões e eventos -----
  var mailErr = document.getElementById("mail-err");
  var mailStatus = document.getElementById("mail-status");

  function setMailStatus(text, ok) {
    if (!mailStatus) return;
    mailStatus.textContent = text;
    mailStatus.style.color = ok === false ? "var(--danger)" : "var(--ok)";
  }

  var mailTestBtn = document.getElementById("mail-test-send");
  if (mailTestBtn) mailTestBtn.addEventListener("click", async function () {
    if (mailErr) mailErr.textContent = "";
    var input = document.getElementById("mail-test-email");
    var to = (input && input.value.trim().toLowerCase()) || "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) {
      if (mailErr) mailErr.textContent = "Digite um e-mail válido para o teste.";
      if (input) input.focus();
      return;
    }
    mailTestBtn.disabled = true;
    setMailStatus("Enfileirando…", true);
    try {
      var res = await rest("email_outbox", {
        method: "POST",
        body: [{
          to_email: to,
          params: {
            title: "Teste de e-mail do Merly Beauty Studio 💛",
            line1: "Olá! Este é um e-mail de teste enviado pela área do estúdio.",
            line2: "💅 Se você está vendo isto, a entrega está funcionando!",
            line3: "📅 " + new Date().toLocaleDateString("pt-BR"),
            line4: "",
            to_name: "Cliente de teste"
          }
        }]
      });
      if (!res.ok) {
        var body = await res.text();
        setMailStatus("Não consegui enfileirar (HTTP " + res.status + "). " + body.slice(0, 120), false);
        return;
      }
      setMailStatus("Enfileirado! O robô do Supabase envia em até 1 minuto. Atualize o log de e-mails abaixo.", true);
      setTimeout(refreshAll, 6000);
    } catch (e) {
      setMailStatus("Falha de rede: " + ((e && e.message) || e), false);
    } finally {
      mailTestBtn.disabled = false;
    }
  });

  var mailRunBtn = document.getElementById("mail-run");
  if (mailRunBtn) mailRunBtn.addEventListener("click", async function () {
    var url = cfg.url.replace(/\/+$/, "") + "/functions/v1/send-reminders";
    mailRunBtn.disabled = true;
    setMailStatus("Disparando a checagem…", true);
    try {
      // Sem CORS: o navegador não lê a resposta, mas a chamada chega ao servidor.
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: "{}"
      });
      setMailStatus("Checagem disparada. Veja o resultado no log de e-mails abaixo (atualiza sozinho).", true);
    } catch (e) {
      setMailStatus("Não consegui disparar (sem internet?). " + ((e && e.message) || e), false);
    } finally {
      mailRunBtn.disabled = false;
      setTimeout(refreshAll, 8000);
    }
  });

  var zRefresh = document.getElementById("zap-log-refresh");
  if (zRefresh) zRefresh.addEventListener("click", loadWhatsappLog);
  var mRefresh = document.getElementById("mail-log-refresh");
  if (mRefresh) mRefresh.addEventListener("click", loadEmailLog);
  var oRefresh = document.getElementById("outbox-refresh");
  if (oRefresh) oRefresh.addEventListener("click", loadOutbox);

  // Atualiza sozinha enquanto a aba Testes estiver aberta (a cada 15 s)
  setInterval(function () {
    var panel = document.getElementById("p-zap");
    if (panel && !panel.hidden && document.visibilityState === "visible") refreshAll();
  }, 15000);

  window.logsUI = { refresh: refreshAll };
})();
